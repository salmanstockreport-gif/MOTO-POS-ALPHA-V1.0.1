import { Minus, Plus, Trash2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import CustomerPicker from "@/components/CustomerPicker";
import { inr } from "@/lib/api";

const MODES = ["cash", "upi", "card"];

function CartLine({ l, update, remove }) {
  return (
    <div className="py-3 border-b last:border-0" data-testid={`cart-line-${l.part_no}`}>
      <div className="flex justify-between gap-2">
        <div className="min-w-0"><div className="font-mono text-[11px] text-primary">{l.part_no}</div>
          <div className="text-sm font-medium truncate">{l.name}</div>
          <div className="text-[10px] text-muted-foreground">HSN {l.hsn_code || "-"} · GST {l.gst_rate}% · Stock {l.stock}</div></div>
        <button data-testid={`cart-remove-${l.part_no}`} onClick={remove} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <div className="flex items-center border rounded-md">
          <button data-testid={`cart-dec-${l.part_no}`} className="h-8 w-8 grid place-items-center" onClick={() => update({ qty: Math.max(1, l.qty - 1) })}><Minus className="h-3 w-3" /></button>
          <input data-testid={`cart-qty-${l.part_no}`} type="number" className="w-12 h-8 text-center bg-transparent font-mono text-sm outline-none" value={l.qty}
            onChange={(e) => update({ qty: Math.max(0, Number(e.target.value)) })} />
          <button data-testid={`cart-inc-${l.part_no}`} className="h-8 w-8 grid place-items-center" onClick={() => update({ qty: l.qty + 1 })}><Plus className="h-3 w-3" /></button>
        </div>
        <div className="flex-1"><Input data-testid={`cart-rate-${l.part_no}`} type="number" className="h-8 font-mono text-sm" value={l.rate} onChange={(e) => update({ rate: Number(e.target.value) })} /></div>
        <div className="w-16 relative"><Input data-testid={`cart-disc-${l.part_no}`} type="number" className="h-8 font-mono text-sm pr-5" value={l.discount} onChange={(e) => update({ discount: Math.min(100, Number(e.target.value)) })} />
          <span className="absolute right-2 top-1.5 text-xs text-muted-foreground">%</span></div>
        <div className="w-20 text-right font-mono text-sm font-semibold">{inr(l.qty * l.rate * (1 - l.discount / 100))}</div>
      </div>
    </div>
  );
}

const Row = ({ k, v, bold, testid }) => (
  <div className={`flex justify-between ${bold ? "text-lg font-bold" : "text-sm text-muted-foreground"}`}>
    <span>{k}</span><span className="font-mono" data-testid={testid}>{v}</span></div>
);

export default function CartPanel({ s }) {
  const { cart, bill, customer, setCustomer, payments, setPayments, billDisc, setBillDisc, vehicle, setVehicle,
    updateLine, removeLine, submit, busy, interstate, clear } = s;
  const tendered = MODES.reduce((t, m) => t + (Number(payments[m]) || 0), 0);
  const due = Math.max(bill.grand - tendered, 0);
  const change = Math.max(tendered - bill.grand, 0);

  return (
    <div className="flex flex-col h-full" data-testid="cart-panel">
      <div className="space-y-2 pb-3 border-b">
        <CustomerPicker value={customer} onChange={setCustomer} />
        <Input data-testid="vehicle-no-input" placeholder="Vehicle no. (optional)" value={vehicle} onChange={(e) => setVehicle(e.target.value.toUpperCase())} />
      </div>
      <div className="flex-1 overflow-y-auto scroll-thin min-h-[120px]">
        {cart.length === 0 ? <div className="py-10 text-center text-sm text-muted-foreground" data-testid="cart-empty">Cart is empty — search & add parts</div>
          : cart.map((l) => <CartLine key={l.item_id} l={l} update={(p) => updateLine(l.item_id, p)} remove={() => removeLine(l.item_id)} />)}
      </div>
      <div className="border-t pt-3 space-y-1.5">
        <div className="flex items-center justify-between text-sm text-muted-foreground"><span>Bill discount (₹)</span>
          <Input data-testid="bill-discount-input" type="number" className="h-8 w-24 font-mono text-right" value={billDisc} onChange={(e) => setBillDisc(e.target.value)} /></div>
        <Row k="Taxable value" v={inr(bill.taxable)} testid="cart-taxable" />
        {interstate ? <Row k="IGST" v={inr(bill.igst)} testid="cart-igst" /> : (<>
          <Row k="CGST" v={inr(bill.cgst)} testid="cart-cgst" /><Row k="SGST" v={inr(bill.sgst)} testid="cart-sgst" /></>)}
        <Row k="Round off" v={inr(bill.roundOff)} />
        <Row k="Grand Total" v={inr(bill.grand)} bold testid="cart-grand-total" />
      </div>
      <div className="border-t mt-3 pt-3 space-y-2">
        <div className="grid grid-cols-3 gap-2">
          {MODES.map((m) => (
            <div key={m}><div className="label-xs mb-1 flex justify-between">{m}
              <button data-testid={`pay-full-${m}`} className="text-primary" onClick={() => setPayments({ cash: "", upi: "", card: "", [m]: bill.grand })}>Full</button></div>
              <Input data-testid={`pay-${m}-input`} type="number" className="h-9 font-mono" value={payments[m]} onChange={(e) => setPayments({ ...payments, [m]: e.target.value })} /></div>
          ))}
        </div>
        <div className="flex justify-between text-sm">
          <span className={due > 0 ? "text-rose-500 font-semibold" : "text-emerald-500 font-semibold"} data-testid="cart-due">
            {due > 0 ? `Credit (Udhaar): ${inr(due)}` : change > 0 ? `Return change: ${inr(change)}` : "Fully paid"}</span>
        </div>
        {due > 0 && !customer && <div className="text-xs text-amber-500" data-testid="credit-needs-customer">Select a customer to bill on credit</div>}
        <div className="flex gap-2">
          <Button data-testid="cart-clear-btn" variant="outline" onClick={clear} disabled={!cart.length}>Clear</Button>
          <Button data-testid="cart-checkout-btn" className="flex-1 h-11 font-bold" onClick={submit} disabled={busy || !cart.length || (due > 0 && !customer)}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save & Print {inr(bill.grand)}</Button>
        </div>
      </div>
    </div>
  );
}
