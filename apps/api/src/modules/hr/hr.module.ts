import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AttendanceRecord, Department, Employee, JournalEntry, Leave, Payroll, PayrollLine } from '@aptifum/database';

import { RbacModule } from '../rbac/rbac.module.js';

import { AttendanceController } from './attendance.controller.js';
import { AttendanceService } from './attendance.service.js';
import { DepartmentsController } from './departments.controller.js';
import { DepartmentsService } from './departments.service.js';
import { EmployeesController } from './employees.controller.js';
import { EmployeesService } from './employees.service.js';
import { LeavesController } from './leaves.controller.js';
import { LeavesService } from './leaves.service.js';
import { PayrollsController } from './payrolls.controller.js';
import { PayrollsService } from './payrolls.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Department, Employee, AttendanceRecord, Leave, Payroll, PayrollLine, JournalEntry]),
    RbacModule,
  ],
  controllers: [DepartmentsController, EmployeesController, AttendanceController, LeavesController, PayrollsController],
  providers: [DepartmentsService, EmployeesService, AttendanceService, LeavesService, PayrollsService],
})
export class HrModule {}
