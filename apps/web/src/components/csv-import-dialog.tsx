import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Upload } from 'lucide-react';
import { ApiError, apiFetch } from '../api/client';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from './ui/dialog';

export type CsvImportType = 'products' | 'customers' | 'suppliers' | 'initial-stock';

export interface ImportRowError {
  row: number;
  errors: string[];
}

export interface ImportResult {
  type: CsvImportType;
  total: number;
  imported: number;
  skipped: number;
  errors: ImportRowError[];
}

const COLUMNS: Record<CsvImportType, { required: string[]; optional: string[] }> = {
  products: {
    required: ['sku', 'name'],
    optional: [
      'category',
      'brand',
      'unit_of_measure',
      'barcode',
      'purchase_price',
      'sale_price',
      'description',
      'enabled',
    ],
  },
  customers: {
    required: ['code', 'trade_name'],
    optional: [
      'legal_name',
      'tax_id',
      'email',
      'phone',
      'address',
      'currency',
      'credit_limit',
      'state',
      'price_category',
      'tax_exempt',
      'active',
    ],
  },
  suppliers: {
    required: ['code', 'trade_name'],
    optional: [
      'legal_name',
      'tax_id',
      'email',
      'phone',
      'address',
      'currency',
      'payment_terms',
      'credit_limit',
      'active',
    ],
  },
  'initial-stock': {
    required: ['sku', 'warehouse', 'quantity'],
    optional: ['unit_cost'],
  },
};

interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: CsvImportType;
  onImported?: () => void;
}

export function CsvImportDialog({ open, onOpenChange, type, onImported }: CsvImportDialogProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setBusy(false);
      setError(null);
      setResult(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  }, [open]);

  const pickFile = (selected: File | null) => {
    if (selected) {
      setFile(selected);
      setError(null);
      setResult(null);
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    pickFile(event.target.files?.[0] ?? null);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    pickFile(event.dataTransfer.files?.[0] ?? null);
  };

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiFetch<ImportResult>(`/api/v1/imports/${type}/csv`, {
        method: 'POST',
        body: formData,
      });
      setResult(res);
      onImported?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('imports.uploadError'));
    } finally {
      setBusy(false);
    }
  };

  const columns = COLUMNS[type];
  const fileSizeKb = file ? (file.size / 1024).toFixed(1) : '0';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader title={t('imports.title')} />
        <div className="mb-3 text-[13px] text-muted">
          {t('imports.subtitle')}:{' '}
          {t(`imports.type${type.charAt(0).toUpperCase()}${type.slice(1).replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())}`)}
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click();
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => void handleDrop(event)}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-ui border border-dashed px-4 py-8 text-center ${
            dragging ? 'border-primary bg-primary/5' : 'border-border bg-surface'
          }`}
        >
          <Upload className="size-6 text-muted" />
          <div className="text-[13px] font-semibold">{t('imports.selectFile')}</div>
          <div className="text-[12px] text-muted">{t('imports.dropHint')}</div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleChange}
        />

        {file ? (
          <div className="flex items-center gap-2 rounded-ui border border-border bg-surface px-[14px] py-2.5 text-[13px]">
            <FileText className="size-4 shrink-0 text-muted" />
            <span className="min-w-0 flex-1 truncate">{file.name}</span>
            <span className="shrink-0 tabular-nums text-muted">{fileSizeKb} KB</span>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 max-[480px]:grid-cols-1">
          <div>
            <div className="mb-1 text-[12px] font-semibold uppercase tracking-[0.04em] text-muted">
              {t('imports.requiredColumns')}
            </div>
            <code className="text-[12px] leading-5">{columns.required.join(', ')}</code>
          </div>
          <div>
            <div className="mb-1 text-[12px] font-semibold uppercase tracking-[0.04em] text-muted">
              {t('imports.optionalColumns')}
            </div>
            <code className="text-[12px] leading-5">
              {columns.optional.length > 0 ? columns.optional.join(', ') : '—'}
            </code>
          </div>
        </div>

        <p className="text-[12px] text-muted">{t('imports.duplicateSkipped')}</p>

        {error ? (
          <div className="rounded-ui border border-danger/40 bg-danger-bg px-[14px] py-2.5 text-danger">
            {error}
          </div>
        ) : null}

        {result ? (
          <div className="rounded-ui border border-border bg-surface p-4">
            <div className="mb-2 flex gap-6">
              <div>
                <div className="text-[12px] uppercase tracking-[0.04em] text-muted">
                  {t('imports.rowsTotal', { count: result.total })}
                </div>
                <div className="text-xl font-semibold tabular-nums">{result.total}</div>
              </div>
              <div>
                <div className="text-[12px] uppercase tracking-[0.04em] text-muted">
                  {t('imports.imported')}
                </div>
                <div className="text-xl font-semibold tabular-nums text-success">
                  {result.imported}
                </div>
              </div>
              <div>
                <div className="text-[12px] uppercase tracking-[0.04em] text-muted">
                  {t('imports.skipped')}
                </div>
                <div className="text-xl font-semibold tabular-nums">{result.skipped}</div>
              </div>
              <div>
                <div className="text-[12px] uppercase tracking-[0.04em] text-muted">
                  {t('imports.errorsCount')}
                </div>
                <div className="text-xl font-semibold tabular-nums text-danger">
                  {result.errors.length}
                </div>
              </div>
            </div>
            {result.errors.length > 0 ? (
              <ul className="max-h-[220px] overflow-auto rounded-ui border border-border bg-bg px-3 py-2 text-[12px]">
                {result.errors.map((entry) => (
                  <li key={entry.row} className="border-b border-border py-1.5 last:border-b-0">
                    <span className="font-semibold">
                      {t('imports.rowError', { row: entry.row })}:
                    </span>{' '}
                    {entry.errors.join('; ')}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button
            variant="outline"
            type="button"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            {t('common.close')}
          </Button>
          <Button type="button" disabled={!file || busy} loading={busy} onClick={() => void upload()}>
            {busy ? t('imports.importing') : t('imports.importButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
