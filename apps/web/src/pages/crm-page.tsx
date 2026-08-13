import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import type { Customer, Paginated } from '../api/types';
import { LeadPanel } from '../components/crm/lead-panel';
import { OpportunityPanel } from '../components/crm/opportunity-panel';
import { ContactPanel } from '../components/crm/contact-panel';
import { ActivityPanel } from '../components/crm/activity-panel';
import { usePermission } from '../auth/auth-context';

type CrmTab = 'leads' | 'opportunities' | 'contacts' | 'activities';

const TABS: Array<{ key: CrmTab; label: string; permission: string }> = [
  { key: 'leads', label: 'Leads', permission: 'crm:read' },
  { key: 'opportunities', label: 'Opportunities', permission: 'crm:read' },
  { key: 'contacts', label: 'Contacts', permission: 'crm:read' },
  { key: 'activities', label: 'Activities', permission: 'crm:read' },
];

export function CrmPage() {
  const [tab, setTab] = useState<CrmTab>('leads');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const can = usePermission();

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
            onClick={() => setTab(item.key)}
          >
            {item.label}
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
