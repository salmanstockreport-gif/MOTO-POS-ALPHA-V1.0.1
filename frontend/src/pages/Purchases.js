import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import PageHeader, { Empty } from "@/components/PageHeader";
import { api, inr, errMsg, todayStr, GST_RATES } from "@/lib/api";

function ItemSearch({ onPick }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState([]);
  useEffect(() => {
    if (!q.trim()) return setRes([]);
    const t = setTimeout(() => api.get("/items", { params: { q, limit: 8 } }).then((r) => setRes(r.data.items)), 250);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className="relative">
      <Input data-testid="purchase-item-search" placeholder="Search part to add…" value={q} onChange={(e) => setQ(e.target.value)} />
      {res.length > 0 && <div className="absolute z-30 w-full mt-1 rounded-md border bg-popover shadow-lg max-h-56 overflow-auto">
        {res.map((i) => <button key={i.id} data-testid={`purchase-item-option-${i.part_no}`} onClick={() => { onPick(i); setQ(""); }}
          className="w-full text-left px-3 py-2 text-sm hover:bg-accent"><span className="font-mono text-primary mr-2">{i.part_no}</span>{i.name}</button>)}
      </div>}
    </div>
  );
}

function PurchaseDialog({ open, onOpenChange, onSaved }) {
  const [sups, setSups] = useState([]);
  const [f, setF] = useState({ supplier_id: "", bill_no: "", date: todayStr(), paid: "", mode: "cash", notes: "" });
  const [lines, setLines] = useState([]);
  useEffect(() => {
    if (!open) return;
    api.get("/suppliers", { params: { limit: 1000 } }).then((r) => setSups(r.data));
    setF({ supplier_id: "", bill_no: "", date: todayStr(), paid: "", mode: "cash", notes: "" }); setLines([]);
  }, [open]);
  const upd = (idx, p) => setLines(lines.map((l, i) => (i === idx ? { ...l, ...p } : l)));
  const total = lines.reduce((s, l) => s + l.qty * l.cost * (1 + l.gst_rate / 100), 0);
  const save = async () => {
    if (!f.supplier_id) return toast.error("Select supplier");
    if (!lines.length) return toast.error("Add items");
    try {
      await api.post("/purchases", { ...f, paid: Number(f.paid) || 0,
        lines: lines.map((l) => ({ item_id: l.item_id, qty: Number(l.qty), cost: Number(l.cost), gst_rate: Number(l.gst_rate) })) });
      toast.success("Purchase saved · stock updated"); onSaved(); onOpenChange(false);
    } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto" data-testid="purchase-dialog">
        <DialogHeader><DialogTitle>New purchase entry</DialogTitle></DialogHeader>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="space-y-1"><Label>Supplier *</Label>
            <Select value={f.supplier_id} onValueChange={(v) => setF({ ...f, supplier_id: v })}>
              <SelectTrigger data-testid="purchase-supplier-select"><SelectValue placeholder="Select supplier" /></SelectTrigger>
              <SelectContent>{sups.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>{sups.length === 0 && <div className="text-xs text-amber-500">Add a supplier first</div>}</div>
          <div className="space-y-1"><Label>Supplier bill no</Label><Input data-testid="purchase-bill-input" value={f.bill_no} onChange={(e) => setF({ ...f, bill_no: e.target.value })} /></div>
          <div className="space-y-1"><Label>Date</Label><Input data-testid="purchase-date-input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
        </div>
        <ItemSearch onPick={(i) => !lines.find((l) => l.item_id === i.id) && setLines([...lines, { item_id: i.id, part_no: i.part_no, name: i.name, qty: 1, cost: i.purchase_price || 0, gst_rate: i.gst_rate }])} />
        <div className="space-y-2">
          {lines.map((l, idx) => (
            <div key={l.item_id} className="grid grid-cols-12 gap-2 items-center border rounded-md p-2" data-testid={`purchase-line-${l.part_no}`}>
              <div className="col-span-12 sm:col-span-4 text-sm"><span className="font-mono text-primary text-xs">{l.part_no}</span><div className="truncate">{l.name}</div></div>
              <Input className="col-span-3 sm:col-span-2 h-9" type="number" data-testid={`purchase-qty-${l.part_no}`} value={l.qty} onChange={(e) => upd(idx, { qty: e.target.value })} />
              <Input className="col-span-4 sm:col-span-2 h-9" type="number" data-testid={`purchase-cost-${l.part_no}`} value={l.cost} onChange={(e) => upd(idx, { cost: e.target.value })} />
              <Select value={String(l.gst_rate)} onValueChange={(v) => upd(idx, { gst_rate: Number(v) })}>
                <SelectTrigger className="col-span-3 sm:col-span-2 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{GST_RATES.map((r) => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent>
              </Select>
              <div className="col-span-2 sm:col-span-2 flex items-center justify-end gap-1"><span className="font-mono text-xs hidden sm:inline">{inr(l.qty * l.cost * (1 + l.gst_rate / 100))}</span>
                <button onClick={() => setLines(lines.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4 text-destructive" /></button></div>
            </div>
          ))}
          {lines.length > 0 && <div className="text-xs text-muted-foreground">Qty · Cost (excl. GST) · GST%</div>}
        </div>
        <div className="grid sm:grid-cols-3 gap-3 items-end">
          <div className="space-y-1"><Label>Paid now (₹)</Label><Input data-testid="purchase-paid-input" type="number" value={f.paid} onChange={(e) => setF({ ...f, paid: e.target.value })} /></div>
          <div className="space-y-1"><Label>Mode</Label>
            <Select value={f.mode} onValueChange={(v) => setF({ ...f, mode: v })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["cash", "upi", "card", "bank"].map((m) => <SelectItem key={m} value={m}>{m.toUpperCase()}</SelectItem>)}</SelectContent></Select></div>
          <div className="text-right"><div className="label-xs">Bill total</div><div className="font-mono text-2xl font-bold" data-testid="purchase-total">{inr(total)}</div></div>
        </div>
        <DialogFooter><Button data-testid="purchase-save-btn" onClick={save}>Save purchase</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Purchases() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(null);
  const load = () => api.get("/purchases", { params: { q } }).then((r) => setRows(r.data));
  useEffect(() => { load(); }, [q]); // eslint-disable-line
  return (
    <div>
      <PageHeader title="Purchases" sub="Stock inward from suppliers — updates stock & supplier ledger">
        <Button data-testid="new-purchase-btn" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />New purchase</Button>
      </PageHeader>
      <Input data-testid="purchase-search-input" className="mb-4 max-w-sm" placeholder="Search number, supplier, bill no" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm" data-testid="purchases-table">
          <thead className="bg-muted/60 label-xs"><tr><th className="text-left px-4 py-3">Number</th><th className="text-left px-4">Supplier</th>
            <th className="text-left px-4 hidden sm:table-cell">Date</th><th className="text-right px-4">Total</th><th className="text-right px-4">Due</th></tr></thead>
          <tbody>{rows.map((p) => (
            <tr key={p.id} className="border-t cursor-pointer hover:bg-accent/40" onClick={() => setView(p)} data-testid={`purchase-row-${p.id}`}>
              <td className="px-4 py-3 font-mono text-xs">{p.number}<div className="text-muted-foreground">{p.bill_no}</div></td>
              <td className="px-4">{p.supplier_name}</td><td className="px-4 font-mono text-xs hidden sm:table-cell">{p.date}</td>
              <td className="px-4 text-right font-mono">{inr(p.total)}</td><td className={`px-4 text-right font-mono ${p.due > 0 ? "text-rose-500" : ""}`}>{inr(p.due)}</td>
            </tr>))}</tbody>
        </table>
        {rows.length === 0 && <Empty text="No purchases yet" />}
      </div>
      <PurchaseDialog open={open} onOpenChange={setOpen} onSaved={load} />
      <Dialog open={!!view} onOpenChange={(v) => !v && setView(null)}>
        <DialogContent className="sm:max-w-2xl" data-testid="purchase-view-dialog">
          <DialogHeader><DialogTitle>{view?.number} · {view?.supplier_name}</DialogTitle></DialogHeader>
          <div className="text-sm space-y-1">{view?.lines.map((l) => (
            <div key={l.item_id} className="flex justify-between border-b py-1.5"><span><span className="font-mono text-xs text-primary mr-2">{l.part_no}</span>{l.name} × {l.qty}</span><span className="font-mono">{inr(l.total)}</span></div>))}
            <div className="flex justify-between pt-2 font-bold"><span>Total (tax {inr(view?.tax_total)})</span><span className="font-mono">{inr(view?.total)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Paid / Due</span><span className="font-mono">{inr(view?.paid)} / {inr(view?.due)}</span></div></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
