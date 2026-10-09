import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import { api, errMsg } from "@/lib/api";

const EMPTY = { name: "", email: "", password: "", role: "staff", active: true };

export default function Users() {
  const [rows, setRows] = useState([]);
  const [edit, setEdit] = useState(null);
  const [f, setF] = useState(EMPTY);
  const load = () => api.get("/users").then((r) => setRows(r.data));
  useEffect(() => { load(); }, []);
  const open = (u) => { setEdit(u); setF(u.id ? { ...u, password: "" } : EMPTY); };
  const save = async () => {
    try {
      if (edit.id) await api.put(`/users/${edit.id}`, f); else await api.post("/users", f);
      toast.success("User saved"); setEdit(null); load();
    } catch (e) { toast.error(errMsg(e)); }
  };
  const del = async (u) => {
    if (!window.confirm(`Delete ${u.email}?`)) return;
    try { await api.delete(`/users/${u.id}`); load(); } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div>
      <PageHeader title="Users" sub="Admin: full access · Staff: billing, customers & payments (no cost prices, stock edits or settings)">
        <Button data-testid="add-user-btn" onClick={() => open({})}><Plus className="h-4 w-4 mr-2" />Add user</Button>
      </PageHeader>
      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm" data-testid="users-table">
          <thead className="bg-muted/60 label-xs"><tr><th className="text-left px-4 py-3">Name</th><th className="text-left px-4">Email</th><th className="px-4">Role</th><th className="px-4">Status</th><th /></tr></thead>
          <tbody>{rows.map((u) => (
            <tr key={u.id} className="border-t" data-testid={`user-row-${u.email}`}>
              <td className="px-4 py-3 font-medium">{u.name}</td><td className="px-4">{u.email}</td>
              <td className="px-4 text-center"><span className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded border ${u.role === "admin" ? "text-primary border-primary/40" : ""}`}>{u.role}</span></td>
              <td className={`px-4 text-center text-xs ${u.active ? "text-emerald-500" : "text-rose-500"}`}>{u.active ? "Active" : "Disabled"}</td>
              <td className="px-2 text-right whitespace-nowrap"><Button variant="ghost" size="icon" data-testid={`edit-user-${u.email}`} onClick={() => open(u)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" data-testid={`delete-user-${u.email}`} onClick={() => del(u)}><Trash2 className="h-4 w-4 text-destructive" /></Button></td>
            </tr>))}</tbody>
        </table>
      </div>
      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent data-testid="user-dialog">
          <DialogHeader><DialogTitle>{edit?.id ? "Edit user" : "New user"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Name</Label><Input data-testid="user-name-input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
            <div className="space-y-1"><Label>Email</Label><Input data-testid="user-email-input" disabled={!!edit?.id} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
            <div className="space-y-1"><Label>{edit?.id ? "New password (leave blank to keep)" : "Password"}</Label><Input data-testid="user-password-input" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
            <div className="flex items-center justify-between gap-4">
              <Select value={f.role} onValueChange={(v) => setF({ ...f, role: v })}>
                <SelectTrigger data-testid="user-role-select" className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="staff">Staff</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent>
              </Select>
              <label className="flex items-center gap-2 text-sm"><Switch data-testid="user-active-switch" checked={f.active} onCheckedChange={(v) => setF({ ...f, active: v })} />Active</label>
            </div>
          </div>
          <DialogFooter><Button data-testid="user-save-btn" onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
