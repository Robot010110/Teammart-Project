import { PackageOpen } from "lucide-react";

const COLLECTION_PHONE = "9647502329961"; // 0750 232 9961, country code applied

// CartonFillingButton.jsx — spec §22: pressing this opens a real, new
// WhatsApp conversation with a pre-filled message every time. Deliberately
// an external wa.me link, not an internal TeamMart chat/model — a
// prototype integration, easy to swap for a real collection workflow
// later without this button's callers needing to change.
export default function CartonFillingButton({ marketName }) {
  const message = `Hello, the carton storage at ${marketName || "our market"} is full. Please come and collect/clear the cartons.`;
  const href = `https://wa.me/${COLLECTION_PHONE}?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 transition-colors duration-200 shadow-lg shadow-emerald-900/20"
    >
      <PackageOpen size={17} /> Request Carton Collection
    </a>
  );
}
