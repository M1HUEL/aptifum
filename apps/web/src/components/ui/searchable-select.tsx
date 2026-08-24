import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../lib/cn';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

export interface SearchableOption {
  value: string;
  label: string;
}

export interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchableOption[];
  placeholder?: string;
  emptyMessage?: string;
  ariaLabel?: string;
  disabled?: boolean;
  id?: string;
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  emptyMessage,
  ariaLabel,
  disabled,
  id,
}: SearchableSelectProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) => option.label.toLowerCase().includes(q) || option.value.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  return (
    <Select value={value} onValueChange={onChange} open={open} onOpenChange={setOpen} disabled={disabled}>
      <SelectTrigger aria-label={ariaLabel} id={id}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <div className="sticky top-0 z-10 mb-1 border-b border-border bg-surface px-1 pb-1.5">
          <input
            ref={inputRef}
            type="text"
            value={query}
            aria-label={t('common.searchOptions')}
            placeholder={t('common.searchOptions')}
            className={cn(
              'h-9 w-full rounded border border-border bg-surface px-3 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary',
            )}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.preventDefault();
              if (!event.ctrlKey && !event.metaKey && !event.altKey) {
                event.stopPropagation();
              }
            }}
          />
        </div>
        {filteredOptions.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted">{emptyMessage ?? t('common.noMatches')}</div>
        ) : (
          filteredOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
