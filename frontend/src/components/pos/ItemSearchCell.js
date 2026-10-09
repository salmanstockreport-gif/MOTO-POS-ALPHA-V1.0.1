import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Search, MapPin } from "lucide-react";
import { api, inr, gstColor } from "@/lib/api";

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function Hl({ text, tokens }) {
  if (!tokens.length || !text) return <>{text}</>;
  const re = new RegExp(`(${tokens.map(esc).join("|")})`, "ig");
  return <>{String(text).split(re).map((p, i) => (i % 2
    ? <mark key={i} className="bg-primary/30 text-inherit rounded-sm px-0.5">{p}</mark> : <span key={i}>{p}</span>))}</>;
}

function ResultRow({ i, tokens, active, onPick, onHover }) {
  return (
    <button type="button" data-testid={`search-result-${i.part_no}`} onMouseDown={(e) => { e.preventDefault(); onPick(i); }} onMouseEnter={onHover}
      className={`w-full text-left grid grid-cols-12 gap-2 px-3 py-2 border-b text-sm items-center ${active ? "bg-primary/15" : "hover:bg-accent/60"}`}>
      <div className="col-span-12 md:col-span-2 font-mono font-bold text-primary text-xs"><Hl text={i.part_no} tokens={tokens} /></div>
      <div className="col-span-12 md:col-span-4 min-w-0"><div className="truncate font-medium"><Hl text={i.name} tokens={tokens} /></div>
        <div className="text-[11px] text-muted-foreground truncate"><Hl text={(i.fitments || []).join(", ")} tokens={tokens} /></div></div>
      <div className="col-span-4 md:col-span-2 text-xs truncate"><Hl text={i.brand} tokens={tokens} /></div>
      <div className="col-span-3 md:col-span-1 text-xs font-semibold text-amber-500 flex items-center gap-1 truncate">{i.location && <MapPin className="h-3 w-3 shrink-0" />}<Hl text={i.location || "-"} tokens={tokens} /></div>
      <div className={`col-span-2 md:col-span-1 text-right font-mono text-xs ${i.stock <= 0 ? "text-rose-500" : i.stock <= i.min_stock ? "text-amber-500" : ""}`}>{i.stock}</div>
      <div className="col-span-3 md:col-span-2 text-right"><div className="font-mono font-semibold">{inr(i.sale_price)}</div>
        <span className={`text-[9px] font-bold px-1 rounded border ${gstColor(i.gst_rate)}`}>GST {i.gst_rate}%</span></div>
    </button>
  );
}

const ItemSearchCell = forwardRef(function ItemSearchCell({ onPick }, ref) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState([]);
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const inp = useRef();
  useImperativeHandle(ref, () => ({ focus: () => inp.current?.focus() }));
  const tokens = q.trim().split(/[\s,]+/).filter(Boolean);

  useEffect(() => {
    if (!q.trim()) { setRes([]); return; }
    const t = setTimeout(() => api.get("/items", { params: { q, limit: 25 } }).then((r) => { setRes(r.data.items); setIdx(0); setOpen(true); }), 150);
    return () => clearTimeout(t);
  }, [q]);

  const pick = (i) => { onPick(i); setQ(""); setRes([]); setOpen(false); inp.current?.focus(); };
  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx((x) => Math.min(x + 1, res.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((x) => Math.max(x - 1, 0)); }
    else if (e.key === "Enter" && res[idx]) { e.preventDefault(); pick(res[idx]); }
    else if (e.key === "Escape") setOpen(false);
  };

  return (
    <div className="relative">
      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
      <input ref={inp} data-testid="pos-search-input" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey}
        onFocus={() => res.length && setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search anything: part no, description, vehicle, brand, rack… (F2)  e.g. brake pulsar 150"
        className="w-full h-10 pl-9 pr-3 rounded-md border border-primary/50 bg-background text-sm outline-none focus:ring-2 focus:ring-primary/40" />
      {open && q.trim() && (
        <div className="absolute z-40 left-0 right-0 mt-1 rounded-md border bg-popover shadow-2xl max-h-[55vh] overflow-y-auto scroll-thin" data-testid="pos-search-results">
          <div className="hidden md:grid grid-cols-12 gap-2 px-3 py-1.5 label-xs border-b bg-muted sticky top-0">
            <div className="col-span-2">Part No</div><div className="col-span-4">Description / Fitment</div><div className="col-span-2">Brand</div>
            <div className="col-span-1">Location</div><div className="col-span-1 text-right">Stock</div><div className="col-span-2 text-right">Price</div></div>
          {res.length === 0 ? <div className="p-4 text-sm text-muted-foreground" data-testid="pos-search-empty">No matching parts</div>
            : res.map((i, k) => <ResultRow key={i.id} i={i} tokens={tokens} active={k === idx} onPick={pick} onHover={() => setIdx(k)} />)}
          <div className="px-3 py-1.5 text-[10px] text-muted-foreground border-t">↑ ↓ to move · Enter to add · Esc to close</div>
        </div>
      )}
    </div>
  );
});

export default ItemSearchCell;
