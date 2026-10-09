import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import CustomerPicker from "@/components/CustomerPicker";
import ItemSearchCell from "@/components/pos/ItemSearchCell";
import BillGrid from "@/components/pos/BillGrid";
import BillFooter from "@/components/pos/BillFooter";
import { useAuth } from "@/context/AuthContext";
import { api, errMsg } from "@/lib/api";
import { calcBill } from "@/lib/billing";

const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const NOPAY = { cash: "", upi: "", card: "" };

function BillHeader({ meta, customer, setCustomer, vehicle, setVehicle, interstate }) {
  return (
    <div className="rounded-lg border bg-card p-4 grid md:grid-cols-[1fr_1fr_auto] gap-4 mb-4">
      <div className="space-y-1"><div className="label-xs">Party (customer)</div><CustomerPicker value={customer} onChange={setCustomer} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><div className="label-xs">Vehicle no.</div>
          <input data-testid="vehicle-no-input" className="w-full h-9 px-3 rounded-md border bg-background text-sm uppercase" placeholder="MH12AB1234" value={vehicle} onChange={(e) => setVehicle(e.target.value.toUpperCase())} /></div>
        <div className="space-y-1"><div className="label-xs">Place of supply</div>
          <div className="h-9 px-3 rounded-md border bg-muted/40 text-sm flex items-center" data-testid="supply-type">{interstate ? `Inter-state · IGST (${customer.state})` : "Intra-state · CGST+SGST"}</div></div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-1 gap-2 md:text-right md:min-w-[180px]">
        <div><div className="label-xs">Invoice no.</div><div className="font-mono font-bold" data-testid="next-invoice-number">{meta.number}</div></div>
        <div><div className="label-xs">Date</div><div className="font-mono">{meta.date}</div></div>
      </div>
    </div>
  );
}

export default function POS() {
  const nav = useNavigate();
  const { settings } = useAuth();
  const [cart, setCart] = useState(() => load("mp_cart", []));
  const [customer, setCustomer] = useState(() => load("mp_cart_customer", null));
  const [payments, setPayments] = useState(NOPAY);
  const [billDisc, setBillDisc] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [meta, setMeta] = useState({ number: "", date: "" });
  const searchRef = useRef();

  const loadMeta = () => api.get("/invoices/next-number").then((r) => setMeta(r.data));
  useEffect(() => { loadMeta(); }, []);
  useEffect(() => { localStorage.setItem("mp_cart", JSON.stringify(cart)); }, [cart]);
  useEffect(() => { localStorage.setItem("mp_cart_customer", JSON.stringify(customer)); }, [customer]);

  const interstate = !!(customer?.state && settings.state && customer.state.trim().toLowerCase() !== settings.state.trim().toLowerCase());
  const bill = useMemo(() => calcBill(cart, billDisc, interstate), [cart, billDisc, interstate]);

  const add = (i) => setCart((c) => {
    if (c.find((l) => l.item_id === i.id)) return c.map((l) => (l.item_id === i.id ? { ...l, qty: l.qty + 1 } : l));
    return [...c, { item_id: i.id, part_no: i.part_no, name: i.name, brand: i.brand, location: i.location, hsn_code: i.hsn_code,
      gst_rate: i.gst_rate, unit: i.unit, mrp: i.mrp, stock: i.stock, qty: 1, rate: i.sale_price, discount: 0 }];
  });
  const updateLine = (id, p) => setCart((c) => c.map((l) => (l.item_id === id ? { ...l, ...p } : l)));
  const removeLine = (id) => setCart((c) => c.filter((l) => l.item_id !== id));
  const clear = () => { setCart([]); setCustomer(null); setPayments(NOPAY); setBillDisc(""); setVehicle(""); setNotes(""); };

  const submit = useCallback(async (print) => {
    if (!cart.length || busy) return;
    setBusy(true);
    try {
      const pays = Object.entries(payments).filter(([, v]) => Number(v) > 0).map(([mode, amount]) => ({ mode, amount: Number(amount) }));
      const { data } = await api.post("/invoices", {
        customer_id: customer?.id || null, vehicle_no: vehicle, bill_discount: Number(billDisc) || 0, payments: pays, notes,
        lines: cart.filter((l) => l.qty > 0).map((l) => ({ item_id: l.item_id, qty: l.qty, rate: l.rate, discount: l.discount || 0 })),
      });
      toast.success(`Invoice ${data.number} saved`);
      clear();
      if (print) nav(`/invoices/${data.id}?print=1`); else { loadMeta(); searchRef.current?.focus(); }
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }, [cart, busy, payments, customer, vehicle, billDisc, notes, nav]); // eslint-disable-line

  useEffect(() => {
    const h = (e) => {
      if (e.key === "F2") { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "Enter" && e.ctrlKey) { e.preventDefault(); submit(true); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [submit]);

  const s = { bill, payments, setPayments, billDisc, setBillDisc, notes, setNotes, interstate, customer, cart, busy, submit, clear };

  return (
    <div className="max-w-[1600px]">
      <div className="flex items-baseline justify-between mb-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" data-testid="page-title">Sale Invoice</h1>
        <span className="label-xs">{cart.length} items · {cart.reduce((t, l) => t + Number(l.qty || 0), 0)} qty</span>
      </div>
      <BillHeader meta={meta} customer={customer} setCustomer={setCustomer} vehicle={vehicle} setVehicle={setVehicle} interstate={interstate} />
      <BillGrid cart={cart} updateLine={updateLine} removeLine={removeLine}>
        <ItemSearchCell ref={searchRef} onPick={add} />
      </BillGrid>
      <BillFooter s={s} />
    </div>
  );
}
