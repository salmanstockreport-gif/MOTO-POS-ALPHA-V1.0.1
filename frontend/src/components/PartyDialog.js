import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";

const EMPTY = { name: "", phone: "", email: "", gstin: "", address: "", state: "", opening_balance: 0 };

export default function PartyDialog({ open, onOpenChange, ptype, party, onSaved }) {
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const path = ptype === "customer" ? "customers" : "suppliers";
  useEffect(() => { if (open) setF(party ? { ...EMPTY, ...party } : EMPTY); }, [open, party]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async () => {
    if (!f.name.trim()) return toast.error("Name is required");
    setBusy(true);
    try {
      const body = { ...f, opening_balance: Number(f.opening_balance) || 0 };
      const { data } = party ? await api.put(`/${path}/${party.id}`, body) : await api.post(`/${path}`, body);
      toast.success(`${ptype === "customer" ? "Customer" : "Supplier"} saved`);
      onSaved?.(data);
      onOpenChange(false);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="party-dialog">
        <DialogHeader><DialogTitle>{party ? "Edit" : "New"} {ptype}</DialogTitle></DialogHeader>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2 space-y-1"><Label>Name *</Label><Input data-testid="party-name-input" value={f.name} onChange={set("name")} /></div>
          <div className="space-y-1"><Label>Phone</Label><Input data-testid="party-phone-input" value={f.phone} onChange={set("phone")} /></div>
          <div className="space-y-1"><Label>GSTIN</Label><Input data-testid="party-gstin-input" value={f.gstin} onChange={set("gstin")} /></div>
          <div className="space-y-1"><Label>Email</Label><Input data-testid="party-email-input" value={f.email} onChange={set("email")} /></div>
          <div className="space-y-1"><Label>State</Label><Input data-testid="party-state-input" placeholder="e.g. Maharashtra" value={f.state} onChange={set("state")} /></div>
          <div className="sm:col-span-2 space-y-1"><Label>Address</Label><Textarea data-testid="party-address-input" rows={2} value={f.address} onChange={set("address")} /></div>
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
