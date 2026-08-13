import { Link } from 'react-router-dom';
import { formatMoney } from '../ui';
import { Button } from '../ui/button';

export interface CompletedSale {
  id: string;
  number: string;
  total: number;
  paidAmount: number;
  balanceDue: number;
  currency: string;
}

export function PosSuccess({
  sale,
  onDownloadPdf,
  onReset,
}: {
  sale: CompletedSale;
  onDownloadPdf: (sale: CompletedSale) => void;
  onReset: () => void;
}) {
  return (
    <div className="card pos-success">
      <div className="success-banner">Sale completed.</div>
      <h3 className="card-title">Invoice {sale.number}</h3>
      <div className="detail-grid">
        <div className="detail-item">
          <div className="detail-label">Total</div>
          <div className="detail-value num">{formatMoney(sale.total, sale.currency)}</div>
        </div>
        <div className="detail-item">
          <div className="detail-label">Paid</div>
          <div className="detail-value num">{formatMoney(sale.paidAmount, sale.currency)}</div>
        </div>
        <div className="detail-item">
          <div className="detail-label">Balance due</div>
          <div className="detail-value num">
            {sale.balanceDue > 0 ? formatMoney(sale.balanceDue, sale.currency) : '—'}
          </div>
        </div>
      </div>
      <div className="pos-success-actions">
        <Button variant="ghost" onClick={() => onDownloadPdf(sale)}>
          Download PDF
        </Button>
        <Link to="/invoices" className="btn">
          View invoices
        </Link>
        <Button onClick={onReset}>New sale</Button>
      </div>
    </div>
  );
}
