import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PageHeader, { Empty } from "@/components/PageHeader";
import { api, inr, todayStr } from "@/lib/api";

const COLS = ["taxable", "cgst", "sgst", "igst", "total"];

export default function GstReport() {
  const [from, setFrom] = useState(todayStr().slice(0, 8) + "01");
  const [to, setTo] = useState(todayStr());
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get("/reports/gst", { params: { date_from: from, date_to: to } }).then((r) => setRows(r.data)); }, [from, to]);
  const tot = Object.fromEntries(COLS.map((c) => [c, rows.reduce((s, r) => s + r[c], 0)]));
  const exportX = () => {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "HSN Summary");
    XLSX.writeFile(wb, `gst_hsn_${from}_${to}.xlsx`);
  };
  return (
    <div>
      <PageHeader title="GST Report" sub="HSN-wise sales summary (for GSTR-1)">
        <Button variant="outline" data-testid="gst-export-btn" onClick={exportX} disabled={!rows.length}><Download className="h-4 w-4 mr-2" />Export Excel</Button>
      </PageHeader>
      <div className="flex gap-3 mb-4 max-w-md">
        <Input data-testid="gst-from-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input data-testid="gst-to-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm" data-testid="gst-table">
          <thead className="bg-muted/60 label-xs"><tr><th className="text-left px-4 py-3">HSN</th><th className="px-4">GST%</th><th className="text-right px-4">Qty</th>
            {COLS.map((c) => <th key={c} className="text-right px-4">{c.toUpperCase()}</th>)}</tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.hsn_code + r.gst_rate} className="border-t"><td className="px-4 py-2.5 font-mono">{r.hsn_code || "-"}</td><td className="px-4 text-center">{r.gst_rate}</td>
              <td className="px-4 text-right font-mono">{r.qty}</td>{COLS.map((c) => <td key={c} className="px-4 text-right font-mono">{inr(r[c])}</td>)}</tr>))}
            {rows.length > 0 && <tr className="border-t font-bold bg-muted/40"><td className="px-4 py-2.5" colSpan={3}>Total</td>
              {COLS.map((c) => <td key={c} className="px-4 text-right font-mono" data-testid={`gst-total-${c}`}>{inr(tot[c])}</td>)}</tr>}</tbody>
        </table>
        {rows.length === 0 && <Empty text="No sales in this period" />}
      </div>
    </div>
  );
}
