import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, FileSpreadsheet, PackagePlus, Pencil, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import PageHeader, { Empty } from "@/components/PageHeader";
import ItemDialog from "@/components/ItemDialog";
import ExcelImportDialog from "@/components/ExcelImportDialog";
import { useAuth } from "@/context/AuthContext";
import { api, inr, errMsg, gstColor } from "@/lib/api";

const PAGE = 50;

export default function Items() {
  const { isAdmin } = useAuth();
  const [sp] = useSearchParams();
  const [q, setQ] = useState("");
  const [low, setLow] = useState(sp.get("low") === "1");
  const [page, setPage] = useState(0);
  const [data, setData] = useState({ items: [], total: 0 });
  const [edit, setEdit] = useState(null);
  const [imp, setImp] = useState(null);

  const load = () => api.get("/items", { params: { q, low_stock: low, limit: PAGE, skip: page * PAGE } }).then((r) => setData(r.data));
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [q, low, page]); // eslint-disable-line
  useEffect(() => setPage(0), [q, low]);

  const del = async (i) => {
    if (!window.confirm(`Delete ${i.part_no}?`)) return;
    try { await api.delete(`/items/${i.id}`); toast.success("Deleted"); load(); } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div>
      <PageHeader title="Parts / Items" sub={`${data.total} parts · part numbers, fitments, HSN & stock`}>
        {isAdmin && (<>
          <Button data-testid="stock-import-btn" variant="outline" onClick={() => setImp("stock")}><PackagePlus className="h-4 w-4 mr-2" />Update stock (Excel)</Button>
          <Button data-testid="items-import-btn" variant="outline" onClick={() => setImp("items")}><FileSpreadsheet className="h-4 w-4 mr-2" />Import items</Button>
          <Button data-testid="add-item-btn" onClick={() => setEdit({})}><Plus className="h-4 w-4 mr-2" />Add part</Button>
        </>)}
      </PageHeader>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input data-testid="items-search-input" className="pl-9" placeholder="Search part no, description, fitment, brand, HSN…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <label className="flex items-center gap-2 text-sm"><Switch data-testid="low-stock-switch" checked={low} onCheckedChange={setLow} />Low stock only</label>
      </div>
      <div className="rounded-lg border bg-card overflow-x-auto scroll-thin">
        <table className="w-full text-sm" data-testid="items-table">
          <thead className="bg-muted/60 label-xs"><tr>
            <th className="text-left px-3 py-3">Part no / Description</th><th className="text-left px-3 hidden md:table-cell">Fitments</th>
            <th className="text-left px-3 hidden sm:table-cell">HSN / GST</th><th className="text-right px-3">Price</th>
            {isAdmin && <th className="text-right px-3 hidden lg:table-cell">Cost</th>}
            <th className="text-right px-3">Stock</th>{isAdmin && <th className="px-3" />}</tr></thead>
          <tbody>
            {data.items.map((i) => (
              <tr key={i.id} className="border-t hover:bg-accent/40" data-testid={`item-row-${i.part_no}`}>
                <td className="px-3 py-2.5"><div className="font-mono text-xs font-bold text-primary">{i.part_no}</div>
                  <div className="font-medium">{i.name}</div><div className="text-[11px] text-muted-foreground">{[i.brand, i.category, i.location].filter(Boolean).join(" · ")}</div></td>
                <td className="px-3 hidden md:table-cell max-w-xs"><div className="flex flex-wrap gap-1">{(i.fitments || []).map((f) => <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-muted">{f}</span>)}</div></td>
                <td className="px-3 hidden sm:table-cell"><div className="font-mono text-xs">{i.hsn_code || "-"}</div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${gstColor(i.gst_rate)}`}>{i.gst_rate}%</span></td>
                <td className="px-3 text-right font-mono">{inr(i.sale_price)}<div className="text-[10px] text-muted-foreground">MRP {inr(i.mrp)}</div></td>
                {isAdmin && <td className="px-3 text-right font-mono hidden lg:table-cell text-muted-foreground">{inr(i.purchase_price)}</td>}
                <td className={`px-3 text-right font-mono font-bold ${i.stock <= 0 ? "text-rose-500" : i.stock <= i.min_stock ? "text-amber-500" : ""}`} data-testid={`item-stock-${i.part_no}`}>{i.stock}<div className="text-[10px] font-normal text-muted-foreground">{i.unit}</div></td>
                {isAdmin && <td className="px-3 text-right whitespace-nowrap">
                  <Button variant="ghost" size="icon" data-testid={`edit-item-${i.part_no}`} onClick={() => setEdit(i)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" data-testid={`delete-item-${i.part_no}`} onClick={() => del(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button></td>}
              </tr>
            ))}
          </tbody>
        </table>
        {data.items.length === 0 && <Empty text="No parts found" />}
      </div>
      {data.total > PAGE && (
        <div className="flex justify-end items-center gap-3 mt-4 text-sm">
          <Button variant="outline" size="sm" data-testid="items-prev-btn" disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</Button>
          <span>Page {page + 1} / {Math.ceil(data.total / PAGE)}</span>
          <Button variant="outline" size="sm" data-testid="items-next-btn" disabled={(page + 1) * PAGE >= data.total} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}
      <ItemDialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)} item={edit?.id ? edit : null} onSaved={load} />
      <ExcelImportDialog open={!!imp} mode={imp || "items"} onOpenChange={(v) => !v && setImp(null)} onDone={load} />
    </div>
  );
}
