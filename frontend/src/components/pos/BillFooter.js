import { Loader2, Printer, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { inr } from "@/lib/api";

export const MODES = ["cash", "upi", "card"];

const Row = ({ k, v, testid, cls = "" }) => (
  <div className={`flex justify-between py-1 ${cls}`}><span>{k}</span><span className="font-mono" data-testid={testid}>{v}</span></div>);

export default function BillFooter({ s }) {
  const { bill, payments, setPayments, billDisc, setBillDisc, notes, setNotes, interstate, customer, cart, busy, submit, clear } = s;
  const received = MODES.reduce((t, m) => t + (Number(payments[m]) || 0), 0);
  const due = Math.max(bill.grand - received, 0);
  const change = Math.max(received - bill.grand, 0);
  const blocked = busy || !cart.length || (due > 0 && !customer);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4 [&>*]:min-w-0">
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="label-xs">Description / notes</div>
        <Textarea data-testid="bill-notes-input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes printed on invoice (optional)" />
        <div className="flex items-center justify-between gap-3"><span className="text-sm">Bill discount (₹)</span>
          <input data-testid="bill-discount-input" type="number" className="h-9 w-28 px-2 rounded border bg-background font-mono text-right" value={billDisc} onChange={(e) => setBillDisc(e.target.value)} /></div>
      </div>
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="label-xs">Payment received</div>
        {MODES.map((m) => (
          <div key={m} className="flex items-center gap-2">
            <span className="w-14 text-sm font-semibold uppercase">{m}</span>
            <input data-testid={`pay-${m}-input`} type="number" className="flex-1 h-9 px-2 rounded border bg-background font-mono text-right" value={payments[m]} onChange={(e) => setPayments({ ...payments, [m]: e.target.value })} />
            <button data-testid={`pay-full-${m}`} className="text-xs text-primary font-semibold w-10" onClick={() => setPayments({ cash: "", upi: "", card: "", [m]: bill.grand })}>Full</button>
          </div>
        ))}
        <div className={`text-sm font-semibold ${due > 0 ? "text-rose-500" : "text-emerald-500"}`} data-testid="cart-due">
          {due > 0 ? `Balance / Credit (Udhaar): ${inr(due)}` : change > 0 ? `Return change: ${inr(change)}` : cart.length ? "Fully paid" : ""}</div>
        {due > 0 && !customer && cart.length > 0 && <div className="text-xs text-amber-500" data-testid="credit-needs-customer">Select a party to save on credit</div>}
      </div>
      <div className="rounded-lg border bg-card p-4 text-sm">
        <Row k="Sub total" v={inr(bill.subtotal)} testid="cart-subtotal" cls="text-muted-foreground" />
        {bill.disc > 0 && <Row k="Discount" v={`- ${inr(bill.disc)}`} cls="text-muted-foreground" />}
        <Row k="Taxable value" v={inr(bill.taxable)} testid="cart-taxable" cls="text-muted-foreground" />
        {interstate ? <Row k="IGST" v={inr(bill.igst)} testid="cart-igst" cls="text-muted-foreground" /> : (<>
          <Row k="CGST" v={inr(bill.cgst)} testid="cart-cgst" cls="text-muted-foreground" /><Row k="SGST" v={inr(bill.sgst)} testid="cart-sgst" cls="text-muted-foreground" /></>)}
        <Row k="Round off" v={inr(bill.roundOff)} cls="text-muted-foreground" />
        <div className="flex justify-between items-baseline border-t mt-2 pt-2"><span className="font-bold">Total</span>
          <span className="font-mono text-2xl font-extrabold text-primary" data-testid="cart-grand-total">{inr(bill.grand)}</span></div>
        <Row k="Received" v={inr(Math.min(received, bill.grand))} />
        <Row k="Balance" v={inr(due)} cls={due > 0 ? "text-rose-500 font-semibold" : ""} />
        <div className="flex gap-2 mt-3">
          <Button data-testid="cart-clear-btn" variant="outline" onClick={clear} disabled={!cart.length}>Clear</Button>
          <Button data-testid="save-new-btn" variant="secondary" className="flex-1" onClick={() => submit(false)} disabled={blocked}><Save className="h-4 w-4 mr-1" />Save & New</Button>
          <Button data-testid="cart-checkout-btn" className="flex-1 font-bold" onClick={() => submit(true)} disabled={blocked}>
            {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Printer className="h-4 w-4 mr-1" />}Save & Print</Button>
        </div>
        <div className="text-[10px] text-muted-foreground mt-2 text-right">F2 search · Ctrl+Enter save & print</div>
      </div>
    </div>
  );
}
