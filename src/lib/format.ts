const usd2 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const usd4 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

const compactMoney = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const compactNumber = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const axisTime = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
const axisDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const axisMonth = new Intl.DateTimeFormat("en-US", { month: "short" });
const tipDateTime = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const tipDateYear = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const shortDateTime = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const tokenCompact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 3,
});

export function money(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "n/a";
  const abs = Math.abs(value);
  if (abs > 0 && abs < 1) return usd4.format(value);
  return usd2.format(value);
}

export function compactUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "n/a";
  if (Math.abs(value) < 1000) return money(value);
  return compactMoney.format(value);
}

export function compact(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "n/a";
  return compactNumber.format(value);
}

export function percent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "n/a";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(2)}%`;
}

export function rangeText(low: number | null | undefined, high: number | null | undefined): string {
  if (low === null || low === undefined || high === null || high === undefined) return "n/a";
  return `${money(low)} to ${money(high)}`;
}

export function axisLabel(ts: number, range: string): string {
  const date = new Date(ts);
  if (range === "1D") return axisTime.format(date);
  if (range === "1W") return axisDay.format(date);
  if (range === "1Y") return axisMonth.format(date);
  return axisDay.format(date);
}

export function tipLabel(ts: number, range: string): string {
  const date = new Date(ts);
  if (range === "1D" || range === "1W") return tipDateTime.format(date);
  return tipDateYear.format(date);
}

export function asOf(ts: number | null | undefined): string {
  if (!ts) return "Market data unavailable";
  return `As of ${shortDateTime.format(new Date(ts))}`;
}

export function shortAddress(address: string): string {
  if (!address || address.length <= 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function dateTime(ts: number): string {
  if (!Number.isFinite(ts)) return "n/a";
  return shortDateTime.format(new Date(ts));
}

export function tokenAmount(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) return "0";
  if (value >= 1000) return tokenCompact.format(value);
  return value.toLocaleString("en-US", {
    maximumFractionDigits: value >= 1 ? 4 : 6,
  });
}
