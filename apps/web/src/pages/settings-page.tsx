import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorBanner, LoadingBlock, PageHeader } from '../components/ui';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { useApiMutation, useApiQuery } from '../api/hooks';
import { useToast } from '../components/toast';

interface UsSalesTaxConfig {
  nexusStates: string[];
  rates: Record<string, number>;
  country: string;
}

interface UsStateInfo {
  name: string;
  rate: number;
}

type StatesCatalog = Record<string, UsStateInfo>;

interface UpdateUsSalesTaxDto {
  nexusStates: string[];
  rates: Record<string, number>;
}

export function SettingsPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [nexus, setNexus] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const configQuery = useApiQuery<UsSalesTaxConfig>(['tax', 'us-sales-tax'], '/api/v1/tax/us-sales-tax');
  const statesQuery = useApiQuery<StatesCatalog>(['tax', 'us-sales-tax', 'states'], '/api/v1/tax/us-sales-tax/states');

  const catalog = statesQuery.data ?? {};
  const country = configQuery.data?.country ?? null;

  useEffect(() => {
    if (!configQuery.data) return;
    setNexus(new Set(configQuery.data.nexusStates));
    const percentOverrides: Record<string, string> = {};
    for (const [code, rate] of Object.entries(configQuery.data.rates)) {
      percentOverrides[code] = String(rate * 100);
    }
    setOverrides(percentOverrides);
  }, [configQuery.data]);

  const saveMutation = useApiMutation<UpdateUsSalesTaxDto, unknown>('/api/v1/tax/us-sales-tax', 'PUT');

  const toggleNexus = (code: string) => {
    setNexus((current) => {
      const next = new Set(current);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const setOverride = (code: string, value: string) => {
    setOverrides((current) => ({ ...current, [code]: value }));
  };

  const save = async () => {
    const nexusStates = Array.from(nexus).sort();
    const rates: Record<string, number> = {};
    for (const code of nexusStates) {
      const raw = overrides[code]?.trim();
      if (raw) {
        const percent = Number(raw);
        if (!Number.isFinite(percent) || percent < 0 || percent > 50) {
          setError(t('settings.invalidRate', { code }));
          return;
        }
        rates[code] = Math.round(percent * 100) / 10000;
      }
    }
    setError(null);
    saveMutation.mutate(
      { nexusStates, rates },
      {
        onSuccess: () => {
          toast.toast(t('settings.saved'));
          configQuery.refetch();
        },
        onError: (err) => setError(err.message),
      },
    );
  };

  const loading = configQuery.isPending || statesQuery.isPending;
  const loadError = configQuery.error?.message ?? statesQuery.error?.message ?? error;

  return (
    <>
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />
      {loadError ? <ErrorBanner message={loadError} /> : null}
      {loading ? <LoadingBlock /> : null}
      {!loading ? (
        <section className="card">
          <h2>{t('settings.usSalesTax')}</h2>
          {country && country !== 'US' ? (
            <p className="muted">
              {t('settings.usOnlyNoteStart')}
              <strong>{country}</strong>
              {t('settings.usOnlyNoteEnd')}
            </p>
          ) : null}
          <p className="muted">{t('settings.nexusInstructions')}</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('settings.nexus')}</TableHead>
                <TableHead>{t('settings.state')}</TableHead>
                <TableHead className="text-right">{t('settings.defaultRate')}</TableHead>
                <TableHead>{t('settings.overridePercent')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(catalog)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([code, info]) => (
                  <TableRow key={code}>
                    <TableCell>
                      <Checkbox
                        aria-label={t('settings.nexusInCode', { code })}
                        checked={nexus.has(code)}
                        onCheckedChange={() => toggleNexus(code)}
                      />
                    </TableCell>
                    <TableCell>
                      {code} — {info.name}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge tone="info">{formatPercent(info.rate)}</Badge>
                    </TableCell>
                    <TableCell>
                      {nexus.has(code) ? (
                        <input
                          className="h-9 w-24 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          aria-label={t('settings.overrideRateFor', { code })}
                          type="number"
                          min="0"
                          max="50"
                          step="0.01"
                          placeholder={String(info.rate * 100)}
                          value={overrides[code] ?? ''}
                          onChange={(event) => setOverride(code, event.target.value)}
                        />
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
          <div className="mt-4">
            <Button onClick={() => void save()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? t('common.saving') : t('settings.saveSettings')}
            </Button>
          </div>
        </section>
      ) : null}
    </>
  );
}

function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(rate * 100 % 1 === 0 ? 0 : 2)}%`;
}
