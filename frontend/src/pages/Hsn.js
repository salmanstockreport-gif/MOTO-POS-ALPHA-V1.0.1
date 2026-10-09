import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import PageHeader, { Empty } from "@/components/PageHeader";
import { useAuth } from "@/context/AuthContext";
import { api, errMsg, GST_RATES, gstColor } from "@/lib/api";

function HsnDialog({ h, onClose, onSaved }) {
  const [f, setF] = useState({ code: "", description: "", gst_rate: 18 });
  const [apply, setApply] = useState(true);
  useEffect(() => { if (h) setF(h.id ? h : { code: "", description: "", gst_rate: 18 }); }, [h]);
  const save = async () => {
    if (!f.code.trim()) return toast.error("HSN code required");
    try {
      const body = { code: f.code, description: f.description, gst_rate: Number(f.gst_rate) };
      if (h.id) {
        const { data } = await api.put(`/hsn/${h.id}`, body, { params: { apply_to_items: apply } });
        toast.success(`HSN saved${data.items_updated ? ` · ${data.items_updated} items updated` : ""}`);
      } else { await api.post("/hsn", body); toast.success("HSN added"); }
      onSaved(); onClose();
    } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <Dialog open={!!h} onOpenChange={(v) => !v && onClose()}>
      <DialogContent data-testid="hsn-dialog">
        <DialogHeader><DialogTitle>{h?.id ? "Edit" : "New"} HSN code</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>HSN code</Label><Input data-testid="hsn-code-input" className="font-mono" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></div>
          <div className="space-y-1"><Label>Description</Label><Input data-testid="hsn-desc-input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div className="space-y-1"><Label>GST rate</Label>
            <Select value={String(f.gst_rate)} onValueChange={(v) => setF({ ...f, gst_rate: Number(v) })}>
              <SelectTrigger data-testid="hsn-gst-select"><SelectValue /></SelectTrigger>
              <SelectContent>{GST_RATES.map((r) => <SelectItem key={r} value={String(r)}>{r}% (CGST {r / 2}% + SGST {r / 2}%)</SelectItem>)}</SelectContent>
            </Select></div>
          {h?.id && <label className="flex items-center gap-2 text-sm"><Checkbox data-testid="hsn-apply-checkbox" checked={apply} onCheckedChange={setApply} />Apply new rate to all parts with this HSN</label>}
        </div>
        <DialogFooter><Button data-testid="hsn-save-btn" onClick={save}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Hsn() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState(null);
  const load = () => api.get("/hsn", { params: { q } }).then((r) => setRows(r.data));
  useEffect(() => { load(); }, [q]); // eslint-disable-line
  const del = async (h) => {
    if (!window.confirm(`Delete HSN ${h.code}?`)) return;
    await api.delete(`/hsn/${h.id}`); load();
  };
  return (
    <div>
      <PageHeader title="HSN & GST" sub="Manage HSN codes and their GST rates. Intra-state = CGST + SGST, inter-state = IGST.">
        {isAdmin && <Button data-testid="add-hsn-btn" onClick={() => setEdit({})}><Plus className="h-4 w-4 mr-2" />Add HSN</Button>}
      </PageHeader>
      <Input data-testid="hsn-search-input" className="mb-4 max-w-sm" placeholder="Search code or description" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm" data-testid="hsn-table">
          <thead className="bg-muted/60 label-xs"><tr><th className="text-left px-4 py-3">HSN</th><th className="text-left px-4">Description</th>
            <th className="px-4">GST</th><th className="px-4 hidden sm:table-cell">CGST / SGST</th><th className="px-4 hidden sm:table-cell">IGST</th><th className="px-4">Parts</th>{isAdmin && <th />}</tr></thead>
          <tbody>{rows.map((h) => (
            <tr key={h.id} className="border-t" data-testid={`hsn-row-${h.code}`}>
              <td className="px-4 py-3 font-mono font-bold">{h.code}</td><td className="px-4">{h.description}</td>
              <td className="px-4 text-center"><span className={`text-xs font-bold px-2 py-0.5 rounded border ${gstColor(h.gst_rate)}`}>{h.gst_rate}%</span></td>
              <td className="px-4 text-center font-mono hidden sm:table-cell">{h.gst_rate / 2}% / {h.gst_rate / 2}%</td>
              <td className="px-4 text-center font-mono hidden sm:table-cell">{h.gst_rate}%</td>
              <td className="px-4 text-center font-mono">{h.item_count}</td>
              {isAdmin && <td className="px-2 text-right whitespace-nowrap">
                <Button variant="ghost" size="icon" data-testid={`edit-hsn-${h.code}`} onClick={() => setEdit(h)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" data-testid={`delete-hsn-${h.code}`} onClick={() => del(h)}><Trash2 className="h-4 w-4 text-destructive" /></Button></td>}
            </tr>))}</tbody>
        </table>
        {rows.length === 0 && <Empty text="No HSN codes" />}
      </div>
      <HsnDialog h={edit} onClose={() => setEdit(null)} onSaved={load} />
    </div>
  );
}
