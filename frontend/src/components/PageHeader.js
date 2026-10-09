export default function PageHeader({ title, sub, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 fade-up">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" data-testid="page-title">{title}</h1>
        {sub && <p className="text-sm text-muted-foreground mt-1">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Stat({ label, value, tone = "", testid, icon: Icon }) {
  return (
    <div className="rounded-lg border bg-card p-4 sm:p-5 fade-up" data-testid={testid}>
      <div className="flex items-center justify-between label-xs">{label}{Icon && <Icon className="h-4 w-4" />}</div>
      <div className={`mt-2 font-mono font-bold tracking-tight text-xl sm:text-2xl ${tone}`}>{value}</div>
    </div>
  );
}

export function Empty({ text }) {
  return <div className="py-12 text-center text-sm text-muted-foreground" data-testid="empty-state">{text}</div>;
}
