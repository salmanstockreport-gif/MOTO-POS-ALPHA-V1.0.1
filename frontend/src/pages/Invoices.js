import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader, { Empty } from "@/components/PageHeader";
import { api, inr } from "@/lib/api";

const STATUS = { paid: "text-emerald-500", partial: "text-amber-500", credit: "text-rose-500" };
const PAGE = 50;

export default function Invoices() {
  const nav = useNavigate();
  const [f, setF] = useState({ q: "", date_from: "", date_to: "", status: "all" });
  const [page, setPage] = useState(0);
  const [data, setData] = useState({ invoices: [], total: 0 });
  useEffect(() => {
    const t = setTimeout(() => api.get("/invoices", { params: { ...f, status: f.status === "all" ? "" : f.status, limit: PAGE, skip: page * PAGE } })
      .then((r) => setData(r.data)), 250);
    return () => clearTimeout(t);
  }, [f, page]);
  const set = (k) => (v) => { setPage(0); setF({ ...f, [k]: v?.target ? v.target.value : v }); };
  const sum = data.invoices.filter((i) => i.status === "active").reduce((s, i) => s + i.grand_total, 0);

  return (
    <div>
      <PageHeader title="Invoices" sub={`${data.total} invoices · page total ${inr(sum)}`} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="relative col-span-2 sm:col-span-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input data-testid="invoice-search-input" className="pl-9" placeholder="No, customer, phone, vehicle" value={f.q} onChange={set("q")} /></div>
        <Input data-testid="invoice-from-input" type="date" value={f.date_from} onChange={set("date_from")} />
        <Input data-testid="invoice-to-input" type="date" value={f.date_to} onChange={set("date_to")} />
        <Select value={f.status} onValueChange={set("status")}>
          <SelectTrigger data-testid="invoice-status-select" className="col-span-2 sm:col-span-1"><SelectValue /></SelectTrigger>
          <SelectContent>{["all", "paid", "partial", "credit", "cancelled"].map((s) => <SelectItem key={s} value={s}>{s.toUpperCase()}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm" data-testid="invoices-table">
          <thead className="bg-muted/60 label-xs"><tr><th className="text-left px-4 py-3">Invoice</th><th className="text-left px-4">Customer</th>
            <th className="text-left px-4 hidden md:table-cell">By</th><th className="text-right px-4">Total</th><th className="text-right px-4 hidden sm:table-cell">Due</th><th className="text-right px-4">Status</th></tr></thead>
          <tbody>{data.invoices.map((v) => (
            <tr key={v.id} className="border-t cursor-pointer hover:bg-accent/40" onClick={() => nav(`/invoices/${v.id}`)} data-testid={`invoice-row-${v.id}`}>
              <td className="px-4 py-3"><div className="font-mono text-xs font-bold">{v.number}</div><div className="text-[11px] text-muted-foreground">{v.date}</div></td>
              <td className="px-4"><div>{v.customer?.name}</div><div className="text-[11px] text-muted-foreground">{v.customer?.phone} {v.vehicle_no}</div></td>
              <td className="px-4 hidden md:table-cell text-muted-foreground">{v.created_by}</td>
              <td className="px-4 text-right font-mono font-semibold">{inr(v.grand_total)}</td>
              <td className="px-4 text-right font-mono hidden sm:table-cell">{inr(v.due)}{v.due > 0 && v.due_date && <div className={`text-[10px] ${v.due_date < new Date().toISOString().slice(0, 10) ? "text-rose-500" : "text-muted-foreground"}`}>due {v.due_date}</div>}</td>
              <td className={`px-4 text-right text-[11px] font-bold uppercase ${v.status === "cancelled" ? "text-muted-foreground line-through" : STATUS[v.payment_status]}`}>{v.status === "cancelled" ? "cancelled" : v.payment_status}</td>
            </tr>))}</tbody>
        </table>
        {data.invoices.length === 0 && <Empty text="No invoices found" />}
      </div>
      {data.total > PAGE && <div className="flex justify-end gap-3 mt-4 items-center text-sm">
        <Button size="sm" variant="outline" disabled={!page} onClick={() => setPage(page - 1)} data-testid="invoices-prev-btn">Prev</Button>
        <span>Page {page + 1}</span>
        <Button size="sm" variant="outline" disabled={(page + 1) * PAGE >= data.total} onClick={() => setPage(page + 1)} data-testid="invoices-next-btn">Next</Button></div>}
    </div>
  );
}
