import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { api, errMsg, GST_RATES } from "@/lib/api";

const EMPTY = { part_no: "", name: "", brand: "", category: "", fitments: "", hsn_code: "", gst_rate: 18, mrp: 0,
  sale_price: 0, purchase_price: 0, stock: 0, min_stock: 5, unit: "PCS", location: "" };
const NUMS = ["gst_rate", "mrp", "sale_price", "purchase_price", "stock", "min_stock"];

export default function ItemDialog({ open, onOpenChange, item, onSaved }) {
  const [f, setF] = useState(EMPTY);
  const [hsn, setHsn] = useState([]);
  useEffect(() => {
    if (!open) return;
    setF(item ? { ...EMPTY, ...item, fitments: (item.fitments || []).join(", ") } : EMPTY);
    api.get("/hsn").then((r) => setHsn(r.data));
  }, [open, item]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const pickHsn = (code) => {
    const h = hsn.find((x) => x.code === code);
    setF({ ...f, hsn_code: code, gst_rate: h ? h.gst_rate : f.gst_rate });
  };

  const save = async () => {
    if (!f.part_no.trim() || !f.name.trim()) return toast.error("Part number and description are required");
    const body = { ...f, fitments: f.fitments.split(",").map((x) => x.trim()).filter(Boolean) };
    NUMS.forEach((k) => (body[k] = Number(body[k]) || 0));
    try {
      const { data } = item ? await api.put(`/items/${item.id}`, body) : await api.post("/items", body);
      toast.success("Item saved"); onSaved?.(data); onOpenChange(false);
    } catch (e) { toast.error(errMsg(e)); }
  };

  const field = (k, label, props = {}) => (
    <div className="space-y-1" key={k}><Label>{label}</Label>
      <Input data-testid={`item-${k}-input`} value={f[k]} onChange={set(k)} {...props} /></div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto" data-testid="item-dialog">
        <DialogHeader><DialogTitle>{item ? "Edit part" : "New part"}</DialogTitle></DialogHeader>
        <div className="grid sm:grid-cols-3 gap-3">
          {field("part_no", "Part number *", { className: "font-mono uppercase" })}
          <div className="sm:col-span-2">{field("name", "Description *")}</div>
          {field("brand", "Brand")}{field("category", "Category")}{field("location", "Rack / Location")}
          <div className="sm:col-span-3">{field("fitments", "Vehicle fitments (comma separated)", { placeholder: "Bajaj Pulsar 150, Bajaj Pulsar 180" })}</div>
          <div className="space-y-1"><Label>HSN code</Label>
            <Select value={f.hsn_code || "__none"} onValueChange={(v) => pickHsn(v === "__none" ? "" : v)}>
              <SelectTrigger data-testid="item-hsn-select"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="__none">— None —</SelectItem>
                {hsn.map((h) => <SelectItem key={h.code} value={h.code}>{h.code} · {h.gst_rate}%</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="space-y-1"><Label>GST rate</Label>
            <Select value={String(f.gst_rate)} onValueChange={(v) => setF({ ...f, gst_rate: Number(v) })}>
              <SelectTrigger data-testid="item-gst-select"><SelectValue /></SelectTrigger>
              <SelectContent>{GST_RATES.map((r) => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent>
            </Select></div>
          {field("unit", "Unit")}
          {field("mrp", "MRP (₹)", { type: "number" })}{field("sale_price", "Sale price incl. GST (₹)", { type: "number" })}
          {field("purchase_price", "Purchase cost (₹)", { type: "number" })}
          {field("stock", "Stock qty", { type: "number" })}{field("min_stock", "Low-stock alert at", { type: "number" })}
        </div>
        <DialogFooter><Button data-testid="item-save-btn" onClick={save}>Save part</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
