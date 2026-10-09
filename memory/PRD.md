# MotoPOS — Motorcycle Parts Billing & POS

## Original problem statement
Billing/POS software for motorcycle parts shop, multi-device (PC + mobile): POS billing with part number, description, vehicle fitments; robust DB handling simultaneous sales from multiple devices; customer management with ledgers & payments; GST system with HSN code management; Excel import (items + stock, mappable fields). Admin + Staff roles; Cash/UPI/Card/Credit payments with partial payments; thermal/A4 printable invoices; purchases from suppliers; low-stock alerts.

## Stack
- FastAPI + MongoDB (motor), JWT bearer auth (12h), atomic $inc stock updates + rollback, atomic counters for invoice/purchase/receipt numbering, single `ledger` collection for customers+suppliers.
- React 19 + Tailwind + shadcn/ui, recharts, xlsx (SheetJS) for Excel import/export. Dark/light tactical theme (Chivo/Inter/JetBrains Mono).

## Users / personas
- Admin (ncsasar@gmail.com): full access — items, HSN, purchases, suppliers, users, settings, cancel invoices, GST report.
- Staff: POS billing, customers, payments; no cost prices, no stock edits.

## Implemented
- 2026-10-09: Full MVP — auth (admin seeded), settings, HSN master, items CRUD + tokenized multi-word search (part no/description/fitment/brand/rack), Excel item import w/ column mapping + stock import, customers/suppliers + ledger + payments w/ receipts, Vyapar-style POS bill grid (location column, MRP, disc%, tax, payment box, Save&New / Save&Print), invoice numbering per FY, GST-inclusive pricing with CGST/SGST/IGST by party state, invoices list/filters, thermal 80mm + A4 print w/ HSN summary + amount in words, purchases (stock-in + supplier ledger), dashboard (KPIs, 7-day chart, low stock, top items), GST HSN report + Excel export, users mgmt, POS multi-tab billing (localStorage per tab), expandable long text in items list, logo upload + brand authorisation numbers printed on invoices.

## Backlog
- P1: Barcode scanner hardware mode, invoice edit (non-stock fields), sales returns/credit notes.
- P2: Stock valuation report (cost×qty), daily sales/Z-report print, whatsapp share link for invoice PDF.
- P2: Supplier-wise purchase report, customer-wise sales report.
- P3: Data backup/export (full dump), cloud object storage for logo.

## Next tasks
- Validate logo + brand auths print layout on thermal vs A4 with user's real logo.
- Consider invoice edit for pending credit bills.
