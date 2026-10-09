import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import PageHeader, { Empty, Stat } from "@/components/PageHeader";
import PartyDialog from "@/components/PartyDialog";
import { api, inr } from "@/lib/api";

export default function Parties({ ptype }) {
  const nav = useNavigate();
  const path = ptype === "customer" ? "customers" : "suppliers";
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [due, setDue] = useState(false);
  const [add, setAdd] = useState(false);
  const load = () => api.get(`/${path}`, { params: { q, with_balance: due, limit: 1000 } }).then((r) => setRows(r.data));
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [q, due, path]); // eslint-disable-line
  const total = rows.reduce((s, r) => s + (r.balance > 0 ? r.balance : 0), 0);
  const isC = ptype === "customer";

  return (
    <div>
      <PageHeader title={isC ? "Customers" : "Suppliers"} sub={isC ? "Customer ledgers, udhaar & payment collection" : "Supplier accounts & payables"}>
        <Button data-testid={`add-${ptype}-btn`} onClick={() => setAdd(true)}><Plus className="h-4 w-4 mr-2" />New {ptype}</Button>
      </PageHeader>
      <div className="grid grid-cols-2 gap-3 mb-4 max-w-lg">
        <Stat label={isC ? "Outstanding receivable" : "Outstanding payable"} value={inr(total)} tone="text-rose-500" testid={`${ptype}-outstanding`} />
        <Stat label={isC ? "Customers" : "Suppliers"} value={rows.length} testid={`${ptype}-count`} />
      </div>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input data-testid={`${ptype}-search-input`} className="pl-9" placeholder="Search name, phone, GSTIN" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <label className="flex items-center gap-2 text-sm"><Switch data-testid={`${ptype}-due-switch`} checked={due} onCheckedChange={setDue} />With balance only</label>
      </div>
      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm" data-testid={`${ptype}-table`}>
          <thead className="bg-muted/60 label-xs"><tr><th className="text-left px-4 py-3">Name</th><th className="text-left px-4">Phone</th>
            <th className="text-left px-4 hidden md:table-cell">GSTIN</th><th className="text-left px-4 hidden md:table-cell">State</th><th className="text-right px-4">Balance</th></tr></thead>
          <tbody>{rows.map((c) => (
            <tr key={c.id} className="border-t cursor-pointer hover:bg-accent/40" onClick={() => nav(`/${path}/${c.id}`)} data-testid={`${ptype}-row-${c.id}`}>
              <td className="px-4 py-3 font-medium">{c.name}</td><td className="px-4 font-mono text-xs">{c.phone}</td>
              <td className="px-4 font-mono text-xs hidden md:table-cell">{c.gstin}</td><td className="px-4 hidden md:table-cell">{c.state}</td>
              <td className={`px-4 text-right font-mono font-bold ${c.balance > 0 ? "text-rose-500" : c.balance < 0 ? "text-emerald-500" : ""}`}>{inr(c.balance)}</td>
            </tr>))}</tbody>
        </table>
        {rows.length === 0 && <Empty text={`No ${path} found`} />}
      </div>
      <PartyDialog open={add} onOpenChange={setAdd} ptype={ptype} onSaved={load} />
    </div>
  );
}
