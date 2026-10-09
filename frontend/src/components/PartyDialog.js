import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const EMPTY = { name: "", phone: "", email: "", gstin: "", address: "", state: "", opening_balance: 0, credit_limit: "", credit_days: "" };

export default function PartyDialog({ open, onOpenChange, ptype, party, onSaved }) {
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const { isAdmin, settings } = useAuth();
  const credit = ptype === "customer";
  const path = ptype === "customer" ? "customers" : "suppliers";
  useEffect(() => { if (open) setF(party ? { ...EMPTY, ...party } : EMPTY); }, [open, party]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async () => {
    if (!f.name.trim()) return toast.error("Name is required");
    setBusy(true);
    try {
      const body = { ...f, opening_balance: Number(f.opening_balance) || 0,
        credit_limit: isAdmin && f.credit_limit !== "" ? Number(f.credit_limit) : null,
        credit_days: isAdmin && f.credit_days !== "" ? Number(f.credit_days) : null };
      const { data } = party ? await api.put(`/${path}/${party.id}`, body) : await api.post(`/${path}`, body);
      toast.success(`${ptype === "customer" ? "Customer" : "Supplier"} saved`);
      onSaved?.(data);
      onOpenChange(false);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="party-dialog">
        <DialogHeader><DialogTitle>{party ? "Edit" : "New"} {ptype}{party?.code && <span className="ml-2 font-mono text-primary text-sm">#{party.code}</span>}</DialogTitle></DialogHeader>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2 space-y-1"><Label>Name *</Label><Input data-testid="party-name-input" value={f.name} onChange={set("name")} /></div>
          <div className="space-y-1"><Label>Phone</Label><Input data-testid="party-phone-input" value={f.phone} onChange={set("phone")} /></div>
          <div className="space-y-1"><Label>GSTIN</Label><Input data-testid="party-gstin-input" value={f.gstin} onChange={set("gstin")} /></div>
          <div className="space-y-1"><Label>Email</Label><Input data-testid="party-email-input" value={f.email} onChange={set("email")} /></div>
          <div className="space-y-1"><Label>State</Label><Input data-testid="party-state-input" placeholder="e.g. Maharashtra" value={f.state} onChange={set("state")} /></div>
          <div className="sm:col-span-2 space-y-1"><Label>Address</Label><Textarea data-testid="party-address-input" rows={2} value={f.address} onChange={set("address")} /></div>
          {credit && (isAdmin ? (<>
            <div className="space-y-1"><Label>Credit limit (₹, 0 = no credit)</Label>
              <Input data-testid="party-credit-limit-input" type="number" placeholder={`Default ${settings.default_credit_limit ?? ""}`} value={f.credit_limit ?? ""} onChange={set("credit_limit")} /></div>
            <div className="space-y-1"><Label>Credit days (due date)</Label>
              <Input data-testid="party-credit-days-input" type="number" placeholder={`Default ${settings.default_credit_days ?? ""}`} value={f.credit_days ?? ""} onChange={set("credit_days")} /></div>
          </>) : <div className="sm:col-span-2 text-xs text-muted-foreground">Credit limit & credit days can only be set by admin.</div>)}
          {!party && (
            <div className="sm:col-span-2 space-y-1"><Label>Opening balance (₹, + {ptype === "customer" ? "receivable" : "payable"})</Label>
              <Input data-testid="party-opening-input" type="number" value={f.opening_balance} onChange={set("opening_balance")} /></div>
          )}
        </div>
        <DialogFooter><Button data-testid="party-save-btn" onClick={save} disabled={busy}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
