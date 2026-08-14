import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { apiFetch } from '../api/client';
import type { Customer, Paginated } from '../api/types';
import { LeadPanel } from '../components/crm/lead-panel';
import { OpportunityPanel } from '../components/crm/opportunity-panel';
import { ContactPanel } from '../components/crm/contact-panel';
import { ActivityPanel } from '../components/crm/activity-panel';
import { usePermission } from '../auth/auth-context';

type CrmTab = 'leads' | 'opportunities' | 'contacts' | 'activities';

const TABS: Array<{ key: CrmTab; labelKey: string; permission: string }> = [
  { key: 'leads', labelKey: 'crm.leads', permission: 'crm:read' },
  { key: 'opportunities', labelKey: 'crm.opportunities', permission: 'crm:read' },
  { key: 'contacts', labelKey: 'crm.contacts', permission: 'crm:read' },
  { key: 'activities', labelKey: 'crm.activities', permission: 'crm:read' },
];

function parseTab(raw: string | null): CrmTab {
  return TABS.some((item) => item.key === raw) ? (raw as CrmTab) : 'leads';
}

export function CrmPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<CrmTab>(() => parseTab(searchParams.get('tab')));
  const [customers, setCustomers] = useState<Customer[]>([]);
  const can = usePermission();

  useEffect(() => {
    setTab(parseTab(searchParams.get('tab')));
  }, [searchParams]);

  const changeTab = (next: CrmTab) => {
    setTab(next);
    const params = new URLSearchParams(searchParams);
    params.set('tab', next);
    setSearchParams(params);
  };

  useEffect(() => {
    let cancelled = false;
    void apiFetch<Paginated<Customer>>('/api/v1/sales/customers?page=1&limit=100')
      .then((result) => {
        if (!cancelled) setCustomers(result.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleTabs = TABS.filter((item) => can(item.permission));

  return (
    <>
      <div className="tabs">
        {visibleTabs.map((item) => (
          <button
            key={item.key}
            type="button"
            className={tab === item.key ? 'tab tab-active' : 'tab'}
            onClick={() => changeTab(item.key)}
          >
            {t(item.labelKey)}
          </button>
        ))}
      </div>
      {tab === 'leads' ? <LeadPanel /> : null}
      {tab === 'opportunities' ? <OpportunityPanel customers={customers} /> : null}
      {tab === 'contacts' ? <ContactPanel customers={customers} /> : null}
      {tab === 'activities' ? <ActivityPanel /> : null}
    </>
  );
}
