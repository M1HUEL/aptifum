import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AttendanceRecord, Department, Employee, JournalEntry, Leave, Payroll, PayrollLine } from '@aptifum/database';

import { RbacModule } from '../rbac/rbac.module';

import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { DepartmentsController } from './departments.controller';
import { DepartmentsService } from './departments.service';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { LeavesController } from './leaves.controller';
import { LeavesService } from './leaves.service';
import { PayrollsController } from './payrolls.controller';
import { PayrollsService } from './payrolls.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Department, Employee, AttendanceRecord, Leave, Payroll, PayrollLine, JournalEntry]),
    RbacModule,
  ],
  controllers: [DepartmentsController, EmployeesController, AttendanceController, LeavesController, PayrollsController],
  providers: [DepartmentsService, EmployeesService, AttendanceService, LeavesService, PayrollsService],
})
export class HrModule {}
