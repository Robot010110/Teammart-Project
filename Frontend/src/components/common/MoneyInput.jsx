import { formatMoney, parseMoneyInput } from "../../utils/money";

// MoneyInput.jsx — a text input (never type="number", which silently
// rejects the comma characters a formatted display needs) that shows a
// comma-grouped value as the user types while the value it reports back
// via onChange is always a plain numeric string ("1000000", never
// "1,000,000") — the caller stores/submits exactly that, never the
// display string. Cleanup Phase §11. Whole numbers only — every amount
// in this app's money workflow (Total Sales) is a round figure, per
// every example in the spec (1,000 / 10,000 / 25,000,000, never cents);
// digits-only also sidesteps the classic "reformatting mid-typing eats
// the trailing decimal point" bug a live-formatted decimal input has.
export default function MoneyInput({ value, onChange, className, placeholder, ...rest }) {
  function handleChange(e) {
    const raw = parseMoneyInput(e.target.value).replace(/\D/g, "");
    onChange(raw);
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={value === "" || value == null ? "" : formatMoney(value)}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
      {...rest}
    />
  );
}
