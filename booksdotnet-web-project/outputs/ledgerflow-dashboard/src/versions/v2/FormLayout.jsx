import { peso } from '../../module-ui.jsx';

export function FormGrid({ children, className = '' }) {
  return <div className={`v2-field-grid ${className}`.trim()}>{children}</div>;
}

export function PaymentSummary({ amount, allocated }) {
  return <dl className="v2-payment-summary" aria-label="Payment allocation summary">
    {[['Payment Amount', amount], ['Allocated Amount', allocated], ['Unapplied Amount', amount - allocated]].map(([label, value]) =>
      <div key={label}><dt>{label}</dt><dd>{peso(value)}</dd></div>)}
  </dl>;
}
