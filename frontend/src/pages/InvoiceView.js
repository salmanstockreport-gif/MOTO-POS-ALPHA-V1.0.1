import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Printer, Ban, ScanBarcode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { api, inr, errMsg, amountInWords } from "@/lib/api";
import UpiQR from "@/components/UpiQR";

const qrAmount = (inv) => {
  if (inv.status !== "active") return 0;
  if (inv.due > 0) return inv.due;
  return inv.payments.filter((p) => p.mode === "upi").reduce((t, p) => t + p.amount, 0);
};

const n2 = (v) => Number(v || 0).toFixed(2);

function hsnSummary(lines) {
  const m = {};
  lines.forEach((l) => {
    const k = `${l.hsn_code}|${l.gst_rate}`;
    m[k] = m[k] || { hsn: l.hsn_code, rate: l.gst_rate, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
    ["taxable", "cgst", "sgst", "igst"].forEach((x) => (m[k][x] += l[x]));
  });
  return Object.values(m);
}

function Auths({ s, cls = "" }) {
  const a = (s.brand_auths || []).filter((b) => b.brand || b.auth_no);
  if (!a.length) return null;
  return (
    <div className={cls} data-testid="invoice-brand-auths">
      <span className="font-bold">Authorised dealer: </span>
      {a.map((b, i) => <span key={i}>{b.brand}{b.auth_no && ` (${b.auth_no})`}{i < a.length - 1 ? " · " : ""}</span>)}
    </div>
  );
}

function Thermal({ inv, s }) {
  return (
    <div className="w-[76mm] mx-auto bg-white text-black p-3 font-mono text-[11px] leading-tight" data-testid="invoice-thermal">
      <div className="text-center">{s.logo && <img src={s.logo} alt="logo" className="mx-auto max-h-14 mb-1 grayscale" data-testid="invoice-logo" />}<div className="font-bold text-sm">{s.name}</div><div>{s.address}</div><div>{s.phone}</div>
        {s.gstin && <div>GSTIN: {s.gstin}</div>}<div className="font-bold mt-1 border-y border-dashed border-black py-1">TAX INVOICE</div></div>
      <div className="my-1">No: {inv.number}<br />Date: {inv.date}<br />Cust: {inv.customer.name}{inv.customer_code && ` #${inv.customer_code}`} {inv.customer.phone}
        {inv.customer.gstin && <><br />GSTIN: {inv.customer.gstin}</>}{inv.vehicle_no && <><br />Vehicle: {inv.vehicle_no}</>}</div>
      <div className="border-t border-dashed border-black" />
      {inv.lines.map((l, i) => (
        <div key={i} className="py-0.5"><div>{l.name}</div>
          <div className="flex justify-between"><span>{l.part_no} {l.qty}x{n2(l.rate)}{l.discount ? ` -${l.discount}%` : ""}</span><span>{n2(l.total)}</span></div>
          <div className="text-[9px]">HSN {l.hsn_code} GST {l.gst_rate}%</div></div>))}
      <div className="border-t border-dashed border-black mt-1 pt-1 space-y-0.5">
        {inv.bill_discount > 0 && <div className="flex justify-between"><span>Discount</span><span>-{n2(inv.bill_discount)}</span></div>}
        <div className="flex justify-between"><span>Taxable</span><span>{n2(inv.taxable_total)}</span></div>
        {inv.interstate ? <div className="flex justify-between"><span>IGST</span><span>{n2(inv.igst_total)}</span></div> : <>
          <div className="flex justify-between"><span>CGST</span><span>{n2(inv.cgst_total)}</span></div>
          <div className="flex justify-between"><span>SGST</span><span>{n2(inv.sgst_total)}</span></div></>}
        <div className="flex justify-between"><span>Round off</span><span>{n2(inv.round_off)}</span></div>
        <div className="flex justify-between font-bold text-sm border-y border-dashed border-black py-1"><span>TOTAL</span><span>₹{n2(inv.grand_total)}</span></div>
        {inv.payments.map((p, i) => <div key={i} className="flex justify-between"><span>{p.mode.toUpperCase()}</span><span>{n2(p.amount)}</span></div>)}
        {inv.change > 0 && <div className="flex justify-between"><span>Change</span><span>{n2(inv.change)}</span></div>}
        {inv.due > 0 && <div className="flex justify-between font-bold"><span>Balance due</span><span>{n2(inv.due)}</span></div>}
        {inv.due_date && <div className="flex justify-between"><span>Due date</span><span>{inv.due_date}</span></div>}
      </div>
      <div className="text-center mt-2"><UpiQR s={s} amount={qrAmount(inv)} note={inv.number} size={110} testid="invoice-upi-qr" /></div>
      {inv.notes && <div className="mt-1">Note: {inv.notes}</div>}
      <Auths s={s} cls="mt-2 text-[10px] text-center" />
      <div className="text-center mt-2">{s.footer_note || "Thank you! Visit again."}</div>
    </div>
  );
}

function A4({ inv, s }) {
  const hs = hsnSummary(inv.lines);
  const cell = "border border-black px-1.5 py-1";
  return (
    <div className="max-w-[210mm] mx-auto bg-white text-black p-6 text-[12px]" data-testid="invoice-a4">
      <div className="flex justify-between border-b-2 border-black pb-3">
        <div className="flex gap-4">{s.logo && <img src={s.logo} alt="logo" className="h-20 w-auto max-w-[140px] object-contain" data-testid="invoice-logo" />}<div><div className="text-xl font-extrabold">{s.name}</div><div className="whitespace-pre-line">{s.address}</div>
          <div>{s.phone} {s.email}</div>{s.gstin && <div className="font-bold">GSTIN: {s.gstin}</div>}<div>State: {s.state}</div></div></div>
        <div className="text-right"><div className="text-lg font-bold">TAX INVOICE</div><div>No: <b>{inv.number}</b></div><div>Date: {inv.date}</div>
          {inv.status === "cancelled" && <div className="text-red-600 font-bold text-lg">CANCELLED</div>}</div>
      </div>
      <Auths s={s} cls="py-1.5 border-b border-black text-[11px]" />
      <div className="grid grid-cols-2 gap-4 py-3 border-b border-black">
        <div><div className="font-bold">Bill to</div><div>{inv.customer.name}{inv.customer_code && ` (#${inv.customer_code})`}</div><div>{inv.customer.address}</div><div>{inv.customer.phone}</div>
          {inv.customer.gstin && <div>GSTIN: {inv.customer.gstin}</div>}{inv.customer.state && <div>State: {inv.customer.state}</div>}</div>
        <div className="text-right">{inv.vehicle_no && <div>Vehicle: <b>{inv.vehicle_no}</b></div>}<div>Supply: {inv.interstate ? "Inter-state (IGST)" : "Intra-state (CGST+SGST)"}</div></div>
      </div>
      <table className="w-full border-collapse mt-3">
        <thead><tr className="bg-gray-100">{["#", "Part No", "Description", "HSN", "Qty", "Rate", "Disc%", "Taxable", "GST%", "Tax", "Amount"].map((h) => <th key={h} className={cell}>{h}</th>)}</tr></thead>
        <tbody>{inv.lines.map((l, i) => (
          <tr key={i}><td className={cell}>{i + 1}</td><td className={`${cell} font-mono`}>{l.part_no}</td><td className={cell}>{l.name}</td><td className={cell}>{l.hsn_code}</td>
            <td className={`${cell} text-right`}>{l.qty}</td><td className={`${cell} text-right`}>{n2(l.rate)}</td><td className={`${cell} text-right`}>{l.discount || 0}</td>
            <td className={`${cell} text-right`}>{n2(l.taxable)}</td><td className={`${cell} text-right`}>{l.gst_rate}</td>
            <td className={`${cell} text-right`}>{n2(l.cgst + l.sgst + l.igst)}</td><td className={`${cell} text-right`}>{n2(l.total)}</td></tr>))}</tbody>
      </table>
      <div className="grid grid-cols-2 gap-4 mt-3">
        <table className="border-collapse self-start text-[11px]"><thead><tr className="bg-gray-100">{["HSN", "GST%", "Taxable", inv.interstate ? "IGST" : "CGST", ...(inv.interstate ? [] : ["SGST"])].map((h) => <th key={h} className={cell}>{h}</th>)}</tr></thead>
          <tbody>{hs.map((h) => <tr key={h.hsn + h.rate}><td className={cell}>{h.hsn}</td><td className={cell}>{h.rate}</td><td className={`${cell} text-right`}>{n2(h.taxable)}</td>
            {inv.interstate ? <td className={`${cell} text-right`}>{n2(h.igst)}</td> : <><td className={`${cell} text-right`}>{n2(h.cgst)}</td><td className={`${cell} text-right`}>{n2(h.sgst)}</td></>}</tr>)}</tbody></table>
        <div className="space-y-1">
          {inv.bill_discount > 0 && <div className="flex justify-between"><span>Bill discount</span><span>-{n2(inv.bill_discount)}</span></div>}
          <div className="flex justify-between"><span>Taxable value</span><span>{n2(inv.taxable_total)}</span></div>
          {inv.interstate ? <div className="flex justify-between"><span>IGST</span><span>{n2(inv.igst_total)}</span></div> : <>
            <div className="flex justify-between"><span>CGST</span><span>{n2(inv.cgst_total)}</span></div><div className="flex justify-between"><span>SGST</span><span>{n2(inv.sgst_total)}</span></div></>}
          <div className="flex justify-between"><span>Round off</span><span>{n2(inv.round_off)}</span></div>
          <div className="flex justify-between font-bold text-base border-t-2 border-black pt-1"><span>Grand Total</span><span>₹{n2(inv.grand_total)}</span></div>
          <div className="flex justify-between"><span>Paid ({inv.payments.map((p) => p.mode.toUpperCase()).join(", ") || "-"})</span><span>{n2(inv.paid)}</span></div>
          {inv.due > 0 && <div className="flex justify-between font-bold"><span>Balance due</span><span>{n2(inv.due)}</span></div>}
          {inv.due_date && <div className="flex justify-between"><span>Payment due date</span><span>{inv.due_date}</span></div>}
          <div className="flex justify-end pt-2"><UpiQR s={s} amount={qrAmount(inv)} note={inv.number} size={100} testid="invoice-upi-qr" /></div>
        </div>
      </div>
      <div className="mt-3 border-t border-black pt-2"><b>Amount in words:</b> {amountInWords(inv.grand_total)}</div>
      {inv.notes && <div className="mt-1"><b>Notes:</b> {inv.notes}</div>}
      <div className="flex justify-between mt-10"><div className="text-[11px]">{s.footer_note}{s.upi_id && <div>UPI: {s.upi_id}</div>}</div>
        <div className="text-center"><div className="h-10" /><div className="border-t border-black px-6">For {s.name}<br />Authorised Signatory</div></div></div>
    </div>
  );
}

export default function InvoiceView() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const { isAdmin, settings } = useAuth();
  const [inv, setInv] = useState(null);
  const [fmt, setFmt] = useState(() => localStorage.getItem("mp_print_fmt") || "thermal");
  const load = () => api.get(`/invoices/${id}`).then((r) => setInv(r.data));
  useEffect(() => { load(); }, [id]); // eslint-disable-line
  useEffect(() => { localStorage.setItem("mp_print_fmt", fmt); }, [fmt]);
  useEffect(() => { if (inv && sp.get("print") === "1") setTimeout(() => window.print(), 500); }, [inv]); // eslint-disable-line

  const cancel = async () => {
    if (!window.confirm("Cancel this invoice? Stock and ledger will be reversed.")) return;
    try { await api.post(`/invoices/${id}/cancel`); toast.success("Invoice cancelled"); load(); } catch (e) { toast.error(errMsg(e)); }
  };
  if (!inv) return <div className="label-xs">Loading…</div>;

  return (
    <div>
      <style>{`@media print { @page { size: ${fmt === "thermal" ? "80mm auto" : "A4"}; margin: ${fmt === "thermal" ? "2mm" : "8mm"}; } }`}</style>
      <div className="no-print flex flex-wrap gap-2 justify-between mb-4">
        <Button variant="ghost" asChild data-testid="invoice-back-btn"><Link to="/invoices"><ArrowLeft className="h-4 w-4 mr-2" />Invoices</Link></Button>
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-md border overflow-hidden">
            {["thermal", "a4"].map((f) => <button key={f} data-testid={`format-${f}-btn`} onClick={() => setFmt(f)}
              className={`px-3 h-9 text-sm font-semibold ${fmt === f ? "bg-primary text-primary-foreground" : ""}`}>{f === "a4" ? "A4" : "Thermal 80mm"}</button>)}
          </div>
          <Button data-testid="invoice-print-btn" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />Print / PDF</Button>
          {isAdmin && inv.status === "active" && <Button variant="outline" data-testid="invoice-cancel-btn" onClick={cancel}><Ban className="h-4 w-4 mr-2 text-destructive" />Cancel</Button>}
          <Button variant="outline" asChild data-testid="invoice-new-bill-btn"><Link to="/pos"><ScanBarcode className="h-4 w-4 mr-2" />New bill</Link></Button>
        </div>
      </div>
      {inv.status === "cancelled" && <div className="no-print mb-3 text-sm text-rose-500 font-semibold" data-testid="invoice-cancelled-banner">This invoice was cancelled by {inv.cancelled_by}</div>}
      <div className="print-area overflow-x-auto rounded-lg border bg-white shadow-sm py-4">
        {fmt === "thermal" ? <Thermal inv={inv} s={settings} /> : <A4 inv={inv} s={settings} />}
      </div>
    </div>
  );
}
