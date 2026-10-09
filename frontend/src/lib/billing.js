const r2 = (v) => Math.round((Number(v) + 1e-9) * 100) / 100;

export function calcBill(cart, billDiscount = 0, interstate = false) {
  let lines = cart.map((l) => ({ ...l, total: r2(l.qty * l.rate * (1 - (l.discount || 0) / 100)) }));
  const subtotal = r2(lines.reduce((s, l) => s + l.total, 0));
  const disc = Math.min(Number(billDiscount) || 0, subtotal);
  if (disc && subtotal) lines = lines.map((l) => ({ ...l, total: r2(l.total * ((subtotal - disc) / subtotal)) }));
  let taxable = 0, cgst = 0, sgst = 0, igst = 0;
  lines.forEach((l) => {
    const tx = r2(l.total / (1 + l.gst_rate / 100));
    const tax = r2(l.total - tx);
    taxable += tx;
    if (interstate) igst += tax;
    else { const c = r2(tax / 2); cgst += c; sgst += r2(tax - c); }
  });
  const total = r2(lines.reduce((s, l) => s + l.total, 0));
  const grand = Math.round(total);
  return { lines, subtotal, disc, taxable: r2(taxable), cgst: r2(cgst), sgst: r2(sgst), igst: r2(igst),
    total, roundOff: r2(grand - total), grand };
}
