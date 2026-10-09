import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import CustomerPicker from "@/components/CustomerPicker";
import ItemSearchCell from "@/components/pos/ItemSearchCell";
import BillGrid from "@/components/pos/BillGrid";
import BillFooter from "@/components/pos/BillFooter";
import { useAuth } from "@/context/AuthContext";
import { api, errMsg, inr } from "@/lib/api";
import { calcBill } from "@/lib/billing";

const NOPAY = { cash: "", upi: "", card: "" };
const newBill = () => ({ id: `b${Date.now()}${Math.random().toString(36).slice(2, 6)}`, cart: [], customer: null,
  payments: NOPAY, billDisc: "", vehicle: "", notes: "", created: Date.now() });
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };

function BillHeader({ bill, patch, interstate }) {
  return (
    <div className="rounded-lg border bg-card p-4 grid md:grid-cols-[1fr_1fr_auto] gap-4 mb-4">
      <div className="space-y-1"><div className="label-xs">Party (customer)</div>
        <CustomerPicker value={bill.customer} onChange={(c) => patch({ customer: c })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><div className="label-xs">Vehicle no.</div>
          <input data-testid="vehicle-no-input" className="w-full h-9 px-3 rounded-md border bg-background text-sm uppercase" placeholder="MH12AB1234" value={bill.vehicle} onChange={(e) => patch({ vehicle: e.target.value.toUpperCase() })} /></div>
        <div className="space-y-1"><div className="label-xs">Place of supply</div>
          <div className="h-9 px-3 rounded-md border bg-muted/40 text-sm flex items-center" data-testid="supply-type">{interstate ? `Inter-state · IGST (${bill.customer.state})` : "Intra-state · CGST+SGST"}</div></div>
      </div>
    </div>
  );
}

export default function POS() {
  const nav = useNavigate();
  const { settings } = useAuth();
  const [bills, setBills] = useState(() => { const b = load("mp_bills", null); return b?.length ? b : [newBill()]; });
  const [activeId, setActiveId] = useState(() => load("mp_active_bill", null));
  const [meta, setMeta] = useState({ number: "", date: "" });
  const [busy, setBusy] = useState(false);
  const searchRef = useRef();

  const active = bills.find((b) => b.id === activeId) || bills[0];
  const patch = useCallback((p) => setBills((bs) => bs.map((b) => (b.id === active.id ? { ...b, ...p } : b))), [active.id]);
  const setCart = useCallback((fn) => setBills((bs) => bs.map((b) => (b.id === active.id ? { ...b, cart: fn(b.cart) } : b))), [active.id]);

  useEffect(() => { localStorage.setItem("mp_bills", JSON.stringify(bills)); }, [bills]);
  useEffect(() => { localStorage.setItem("mp_active_bill", JSON.stringify(active.id)); }, [active.id]);
  const loadMeta = () => api.get("/invoices/next-number").then((r) => setMeta(r.data));
  useEffect(() => { loadMeta(); }, []);

  const interstate = !!(active.customer?.state && settings.state
    && active.customer.state.trim().toLowerCase() !== settings.state.trim().toLowerCase());
  const bill = useMemo(() => calcBill(active.cart, active.billDisc, interstate), [active, interstate]);

  const add = (i) => setCart((c) => {
    if (c.find((l) => l.item_id === i.id)) return c.map((l) => (l.item_id === i.id ? { ...l, qty: l.qty + 1 } : l));
    return [...c, { item_id: i.id, part_no: i.part_no, name: i.name, brand: i.brand, location: i.location, hsn_code: i.hsn_code,
      gst_rate: i.gst_rate, unit: i.unit, mrp: i.mrp, stock: i.stock, qty: 1, rate: i.sale_price, discount: 0 }];
  });
  const updateLine = (id, p) => setCart((c) => c.map((l) => (l.item_id === id ? { ...l, ...p } : l)));
  const removeLine = (id) => setCart((c) => c.filter((l) => l.item_id !== id));

  const newTab = () => { const b = newBill(); setBills((bs) => [...bs, b]); setActiveId(b.id); };
  const closeTab = (id, e) => {
    e.stopPropagation();
    const b = bills.find((x) => x.id === id);
    if (b.cart.length && !window.confirm("Discard this bill?")) return;
    const rest = bills.filter((x) => x.id !== id);
    setBills(rest.length ? rest : [newBill()]);
    if (active.id === id) setActiveId(rest.length ? rest[rest.length - 1].id : null);
  };

  const submit = useCallback(async (print) => {
    if (!active.cart.length || busy) return;
    setBusy(true);
    try {
      const pays = Object.entries(active.payments).filter(([, v]) => Number(v) > 0).map(([mode, amount]) => ({ mode, amount: Number(amount) }));
      const { data } = await api.post("/invoices", {
        customer_id: active.customer?.id || null, vehicle_no: active.vehicle, bill_discount: Number(active.billDisc) || 0, payments: pays, notes: active.notes,
        lines: active.cart.filter((l) => l.qty > 0).map((l) => ({ item_id: l.item_id, qty: l.qty, rate: l.rate, discount: l.discount || 0 })),
      });
      toast.success(`Invoice ${data.number} saved`);
      const nb = newBill();
      const rest = bills.filter((b) => b.id !== active.id);
      setBills([...rest, nb]); setActiveId(nb.id);
      loadMeta();
      if (print) nav(`/invoices/${data.id}?print=1`); else searchRef.current?.focus();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }, [active, busy, bills, nav]); // eslint-disable-line

  useEffect(() => {
    const h = (e) => {
      if (e.key === "F2") { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "Enter" && e.ctrlKey) { e.preventDefault(); submit(true); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [submit]);

  const clearActive = () => patch({ cart: [], customer: null, payments: NOPAY, billDisc: "", vehicle: "", notes: "" });
  const s = { bill, payments: active.payments, setPayments: (p) => patch({ payments: p }), billDisc: active.billDisc,
    setBillDisc: (v) => patch({ billDisc: v }), notes: active.notes, setNotes: (v) => patch({ notes: v }),
    interstate, customer: active.customer, cart: active.cart, busy, submit, clear: clearActive };

  return (
    <div className="max-w-[1600px]">
      <div className="flex items-baseline justify-between mb-3">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" data-testid="page-title">Sale Invoice</h1>
        <div className="label-xs md:text-right"><span data-testid="next-invoice-number">{meta.number}</span> · {meta.date}</div>
      </div>
      <div className="flex gap-1.5 items-end mb-3 overflow-x-auto scroll-thin" data-testid="pos-tabs">
        {bills.map((b, i) => {
          const tot = b.cart.reduce((t, l) => t + l.qty * l.rate * (1 - (l.discount || 0) / 100), 0);
          const isA = b.id === active.id;
          return (
            <button key={b.id} data-testid={`pos-tab-${i}`} onClick={() => setActiveId(b.id)}
              className={`flex items-center gap-2 shrink-0 px-3 py-2 rounded-t-md border border-b-0 text-sm font-semibold transition-colors ${isA ? "bg-card text-foreground" : "bg-muted/50 text-muted-foreground hover:text-foreground"}`}>
              Bill {i + 1}
              {b.cart.length > 0 && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/15 text-primary">{b.cart.length} · {inr(tot)}</span>}
              <span data-testid={`pos-close-tab-${i}`} role="button" onClick={(e) => closeTab(b.id, e)} className="p-0.5 rounded hover:bg-destructive/20 hover:text-destructive"><X className="h-3.5 w-3.5" /></span>
            </button>
          );
        })}
        <button data-testid="pos-new-tab-btn" onClick={newTab}
          className="flex items-center gap-1 shrink-0 px-3 py-2 rounded-md border border-dashed text-sm text-muted-foreground hover:text-primary hover:border-primary transition-colors">
          <Plus className="h-4 w-4" /> New Bill
        </button>
      </div>
      <BillHeader bill={active} patch={patch} interstate={interstate} />
      <BillGrid cart={active.cart} updateLine={updateLine} removeLine={removeLine}>
        <ItemSearchCell ref={searchRef} onPick={add} />
      </BillGrid>
      <BillFooter s={s} />
    </div>
  );
}
