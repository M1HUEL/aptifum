import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ModuleName, permission } from '@aptifum/core';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { ImportsService, type ImportType } from './imports.service';

interface CsvUploadFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

const FILE_LIMITS = { fileSize: 5 * 1024 * 1024 };

@ApiTags('imports')
@Controller('imports')
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  private handle(user: { tenantId: string | null; id: string }, type: ImportType, file?: CsvUploadFile) {
    if (!file || file.size === 0) {
      throw new BadRequestException('file is required');
    }
    return this.importsService.importCsv(user.tenantId, user.id, type, file.buffer);
  }

  @Post('products/csv')
  @RequirePermissions(permission(ModuleName.INVENTORY, 'write'))
  @UseInterceptors(FileInterceptor('file', { limits: FILE_LIMITS }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Import products from CSV (sku, name, category, prices, ...)' })
  importProducts(
    @CurrentUser() user: { tenantId: string | null; id: string },
    @UploadedFile() file?: CsvUploadFile,
  ) {
    return this.handle(user, 'products', file);
  }

  @Post('customers/csv')
  @RequirePermissions(permission(ModuleName.SALES, 'write'))
  @UseInterceptors(FileInterceptor('file', { limits: FILE_LIMITS }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Import customers from CSV (code, trade_name, tax_id, ...)' })
  importCustomers(
    @CurrentUser() user: { tenantId: string | null; id: string },
    @UploadedFile() file?: CsvUploadFile,
  ) {
    return this.handle(user, 'customers', file);
  }

  @Post('suppliers/csv')
  @RequirePermissions(permission(ModuleName.PURCHASING, 'write'))
  @UseInterceptors(FileInterceptor('file', { limits: FILE_LIMITS }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Import suppliers from CSV (code, trade_name, tax_id, ...)' })
  importSuppliers(
    @CurrentUser() user: { tenantId: string | null; id: string },
    @UploadedFile() file?: CsvUploadFile,
  ) {
    return this.handle(user, 'suppliers', file);
  }

  @Post('initial-stock/csv')
  @RequirePermissions(permission(ModuleName.INVENTORY, 'adjust'))
  @UseInterceptors(FileInterceptor('file', { limits: FILE_LIMITS }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Import initial stock levels from CSV (sku, warehouse, quantity, unit_cost)' })
  importInitialStock(
    @CurrentUser() user: { tenantId: string | null; id: string },
    @UploadedFile() file?: CsvUploadFile,
  ) {
    return this.handle(user, 'initial-stock', file);
  }
}
