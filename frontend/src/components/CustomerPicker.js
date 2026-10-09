import { useEffect, useState } from "react";
import { UserPlus, X, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import PartyDialog from "@/components/PartyDialog";
import { api, inr } from "@/lib/api";

export default function CustomerPicker({ value, onChange }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState([]);
  const [add, setAdd] = useState(false);

  useEffect(() => {
    if (!q.trim()) return setRes([]);
    const t = setTimeout(() => api.get("/customers", { params: { q, limit: 8 } }).then((r) => setRes(r.data)), 250);
    return () => clearTimeout(t);
  }, [q]);

  if (value)
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2" data-testid="selected-customer">
        <div className="min-w-0 flex items-center gap-2"><User className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0"><div className="text-sm font-semibold truncate">{value.name}</div>
            <div className="text-[11px] text-muted-foreground">{value.phone} · Bal <span className={value.balance > 0 ? "text-rose-500" : ""}>{inr(value.balance)}</span></div></div></div>
        <button data-testid="clear-customer-btn" onClick={() => onChange(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>
    );

  return (
    <div className="relative">
      <div className="flex gap-2">
        <Input data-testid="customer-search-input" placeholder="Customer name / phone (blank = walk-in)" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button data-testid="add-customer-btn" variant="outline" size="icon" onClick={() => setAdd(true)}><UserPlus className="h-4 w-4" /></Button>
      </div>
      {res.length > 0 && (
        <div className="absolute z-30 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-60 overflow-auto">
          {res.map((c) => (
            <button key={c.id} data-testid={`customer-option-${c.id}`} onClick={() => { onChange(c); setQ(""); }}
              className="w-full text-left px-3 py-2 hover:bg-accent flex justify-between text-sm">
              <span>{c.name} <span className="text-muted-foreground text-xs">{c.phone}</span></span>
              <span className="font-mono text-xs">{inr(c.balance)}</span>
            </button>
          ))}
        </div>
      )}
      <PartyDialog open={add} onOpenChange={setAdd} ptype="customer" onSaved={(c) => onChange(c)} />
    </div>
  );
}
