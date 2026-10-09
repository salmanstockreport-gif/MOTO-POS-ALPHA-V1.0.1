import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { IndianRupee, Wallet, AlertTriangle, CreditCard, ScanBarcode } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageHeader, { Stat, Empty } from "@/components/PageHeader";
import { api, inr } from "@/lib/api";

export default function Dashboard() {
  const [d, setD] = useState(null);
  useEffect(() => {
    const load = () => api.get("/dashboard").then((r) => setD(r.data));
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);
  if (!d) return <div className="label-xs">Loading dashboard…</div>;

  return (
    <div>
      <PageHeader title="Dashboard" sub="Live counter overview — refreshes every 30s across all devices">
        <Button asChild data-testid="dashboard-new-bill-btn"><Link to="/pos"><ScanBarcode className="h-4 w-4 mr-2" />New Bill</Link></Button>
      </PageHeader>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <Stat label="Today's Sales" value={inr(d.today_sales)} icon={IndianRupee} tone="text-primary" testid="stat-today-sales" />
        <Stat label="Collected Today" value={inr(d.today_collection)} icon={Wallet} tone="text-emerald-500" testid="stat-today-collection" />
        <Stat label="Total Receivable" value={inr(d.receivable)} icon={CreditCard} tone="text-rose-500" testid="stat-receivable" />
        <Stat label="Low Stock Items" value={d.low_stock_count} icon={AlertTriangle} tone="text-amber-500" testid="stat-low-stock" />
      </div>
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 rounded-lg border bg-card p-5">
          <div className="flex justify-between mb-4"><h3 className="font-semibold">Last 7 days sales</h3>
            <div className="label-xs">{d.today_count} bills today · Credit {inr(d.today_credit)}</div></div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.series}>
                <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" width={50} />
                <Tooltip formatter={(v) => inr(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {Object.entries(d.modes).map(([m, v]) => (
              <span key={m} className="text-xs font-mono px-2 py-1 rounded border bg-muted" data-testid={`mode-total-${m}`}>{m.toUpperCase()} {inr(v)}</span>
            ))}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <div className="flex justify-between mb-3"><h3 className="font-semibold">Low stock alerts</h3>
            <Link to="/items?low=1" className="text-xs text-primary" data-testid="view-low-stock-link">View all</Link></div>
          {d.low_stock.length === 0 ? <Empty text="All stocked up" /> : (
            <div className="divide-y">
              {d.low_stock.map((i) => (
                <div key={i.id} className="py-2 flex justify-between gap-3 text-sm" data-testid={`low-stock-${i.part_no}`}>
                  <div className="min-w-0"><div className="font-mono text-xs text-primary">{i.part_no}</div><div className="truncate">{i.name}</div></div>
                  <div className={`font-mono font-bold ${i.stock <= 0 ? "text-rose-500" : "text-amber-500"}`}>{i.stock}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-lg border bg-card p-5">
          <h3 className="font-semibold mb-3">Recent invoices</h3>
          {d.recent.length === 0 ? <Empty text="No invoices yet" /> : (
            <div className="divide-y">
              {d.recent.map((v) => (
                <Link key={v.id} to={`/invoices/${v.id}`} className="py-2.5 flex justify-between gap-3 text-sm hover:bg-accent/50 px-2 -mx-2 rounded" data-testid={`recent-invoice-${v.id}`}>
                  <div className="min-w-0"><div className="font-mono text-xs">{v.number}</div><div className="truncate">{v.customer?.name}</div></div>
                  <div className="text-right"><div className="font-mono font-semibold">{inr(v.grand_total)}</div>
                    <div className={`text-[10px] uppercase font-bold ${v.status === "cancelled" ? "text-muted-foreground line-through" : v.due > 0 ? "text-rose-500" : "text-emerald-500"}`}>{v.status === "cancelled" ? "cancelled" : v.payment_status}</div></div>
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-lg border bg-card p-5">
          <h3 className="font-semibold mb-3">Top parts (7 days)</h3>
          {d.top_items.length === 0 ? <Empty text="No sales yet" /> : d.top_items.map((t, i) => (
            <div key={t.part_no} className="py-2 flex justify-between text-sm gap-2">
              <div className="min-w-0"><span className="font-mono text-xs text-muted-foreground mr-2">#{i + 1}</span><span className="truncate">{t.name}</span></div>
              <div className="font-mono text-xs whitespace-nowrap">{t.qty} · {inr(t.amt)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
