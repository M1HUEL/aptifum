import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../api/client';
import { ErrorBanner, LoadingBlock, PageHeader } from '../components/ui';
import { Button, Checkbox, TextInput } from '../components/forms';
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

export function SettingsPage() {
  const toast = useToast();
  const [catalog, setCatalog] = useState<StatesCatalog>({});
  const [nexus, setNexus] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [country, setCountry] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch<UsSalesTaxConfig>('/api/v1/tax/us-sales-tax'),
      apiFetch<StatesCatalog>('/api/v1/tax/us-sales-tax/states'),
    ])
      .then(([config, states]) => {
        setCatalog(states);
        setCountry(config.country);
        setNexus(new Set(config.nexusStates));
        const percentOverrides: Record<string, string> = {};
        for (const [code, rate] of Object.entries(config.rates)) {
          percentOverrides[code] = String(rate * 100);
        }
        setOverrides(percentOverrides);
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'Could not load settings.');
      })
      .finally(() => setLoading(false));
  }, []);

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
          setError(`Invalid rate for ${code}: expected a percentage between 0 and 50.`);
          return;
        }
        rates[code] = Math.round(percent * 100) / 10000;
      }
    }
    setError(null);
    setSaving(true);
    try {
      await apiFetch('/api/v1/tax/us-sales-tax', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nexusStates, rates }),
      });
      toast.toast('US sales tax settings saved.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Settings" subtitle="Company and tax configuration" />
      {error ? <ErrorBanner message={error} /> : null}
      {loading ? <LoadingBlock /> : null}
      {!loading ? (
        <section className="card">
          <h2>US sales tax</h2>
          {country && country !== 'US' ? (
            <p className="muted">
              Sales tax is only calculated automatically for US-based tenants. Your country is set
              to <strong>{country}</strong>.
            </p>
          ) : null}
          <p className="muted">
            Mark the states where you have sales tax nexus. Sales to customers in those states will
            be taxed at the default state rate unless you override it below.
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nexus</th>
                  <th>State</th>
                  <th className="num">Default rate</th>
                  <th>Override (%)</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(catalog)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([code, info]) => (
                    <tr key={code}>
                      <td>
                        <Checkbox
                          label=""
                          aria-label={`Nexus in ${code}`}
                          checked={nexus.has(code)}
                          onChange={() => toggleNexus(code)}
                        />
                      </td>
                      <td>
                        {code} — {info.name}
                      </td>
                      <td className="num">{formatPercent(info.rate)}</td>
                      <td>
                        {nexus.has(code) ? (
                          <TextInput
                            aria-label={`Override rate for ${code}`}
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
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: '1rem' }}>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? 'Saving…' : 'Save settings'}
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
