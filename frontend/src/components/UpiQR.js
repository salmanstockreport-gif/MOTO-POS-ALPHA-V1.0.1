import { QRCodeSVG } from "qrcode.react";

export const upiLink = (s, amount, note) =>
  `upi://pay?pa=${encodeURIComponent(s.upi_id)}&pn=${encodeURIComponent(s.name || "Shop")}&am=${Number(amount).toFixed(2)}&cu=INR&tn=${encodeURIComponent(note || "Invoice payment")}`;

export default function UpiQR({ s, amount, note, size = 120, label = true, testid = "upi-qr" }) {
  if (!s?.upi_id || !(Number(amount) > 0)) return null;
  return (
    <div className="inline-flex flex-col items-center gap-1 bg-white text-black p-2 rounded" data-testid={testid}>
      <QRCodeSVG value={upiLink(s, amount, note)} size={size} level="M" />
      {label && <div className="text-[10px] text-center leading-tight font-semibold">Scan & pay ₹{Number(amount).toFixed(2)}<br />UPI: {s.upi_id}</div>}
    </div>
  );
}
