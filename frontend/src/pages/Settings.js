import { useEffect, useState } from "react";
import { Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/context/AuthContext";
import { api, errMsg } from "@/lib/api";

const FIELDS = [["name", "Shop name"], ["phone", "Phone"], ["email", "Email"], ["gstin", "GSTIN"],
  ["state", "State (for CGST/SGST vs IGST)"], ["invoice_prefix", "Invoice prefix"], ["upi_id", "UPI ID"], ["low_stock_default", "Default low-stock level"]];

function resizeLogo(file) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const sc = Math.min(1, 400 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = img.width * sc; c.height = img.height * sc;
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL("image/png"));
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}

function LogoBox({ f, setF }) {
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (file) setF({ ...f, logo: await resizeLogo(file) });
  };
  return (
    <div className="sm:col-span-2 flex items-center gap-4">
      <div className="h-20 w-32 rounded-md border bg-white grid place-items-center overflow-hidden" data-testid="settings-logo-preview">
        {f.logo ? <img src={f.logo} alt="Shop logo" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-gray-400">No logo</span>}</div>
      <label className="inline-flex items-center gap-2 h-9 px-3 rounded-md border text-sm cursor-pointer hover:bg-accent"><Upload className="h-4 w-4" />Upload logo
        <input data-testid="settings-logo-input" type="file" accept="image/*" className="hidden" onChange={onFile} /></label>
      {f.logo && <Button variant="ghost" size="sm" data-testid="settings-logo-remove" onClick={() => setF({ ...f, logo: "" })}>Remove</Button>}
    </div>
  );
}

function BrandAuths({ f, setF }) {
  const list = f.brand_auths || [];
  const upd = (i, p) => setF({ ...f, brand_auths: list.map((b, k) => (k === i ? { ...b, ...p } : b)) });
  return (
    <div className="sm:col-span-2 space-y-2">
      <Label>Authorised dealer / distributor numbers (printed on invoice)</Label>
      {list.map((b, i) => (
        <div key={i} className="flex gap-2" data-testid={`brand-auth-row-${i}`}>
          <Input data-testid={`brand-auth-brand-${i}`} placeholder="Brand (e.g. Bajaj Genuine Parts)" value={b.brand} onChange={(e) => upd(i, { brand: e.target.value })} />
          <Input data-testid={`brand-auth-no-${i}`} placeholder="Authorisation no." className="font-mono" value={b.auth_no} onChange={(e) => upd(i, { auth_no: e.target.value })} />
          <Button variant="ghost" size="icon" data-testid={`brand-auth-remove-${i}`} onClick={() => setF({ ...f, brand_auths: list.filter((_, k) => k !== i) })}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>))}
      <Button variant="outline" size="sm" data-testid="brand-auth-add-btn" onClick={() => setF({ ...f, brand_auths: [...list, { brand: "", auth_no: "" }] })}><Plus className="h-4 w-4 mr-1" />Add brand</Button>
    </div>
  );
}

export default function Settings() {
  const { settings, setSettings } = useAuth();
  const [f, setF] = useState(settings);
  useEffect(() => setF(settings), [settings]);
  const save = async () => {
    try {
      const brand_auths = (f.brand_auths || []).filter((b) => b.brand?.trim() || b.auth_no?.trim());
      const { data } = await api.put("/settings", { ...f, brand_auths, low_stock_default: Number(f.low_stock_default) || 0 });
      setSettings(data); toast.success("Settings saved");
    } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" sub="Shop details printed on invoices" />
      <div className="rounded-lg border bg-card p-5 grid sm:grid-cols-2 gap-4">
        <LogoBox f={f} setF={setF} />
        {FIELDS.map(([k, l]) => (
          <div key={k} className="space-y-1"><Label>{l}</Label><Input data-testid={`settings-${k}-input`} value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>))}
        <div className="sm:col-span-2 space-y-1"><Label>Address</Label><Textarea data-testid="settings-address-input" rows={2} value={f.address || ""} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
        <div className="sm:col-span-2 space-y-1"><Label>Invoice footer note</Label><Input data-testid="settings-footer-input" value={f.footer_note || ""} onChange={(e) => setF({ ...f, footer_note: e.target.value })} /></div>
        <BrandAuths f={f} setF={setF} />
        <label className="sm:col-span-2 flex items-center gap-2 text-sm"><Switch data-testid="settings-negative-stock-switch" checked={!!f.allow_negative_stock} onCheckedChange={(v) => setF({ ...f, allow_negative_stock: v })} />Allow billing when stock is insufficient (negative stock)</label>
        <div className="sm:col-span-2"><Button data-testid="settings-save-btn" onClick={save}>Save settings</Button></div>
      </div>
    </div>
  );
}
