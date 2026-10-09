import { Trash2, MapPin } from "lucide-react";
import { inr } from "@/lib/api";

const lineAmt = (l) => l.qty * l.rate * (1 - (l.discount || 0) / 100);
const lineTax = (l) => lineAmt(l) - lineAmt(l) / (1 + l.gst_rate / 100);
const cellIn = "w-full h-8 px-2 rounded border bg-background font-mono text-sm text-right outline-none focus:border-primary";

function Loc({ v }) {
  return v ? <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-500 bg-amber-500/10 border border-amber-500/30 rounded px-1.5 py-0.5"><MapPin className="h-3 w-3" />{v}</span>
    : <span className="text-xs text-muted-foreground">-</span>;
}

function NumIn({ v, on, testid, w = "" }) {
  return <input type="number" data-testid={testid} className={`${cellIn} ${w}`} value={v} onChange={(e) => on(Number(e.target.value))} />;
}

function DesktopRow({ l, n, update, remove }) {
  return (
    <tr className="border-b hover:bg-accent/30" data-testid={`bill-row-${l.part_no}`}>
      <td className="px-2 py-1.5 text-center text-xs text-muted-foreground">{n}</td>
      <td className="px-2 py-1.5"><div className="font-mono text-xs font-bold text-primary">{l.part_no}</div>
        <div className="text-sm leading-tight">{l.name}</div>{l.brand && <div className="text-[10px] text-muted-foreground">{l.brand}</div>}</td>
      <td className="px-2" data-testid={`bill-location-${l.part_no}`}><Loc v={l.location} /></td>
      <td className="px-2 font-mono text-xs">{l.hsn_code || "-"}</td>
      <td className="px-2 w-20"><NumIn v={l.qty} on={(qty) => update({ qty: Math.max(0, qty) })} testid={`bill-qty-${l.part_no}`} />
        <div className={`text-[10px] text-right ${l.qty > l.stock ? "text-rose-500" : "text-muted-foreground"}`}>stk {l.stock}</div></td>
      <td className="px-2 text-xs text-muted-foreground">{l.unit}</td>
      <td className="px-2 text-right font-mono text-xs text-muted-foreground">{inr(l.mrp)}</td>
      <td className="px-2 w-24"><NumIn v={l.rate} on={(rate) => update({ rate })} testid={`bill-rate-${l.part_no}`} /></td>
      <td className="px-2 w-16"><NumIn v={l.discount} on={(d) => update({ discount: Math.min(100, Math.max(0, d)) })} testid={`bill-disc-${l.part_no}`} /></td>
      <td className="px-2 text-right font-mono text-xs"><div>{inr(lineTax(l))}</div><div className="text-[10px] text-muted-foreground">@{l.gst_rate}%</div></td>
      <td className="px-2 text-right font-mono font-semibold" data-testid={`bill-amount-${l.part_no}`}>{inr(lineAmt(l))}</td>
      <td className="px-1"><button data-testid={`bill-remove-${l.part_no}`} onClick={remove} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button></td>
    </tr>
  );
}

function MobileRow({ l, n, update, remove }) {
  return (
    <div className="border-b p-3 space-y-2" data-testid={`bill-card-${l.part_no}`}>
      <div className="flex justify-between gap-2">
        <div className="min-w-0"><div className="text-xs text-muted-foreground">#{n} <span className="font-mono font-bold text-primary">{l.part_no}</span></div>
          <div className="text-sm font-medium">{l.name}</div>
          <div className="flex gap-2 items-center mt-1"><Loc v={l.location} /><span className="text-[10px] text-muted-foreground">HSN {l.hsn_code} · GST {l.gst_rate}% · stk {l.stock}</span></div></div>
        <button onClick={remove} className="text-muted-foreground"><Trash2 className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-4 gap-2 items-end">
        <label className="label-xs">Qty<NumIn v={l.qty} on={(qty) => update({ qty: Math.max(0, qty) })} testid={`m-bill-qty-${l.part_no}`} /></label>
        <label className="label-xs">Price<NumIn v={l.rate} on={(rate) => update({ rate })} testid={`m-bill-rate-${l.part_no}`} /></label>
        <label className="label-xs">Disc%<NumIn v={l.discount} on={(d) => update({ discount: Math.min(100, Math.max(0, d)) })} testid={`m-bill-disc-${l.part_no}`} /></label>
        <div className="text-right font-mono font-bold text-sm pb-1.5">{inr(lineAmt(l))}</div>
      </div>
    </div>
  );
}

const HEAD = ["#", "Item", "Location", "HSN", "Qty", "Unit", "MRP", "Price/Unit", "Disc %", "Tax", "Amount", ""];

export default function BillGrid({ cart, updateLine, removeLine, children }) {
  return (
    <div className="rounded-lg border bg-card" data-testid="bill-grid">
      <div className="hidden md:block overflow-x-auto scroll-thin">
        <table className="w-full text-sm">
          <thead className="bg-muted/70 label-xs"><tr>{HEAD.map((h, i) => <th key={i} className={`px-2 py-2 ${i > 5 ? "text-right" : "text-left"}`}>{h}</th>)}</tr></thead>
          <tbody>{cart.map((l, i) => <DesktopRow key={l.item_id} l={l} n={i + 1} update={(p) => updateLine(l.item_id, p)} remove={() => removeLine(l.item_id)} />)}</tbody>
        </table>
      </div>
      <div className="md:hidden">{cart.map((l, i) => <MobileRow key={l.item_id} l={l} n={i + 1} update={(p) => updateLine(l.item_id, p)} remove={() => removeLine(l.item_id)} />)}</div>
      <div className="p-2 border-t bg-muted/20">{children}</div>
      {cart.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground" data-testid="bill-empty">No items yet — search above and press Enter to add</div>}
    </div>
  );
}
