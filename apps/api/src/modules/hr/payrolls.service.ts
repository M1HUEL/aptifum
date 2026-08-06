import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, In, Repository } from 'typeorm';
import { DocumentSeriesKind, PayrollStatus, round2 } from '@aptifum/core';
import {
  ChartAccountNotFoundError,
  DocumentSeriesNotFoundError,
  Employee,
  JournalEntryPeriodClosedError,
  JournalEntryUnbalancedError,
  nextDocumentNumber,
  Payroll,
  PayrollLine,
  postJournalEntry,
} from '@aptifum/database';
import { ACCOUNT_CODES } from '@aptifum/database';
import { GeneratePayrollDto } from './dto/generate-payroll.dto';

@Injectable()
export class PayrollsService {
  constructor(
    @InjectRepository(Payroll) private readonly payrollsRepo: Repository<Payroll>,
    @InjectRepository(Employee) private readonly employeesRepo: Repository<Employee>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  private scoped(tenantId: string | null): FindOptionsWhere<Payroll> {
    return tenantId ? { tenantId } : {};
  }

  async findAll(tenantId: string | null, page: number, limit: number, period?: string) {
    const where: FindOptionsWhere<Payroll> = this.scoped(tenantId);
    if (period) {
      where.period = period;
    }
    const [rows, total] = await this.payrollsRepo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { period: 'DESC', createdAt: 'DESC' },
    });
    return { data: rows, meta: { page, limit, total } };
  }

  async findOne(tenantId: string | null, id: string) {
    const payroll = await this.payrollsRepo.findOne({
      where: { id, ...this.scoped(tenantId) },
      relations: { lines: { employee: true }, postedEntry: true },
    });
    if (!payroll) {
      throw new NotFoundException('Payroll not found');
    }
    return payroll;
  }

  async generate(tenantId: string | null, dto: GeneratePayrollDto) {
    this.assertTenant(tenantId);
    return this.dataSource.transaction(async (manager) => {
      const payrollsRepo = manager.getRepository(Payroll);
      const linesRepo = manager.getRepository(PayrollLine);
      const existing = await payrollsRepo.findOneBy({
        tenantId: tenantId as string,
        period: dto.period,
      });
      if (existing) {
        throw new ConflictException(`Payroll for period ${dto.period} already exists`);
      }
      const employeeIds = dto.lines.map((line) => line.employeeId);
      const employees = await manager.getRepository(Employee).findBy({
        tenantId: tenantId as string,
        id: In([...new Set(employeeIds)]),
      });
      const employeesById = new Map(employees.map((employee) => [employee.id, employee]));
      if (employees.length !== new Set(employeeIds).size) {
        throw new NotFoundException('One or more employees were not found');
      }
      const lines = dto.lines.map((input) => {
        const employee = employeesById.get(input.employeeId);
        if (!employee) {
          throw new NotFoundException('Employee not found');
        }
        const bonus = round2(input.bonus ?? 0);
        const overtime = round2(input.overtime ?? 0);
        const deductions = round2(input.deductions ?? 0);
        const gross = round2(employee.salary + bonus + overtime);
        const net = round2(gross - deductions);
        if (net < 0) {
          throw new BadRequestException(`Net pay cannot be negative for ${employee.employeeNo}`);
        }
        return {
          tenantId,
          employeeId: employee.id,
          gross,
          bonus,
          overtime,
          deductions,
          net,
        };
      });
      const totals = lines.reduce(
        (acc, line) => ({
          totalGross: round2(acc.totalGross + line.gross),
          totalDeductions: round2(acc.totalDeductions + line.deductions),
          totalNet: round2(acc.totalNet + line.net),
        }),
        { totalGross: 0, totalDeductions: 0, totalNet: 0 },
      );
      const { number } = await nextDocumentNumber(
        manager,
        tenantId as string,
        DocumentSeriesKind.PAYROLL,
      );
      const payroll = await payrollsRepo.save(
        payrollsRepo.create({
          tenantId: tenantId as string,
          number,
          period: dto.period,
          status: PayrollStatus.DRAFT,
          currency: dto.currency ?? 'USD',
          ...totals,
        }),
      );
      await linesRepo.save(lines.map((line) => linesRepo.create({ ...line, payrollId: payroll.id })));
      const savedLines = await linesRepo.findBy({ payrollId: payroll.id });
      return { ...payroll, lines: savedLines };
    });
  }

  async post(tenantId: string | null, userId: string | null, id: string) {
    this.assertTenant(tenantId);
    const payroll = await this.findOne(tenantId, id);
    if (payroll.status !== PayrollStatus.DRAFT) {
      throw new BadRequestException('Only draft payrolls can be posted');
    }
    const entryDate = this.lastDayOfPeriod(payroll.period);
    try {
      await this.dataSource.transaction(async (manager) => {
        const repo = manager.getRepository(Payroll);
        const current = await repo.findOneBy({ id: payroll.id, tenantId: tenantId as string });
        if (!current || current.status !== PayrollStatus.DRAFT) {
          throw new BadRequestException('Only draft payrolls can be posted');
        }
        const lines: Array<{ accountCode: string; debit?: number; credit?: number }> = [
          { accountCode: ACCOUNT_CODES.PAYROLL_EXPENSE, debit: payroll.totalGross },
          { accountCode: ACCOUNT_CODES.PAYROLL_PAYABLE, credit: payroll.totalNet },
        ];
        if (payroll.totalDeductions > 0) {
          lines.push({
            accountCode: ACCOUNT_CODES.PAYROLL_DEDUCTIONS_PAYABLE,
            credit: payroll.totalDeductions,
          });
        }
        const entry = await postJournalEntry(manager, tenantId as string, {
          entryDate,
          description: `Payroll ${payroll.number} (${payroll.period})`,
          referenceType: 'payroll',
          referenceId: payroll.id,
          currency: payroll.currency,
          userId,
          lines,
        });
        current.status = PayrollStatus.POSTED;
        current.postedEntryId = entry.id;
        current.postedAt = new Date();
        await repo.save(current);
      });
      return this.findOne(tenantId, id);
    } catch (error) {
      this.mapPostError(error);
    }
  }

  async cancel(tenantId: string | null, id: string) {
    const payroll = await this.findOne(tenantId, id);
    if (payroll.status !== PayrollStatus.DRAFT) {
      throw new BadRequestException('Only draft payrolls can be cancelled');
    }
    payroll.status = PayrollStatus.CANCELLED;
    await this.payrollsRepo.save(payroll);
    return this.findOne(tenantId, id);
  }

  private lastDayOfPeriod(period: string): string {
    const [year, month] = period.split('-').map(Number);
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return `${period}-${String(last).padStart(2, '0')}`;
  }

  private mapPostError(error: unknown): never {
    if (error instanceof ChartAccountNotFoundError) {
      throw new BadRequestException(error.message);
    }
    if (error instanceof JournalEntryPeriodClosedError) {
      throw new ConflictException(error.message);
    }
    if (error instanceof JournalEntryUnbalancedError) {
      throw new ConflictException(error.message);
    }
    if (error instanceof DocumentSeriesNotFoundError) {
      throw new NotFoundException(error.message);
    }
    throw error;
  }

  private assertTenant(tenantId: string | null): asserts tenantId is string {
    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }
  }
}
