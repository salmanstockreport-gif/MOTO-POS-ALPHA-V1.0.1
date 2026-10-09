import { useEffect, useState } from "react";
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

export default function Settings() {
  const { settings, setSettings } = useAuth();
  const [f, setF] = useState(settings);
  useEffect(() => setF(settings), [settings]);
  const save = async () => {
    try {
      const { data } = await api.put("/settings", { ...f, low_stock_default: Number(f.low_stock_default) || 0 });
      setSettings(data); toast.success("Settings saved");
    } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" sub="Shop details printed on invoices" />
      <div className="rounded-lg border bg-card p-5 grid sm:grid-cols-2 gap-4">
        {FIELDS.map(([k, l]) => (
          <div key={k} className="space-y-1"><Label>{l}</Label><Input data-testid={`settings-${k}-input`} value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>))}
        <div className="sm:col-span-2 space-y-1"><Label>Address</Label><Textarea data-testid="settings-address-input" rows={2} value={f.address || ""} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
        <div className="sm:col-span-2 space-y-1"><Label>Invoice footer note</Label><Input data-testid="settings-footer-input" value={f.footer_note || ""} onChange={(e) => setF({ ...f, footer_note: e.target.value })} /></div>
        <label className="sm:col-span-2 flex items-center gap-2 text-sm"><Switch data-testid="settings-negative-stock-switch" checked={!!f.allow_negative_stock} onCheckedChange={(v) => setF({ ...f, allow_negative_stock: v })} />Allow billing when stock is insufficient (negative stock)</label>
        <div className="sm:col-span-2"><Button data-testid="settings-save-btn" onClick={save}>Save settings</Button></div>
      </div>
    </div>
  );
}
