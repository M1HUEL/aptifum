import type { ReactNode } from 'react';

interface DetailRow {
  label: string;
  value: ReactNode;
}

export function DetailTable({ rows }: { rows: DetailRow[] }) {
  return (
    <div className="mb-3.5 overflow-hidden rounded-ui border border-border bg-surface shadow-(--shadow)">
      <table className="w-full border-collapse [&_tr:last-child>td]:border-b-0">
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              <td className="w-[45%] whitespace-nowrap border-b border-border px-[14px] py-2.5 align-top text-[12px] uppercase tracking-[0.04em] text-muted">
                {row.label}
              </td>
              <td className="border-b border-border px-[14px] py-2.5 align-top text-right tabular-nums">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h4 className="mb-2 mt-5 flex items-center gap-2 border-t border-border pt-4 text-[14px] font-semibold text-text">
      {children}
    </h4>
  );
}
