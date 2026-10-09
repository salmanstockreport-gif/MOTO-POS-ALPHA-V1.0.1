import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, ShoppingCart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import CartPanel from "@/components/CartPanel";
import { useAuth } from "@/context/AuthContext";
import { api, inr, errMsg, gstColor } from "@/lib/api";
import { calcBill } from "@/lib/billing";

const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const NOPAY = { cash: "", upi: "", card: "" };

function ResultRow({ i, onAdd }) {
  const out = i.stock <= 0;
  return (
    <button onClick={() => onAdd(i)} data-testid={`pos-item-${i.part_no}`}
      className="w-full text-left rounded-md border bg-card p-3 hover:border-primary transition-colors flex gap-3 items-center group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap"><span className="font-mono text-sm font-bold text-primary">{i.part_no}</span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${gstColor(i.gst_rate)}`}>GST {i.gst_rate}%</span>
          {i.hsn_code && <span className="text-[10px] font-mono text-muted-foreground">HSN {i.hsn_code}</span>}</div>
        <div className="text-sm font-medium truncate mt-0.5">{i.name}</div>
        <div className="flex flex-wrap gap-1 mt-1">{(i.fitments || []).slice(0, 4).map((f) => (
          <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{f}</span>))}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-mono font-bold">{inr(i.sale_price)}</div>
        <div className={`text-[11px] font-mono ${out ? "text-rose-500" : i.stock <= i.min_stock ? "text-amber-500" : "text-muted-foreground"}`}>Stock {i.stock}</div>
      </div>
      <div className="h-8 w-8 rounded-md bg-primary/10 text-primary grid place-items-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors"><Plus className="h-4 w-4" /></div>
    </button>
  );
}

export default function POS() {
  const nav = useNavigate();
  const { settings } = useAuth();
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [fitments, setFitments] = useState([]);
  const [cart, setCart] = useState(() => load("mp_cart", []));
  const [customer, setCustomer] = useState(() => load("mp_cart_customer", null));
  const [payments, setPayments] = useState(NOPAY);
  const [billDisc, setBillDisc] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(false);
  const inputRef = useRef();

  useEffect(() => { api.get("/items/meta").then((r) => setFitments(r.data.fitments.slice(0, 14))); }, []);
  useEffect(() => { localStorage.setItem("mp_cart", JSON.stringify(cart)); }, [cart]);
  useEffect(() => { localStorage.setItem("mp_cart_customer", JSON.stringify(customer)); }, [customer]);
  useEffect(() => {
    const t = setTimeout(() => api.get("/items", { params: { q, limit: 40 } }).then((r) => setResults(r.data.items)), 200);
    return () => clearTimeout(t);
  }, [q]);

  const interstate = !!(customer?.state && settings.state && customer.state.trim().toLowerCase() !== settings.state.trim().toLowerCase());
  const bill = useMemo(() => calcBill(cart, billDisc, interstate), [cart, billDisc, interstate]);

  const add = (i) => {
    setCart((c) => {
      const ex = c.find((l) => l.item_id === i.id);
      if (ex) return c.map((l) => (l.item_id === i.id ? { ...l, qty: l.qty + 1 } : l));
      return [...c, { item_id: i.id, part_no: i.part_no, name: i.name, hsn_code: i.hsn_code, gst_rate: i.gst_rate,
        stock: i.stock, qty: 1, rate: i.sale_price, discount: 0 }];
    });
    toast.success(`${i.part_no} added`, { duration: 900 });
  };
  const updateLine = (id, p) => setCart((c) => c.map((l) => (l.item_id === id ? { ...l, ...p } : l)));
  const removeLine = (id) => setCart((c) => c.filter((l) => l.item_id !== id));
  const clear = () => { setCart([]); setCustomer(null); setPayments(NOPAY); setBillDisc(""); setVehicle(""); };

  const onKey = (e) => {
    if (e.key !== "Enter" || !results.length) return;
    const exact = results.find((r) => r.part_no.toLowerCase() === q.trim().toLowerCase());
    if (exact || results.length === 1) { add(exact || results[0]); setQ(""); }
  };

  const submit = async () => {
    setBusy(true);
    try {
      const pays = Object.entries(payments).filter(([, v]) => Number(v) > 0).map(([mode, amount]) => ({ mode, amount: Number(amount) }));
      const { data } = await api.post("/invoices", {
        customer_id: customer?.id || null, vehicle_no: vehicle, bill_discount: Number(billDisc) || 0, payments: pays,
        lines: cart.filter((l) => l.qty > 0).map((l) => ({ item_id: l.item_id, qty: l.qty, rate: l.rate, discount: l.discount || 0 })),
      });
      toast.success(`Invoice ${data.number} saved`);
      clear();
      nav(`/invoices/${data.id}?print=1`);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  const s = { cart, bill, customer, setCustomer, payments, setPayments, billDisc, setBillDisc, vehicle, setVehicle,
    updateLine, removeLine, submit, busy, interstate, clear };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] gap-6 lg:h-[calc(100vh-4rem)]">
      <div className="flex flex-col min-h-0 min-w-0">
        <div className="flex items-baseline justify-between mb-4"><h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" data-testid="page-title">POS Billing</h1>
          <span className="label-xs hidden sm:block">Enter = add exact part no.</span></div>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
          <Input ref={inputRef} autoFocus data-testid="pos-search-input" className="h-12 pl-11 text-base"
            placeholder="Search part no, description, vehicle (e.g. Pulsar 150)…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} />
        </div>
        <div className="flex gap-2 overflow-x-auto scroll-thin pb-2 mb-2">
          {fitments.map((f) => (
            <button key={f} data-testid={`fitment-chip-${f}`} onClick={() => setQ(f)}
              className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${q === f ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"}`}>{f}</button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto scroll-thin space-y-2 pb-24 lg:pb-2" data-testid="pos-results">
          {results.length === 0 ? <div className="py-12 text-center text-sm text-muted-foreground">No parts found</div>
            : results.map((i) => <ResultRow key={i.id} i={i} onAdd={add} />)}
        </div>
      </div>
      <aside className="hidden lg:flex flex-col rounded-lg border bg-card p-4 min-h-0">
        <div className="flex justify-between items-center mb-3"><h2 className="font-bold">Current Bill</h2><span className="label-xs">{cart.length} items</span></div>
        <CartPanel s={s} />
      </aside>
      <button data-testid="mobile-cart-btn" onClick={() => setSheet(true)}
        className="lg:hidden fixed bottom-20 inset-x-4 z-30 h-14 rounded-lg bg-primary text-primary-foreground font-bold flex items-center justify-between px-5 shadow-xl">
        <span className="flex items-center gap-2"><ShoppingCart className="h-5 w-5" /> {cart.length} items</span><span className="font-mono">{inr(bill.grand)}</span>
      </button>
      <Sheet open={sheet} onOpenChange={setSheet}>
        <SheetContent side="bottom" className="h-[92vh] bg-card p-4 flex flex-col">
          <SheetTitle>Current Bill</SheetTitle>
          <div className="flex-1 min-h-0"><CartPanel s={s} /></div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
