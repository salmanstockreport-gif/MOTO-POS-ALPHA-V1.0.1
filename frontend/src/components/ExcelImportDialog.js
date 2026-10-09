import { useState } from "react";
import * as XLSX from "xlsx";
import { Upload, Download, Loader2, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";

const ITEM_FIELDS = [
  ["part_no", "Part number", true, ["partno", "partnumber", "sku", "itemcode", "code", "part"]],
  ["hsn_code", "HSN code", false, ["hsn", "hsncode", "hsnsac"]],
  ["gst_rate", "GST %", false, ["gst", "gstrate", "tax", "taxrate", "gstpercent"]],
  ["mrp", "MRP", false, ["mrp"]],
  ["purchase_price", "Purchase cost", false, ["purchaseprice", "cost", "costprice", "landing", "purchase"]],
  ["min_stock", "Min stock", false, ["minstock", "reorder", "minimum", "minqty"]],
  ["sale_price", "Sale price", false, ["saleprice", "sellingprice", "price", "rate", "sp"]],
  ["name", "Description", true, ["description", "name", "itemname", "partname", "desc", "particulars"]],
  ["fitments", "Vehicle fitments", false, ["fitment", "fitments", "vehicle", "model", "application", "compatible", "suitablefor"]],
  ["brand", "Brand", false, ["brand", "make", "company", "manufacturer"]],
  ["category", "Category", false, ["category", "group", "type"]],
  ["stock", "Stock qty", false, ["stock", "qty", "quantity", "openingstock", "closing"]],
  ["unit", "Unit", false, ["unit", "uom"]],
  ["location", "Rack / Location", false, ["location", "rack", "bin", "shelf"]],
];
const STOCK_FIELDS = [
  ["part_no", "Part number", true, ["partno", "partnumber", "sku", "itemcode", "code", "part"]],
  ["qty", "Quantity", true, ["qty", "quantity", "stock", "count", "closing"]],
];
const CUSTOMER_FIELDS = [
  ["name", "Customer name", true, ["name", "customername", "party", "partyname", "customer"]],
  ["phone", "Phone", false, ["phone", "mobile", "contact", "phoneno", "mobileno"]],
  ["gstin", "GSTIN", false, ["gstin", "gst", "gstno"]],
  ["email", "Email", false, ["email", "mail"]],
  ["address", "Address", false, ["address", "addr", "city"]],
  ["state", "State", false, ["state"]],
  ["opening_balance", "Opening balance", false, ["openingbalance", "opening", "balance", "due", "outstanding"]],
  ["credit_limit", "Credit limit", false, ["creditlimit", "limit"]],
  ["credit_days", "Credit days", false, ["creditdays", "days", "creditperiod"]],
];
const MODES = {
  items: { fields: ITEM_FIELDS, url: "/items/import", title: "Import parts from Excel", desc: "Upload → map columns → preview → import. Existing part numbers can be updated.", file: "items_import_template.xlsx" },
  stock: { fields: STOCK_FIELDS, url: "/items/stock-import", title: "Update stock from Excel", desc: "Match by part number and add to or replace current stock.", file: "stock_update_template.xlsx" },
  customers: { fields: CUSTOMER_FIELDS, url: "/customers-import", title: "Import customers from Excel", desc: "Map columns. Existing customers are matched by phone. Each new customer gets a 5-digit party code.", file: "customers_import_template.xlsx" },
};
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

function guess(fields, headers) {
  const used = new Set(), map = {};
  fields.forEach(([k, , , syn]) => {
    const h = headers.find((x) => !used.has(x) && syn.some((s) => norm(x) === s)) ||
      headers.find((x) => !used.has(x) && syn.some((s) => norm(x).includes(s)));
    if (h) { map[k] = h; used.add(h); }
  });
  return map;
}

export default function ExcelImportDialog({ open, onOpenChange, mode, onDone }) {
  const cfg = MODES[mode] || MODES.items;
  const fields = cfg.fields;
  const [rows, setRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [map, setMap] = useState({});
  const [fileName, setFileName] = useState("");
  const [opt, setOpt] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const reset = () => { setRows([]); setHeaders([]); setMap({}); setFileName(""); setResult(null); };
  const close = (v) => { if (!v) reset(); onOpenChange(v); };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const wb = XLSX.read(await file.arrayBuffer());
    const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "", raw: false });
    if (!data.length) return toast.error("No rows found in first sheet");
    const hs = Object.keys(data[0]);
    setFileName(file.name); setRows(data); setHeaders(hs); setMap(guess(fields, hs)); setResult(null);
  };

  const template = () => {
    const ws = XLSX.utils.aoa_to_sheet([fields.map((f) => f[1])]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, cfg.file);
  };

  const mapped = rows.map((r) => Object.fromEntries(Object.entries(map).map(([k, h]) => [k, r[h]])));

  const run = async () => {
    const missing = fields.filter(([k, , req]) => req && !map[k] && !(mode === "items" && k === "name"));
    if (missing.length) return toast.error(`Map required field: ${missing.map((m) => m[1]).join(", ")}`);
    setBusy(true);
    const agg = { inserted: 0, updated: 0, errors: [], not_found: [] };
    try {
      for (let i = 0; i < mapped.length; i += 500) {
        const chunk = mapped.slice(i, i + 500);
        const { data } = await api.post(cfg.url, mode === "stock" ? { rows: chunk, mode: opt ? "add" : "set" } : { rows: chunk, update_existing: opt });
        agg.inserted += data.inserted || 0; agg.updated += data.updated || 0;
        agg.errors.push(...(data.errors || []).map((x) => ({ ...x, row: x.row + i })));
        agg.not_found.push(...(data.not_found || []));
      }
      setResult(agg); toast.success("Import complete"); onDone?.();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto" data-testid={`import-dialog-${mode}`}>
        <DialogHeader>
          <DialogTitle>{cfg.title}</DialogTitle>
          <DialogDescription>{cfg.desc}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2 items-center">
          <label className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold cursor-pointer">
            <Upload className="h-4 w-4" /> Choose file
            <input data-testid="import-file-input" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFile} />
          </label>
          <Button data-testid="import-template-btn" variant="outline" onClick={template}><Download className="h-4 w-4 mr-2" />Template</Button>
          {fileName && <span className="text-sm text-muted-foreground" data-testid="import-file-name">{fileName} · {rows.length} rows</span>}
        </div>

        {headers.length > 0 && !result && (<>
          <div>
            <div className="label-xs mb-2">Step 2 · Map columns</div>
            <div className="grid sm:grid-cols-2 gap-2">
              {fields.map(([k, label, req]) => (
                <div key={k} className="flex items-center gap-2">
                  <span className="w-36 text-sm shrink-0">{label}{req && <span className="text-primary"> *</span>}</span>
                  <Select value={map[k] || "__none"} onValueChange={(v) => setMap({ ...map, [k]: v === "__none" ? undefined : v })}>
                    <SelectTrigger className="h-9" data-testid={`map-${k}-select`}><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="__none">— Skip —</SelectItem>
                      {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="label-xs mb-2">Step 3 · Preview (first 5 rows)</div>
            <div className="overflow-x-auto border rounded-md scroll-thin">
              <table className="w-full text-xs" data-testid="import-preview-table">
                <thead className="bg-muted"><tr>{fields.filter(([k]) => map[k]).map(([k, l]) => <th key={k} className="px-2 py-1.5 text-left whitespace-nowrap">{l}</th>)}</tr></thead>
                <tbody>{mapped.slice(0, 5).map((r, i) => (
                  <tr key={i} className="border-t">{fields.filter(([k]) => map[k]).map(([k]) => <td key={k} className="px-2 py-1.5 whitespace-nowrap">{String(r[k] ?? "")}</td>)}</tr>))}</tbody>
              </table>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm"><Switch data-testid="import-option-switch" checked={opt} onCheckedChange={setOpt} />
              {mode === "stock" ? (opt ? "Add quantity to current stock" : "Replace stock with quantity") : (opt ? "Update existing records" : "Skip existing records")}</label>
            <Button data-testid="import-run-btn" onClick={run} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Import {rows.length} rows</Button>
          </div>
        </>)}

        {result && (
          <div className="rounded-md border p-4 space-y-2" data-testid="import-result">
            <div className="flex items-center gap-2 font-semibold text-emerald-500"><CheckCircle2 className="h-5 w-5" />Done</div>
            {mode === "stock" ? <div className="text-sm">Stock updated for <b data-testid="import-result-updated">{result.updated}</b> parts</div>
              : <div className="text-sm">New: <b data-testid="import-result-inserted">{result.inserted}</b> · Updated: <b data-testid="import-result-updated">{result.updated}</b></div>}
            {result.not_found.length > 0 && <div className="text-sm text-amber-500" data-testid="import-not-found">Not found ({result.not_found.length}): {result.not_found.slice(0, 20).join(", ")}</div>}
            {result.errors.length > 0 && <div className="text-sm text-rose-500" data-testid="import-errors">Errors: {result.errors.slice(0, 10).map((x) => `Row ${x.row}: ${x.error}`).join("; ")}</div>}
            <Button variant="outline" onClick={reset} data-testid="import-again-btn">Import another file</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
