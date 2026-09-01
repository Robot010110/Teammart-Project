// currency.js — Market Activities §2: the Total Sales card can display
// its USD figures in USD, Iraqi Dinar, or Turkish Lira. Every amount this
// app stores/submits (TotalSalesReport.amount) is a plain USD number —
// there is no multi-currency data model, and this app has no live FX
// feed. These rates are a fixed, approximate, DISPLAY-ONLY conversion
// (update them here if they drift too far from reality) — never sent
// back to the backend, never used to convert what a Supervisor typed.

export const CURRENCIES = [
  { code: "USD", symbol: "$", label: "US Dollar", rate: 1 },
  { code: "IQD", symbol: "IQD", label: "Iraqi Dinar", rate: 1310 },
  { code: "TRY", symbol: "₺", label: "Turkish Lira", rate: 34 },
];

export function convertFromUsd(amountUsd, currencyCode) {
  const currency = CURRENCIES.find((c) => c.code === currencyCode) ?? CURRENCIES[0];
  return amountUsd * currency.rate;
}

export function formatCurrency(amountUsd, currencyCode) {
  const currency = CURRENCIES.find((c) => c.code === currencyCode) ?? CURRENCIES[0];
  const converted = convertFromUsd(amountUsd, currencyCode);
  const rounded =
    currency.code === "USD"
      ? converted.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : Math.round(converted).toLocaleString("en-US");
  return currency.code === "USD" ? `${currency.symbol}${rounded}` : `${rounded} ${currency.symbol}`;
}
