import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, IndianRupee, Pencil, Printer, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import PartyDialog from "@/components/PartyDialog";
import { Empty } from "@/components/PageHeader";
import { useAuth } from "@/context/AuthContext";
import { api, inr, errMsg, todayStr } from "@/lib/api";

function PaymentDialog({ open, onOpenChange, path, party, onSaved, isC }) {
  const [f, setF] = useState({ amount: "", mode: "cash", note: "", date: todayStr() });
  useEffect(() => { if (open) setF({ amount: party?.balance > 0 ? party.balance : "", mode: "cash", note: "", date: todayStr() }); }, [open, party]);
  const save = async () => {
    if (!(Number(f.amount) > 0)) return toast.error("Enter a valid amount");
    try {
      const { data } = await api.post(`/${path}/${party.id}/payments`, { ...f, amount: Number(f.amount) });
      toast.success(`Payment recorded · ${data.ref}`); onSaved(); onOpenChange(false);
    } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="payment-dialog">
        <DialogHeader><DialogTitle>{isC ? "Receive payment" : "Make payment"} · {party?.name}</DialogTitle></DialogHeader>
        <div className="text-sm text-muted-foreground">Current balance <b className="font-mono text-foreground">{inr(party?.balance)}</b></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1 col-span-2"><Label>Amount (₹)</Label><Input data-testid="payment-amount-input" type="number" className="h-12 text-lg font-mono" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
          <div className="space-y-1"><Label>Mode</Label>
            <Select value={f.mode} onValueChange={(v) => setF({ ...f, mode: v })}>
              <SelectTrigger data-testid="payment-mode-select"><SelectValue /></SelectTrigger>
              <SelectContent>{["cash", "upi", "card", "bank"].map((m) => <SelectItem key={m} value={m}>{m.toUpperCase()}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="space-y-1"><Label>Date</Label><Input data-testid="payment-date-input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
          <div className="space-y-1 col-span-2"><Label>Note</Label><Input data-testid="payment-note-input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
        </div>
        <DialogFooter><Button data-testid="payment-save-btn" onClick={save}>Save payment</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PartyLedger({ ptype }) {
  const { id } = useParams();
  const nav = useNavigate();
  const { isAdmin, settings } = useAuth();
  const isC = ptype === "customer";
  const path = isC ? "customers" : "suppliers";
  const [party, setParty] = useState(null);
  const [rows, setRows] = useState([]);
  const [pay, setPay] = useState(false);
  const [edit, setEdit] = useState(false);
  const load = () => {
    api.get(`/${path}/${id}`).then((r) => setParty(r.data));
    api.get(`/${path}/${id}/ledger`).then((r) => setRows(r.data));
  };
  useEffect(load, [id, path]); // eslint-disable-line
  const del = async () => {
    if (!window.confirm("Delete this party?")) return;
    try { await api.delete(`/${path}/${id}`); nav(`/${path}`); } catch (e) { toast.error(errMsg(e)); }
  };
  if (!party) return <div className="label-xs">Loading…</div>;

  return (
    <div className="print-area">
      <div className="no-print flex flex-wrap gap-2 justify-between mb-4">
        <Button variant="ghost" asChild data-testid="ledger-back-btn"><Link to={`/${path}`}><ArrowLeft className="h-4 w-4 mr-2" />Back</Link></Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" data-testid="ledger-print-btn" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />Statement</Button>
          <Button variant="outline" data-testid="party-edit-btn" onClick={() => setEdit(true)}><Pencil className="h-4 w-4 mr-2" />Edit</Button>
          {isAdmin && <Button variant="outline" data-testid="party-delete-btn" onClick={del}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
          <Button data-testid="receive-payment-btn" onClick={() => setPay(true)}><IndianRupee className="h-4 w-4 mr-2" />{isC ? "Receive payment" : "Make payment"}</Button>
        </div>
      </div>
      <div className="hidden print:block mb-4 text-center"><div className="font-bold text-lg">{settings.name}</div><div className="text-xs">Ledger statement</div></div>
      <div className="rounded-lg border bg-card p-5 mb-4 flex flex-col sm:flex-row justify-between gap-4">
        <div><h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" data-testid="party-name">{party.name}</h1>
          <div className="text-sm text-muted-foreground mt-1">{[party.phone, party.gstin && `GSTIN ${party.gstin}`, party.state].filter(Boolean).join(" · ")}</div>
          <div className="text-sm text-muted-foreground">{party.address}</div></div>
        <div className="sm:text-right"><div className="label-xs">{isC ? "Balance receivable" : "Balance payable"}</div>
          <div className={`font-mono text-3xl font-bold ${party.balance > 0 ? "text-rose-500" : "text-emerald-500"}`} data-testid="party-balance">{inr(party.balance)}</div></div>
      </div>
      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm" data-testid="ledger-table">
          <thead className="bg-muted/60 label-xs"><tr><th className="text-left px-4 py-3">Date</th><th className="text-left px-4">Particulars</th>
            <th className="text-left px-4 hidden sm:table-cell">Ref</th><th className="text-right px-4">Debit</th><th className="text-right px-4">Credit</th><th className="text-right px-4">Balance</th></tr></thead>
          <tbody>{rows.map((e) => (
            <tr key={e.id} className="border-t" data-testid={`ledger-row-${e.id}`}>
              <td className="px-4 py-2.5 font-mono text-xs whitespace-nowrap">{e.date}</td>
              <td className="px-4"><div className="font-medium capitalize">{e.type}{e.mode && <span className="text-xs text-muted-foreground"> · {e.mode.toUpperCase()}</span>}</div><div className="text-xs text-muted-foreground">{e.note}</div></td>
              <td className="px-4 font-mono text-xs hidden sm:table-cell">{e.ref_id && isC ? <Link className="text-primary" to={`/invoices/${e.ref_id}`}>{e.ref}</Link> : e.ref}</td>
              <td className="px-4 text-right font-mono">{e.debit ? inr(e.debit) : ""}</td>
              <td className="px-4 text-right font-mono text-emerald-500">{e.credit ? inr(e.credit) : ""}</td>
              <td className="px-4 text-right font-mono font-semibold">{inr(e.balance)}</td>
            </tr>))}</tbody>
        </table>
        {rows.length === 0 && <Empty text="No transactions yet" />}
      </div>
      <PaymentDialog open={pay} onOpenChange={setPay} path={path} party={party} onSaved={load} isC={isC} />
      <PartyDialog open={edit} onOpenChange={setEdit} ptype={ptype} party={party} onSaved={load} />
    </div>
  );
}
