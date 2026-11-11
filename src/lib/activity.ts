export type SwapActivity = {
  id: string;
  hash: string;
  account: string;
  side: "buy" | "sell";
  symbol: string;
  name: string;
  paySymbol: string;
  payAmount: number;
  receiveSymbol: string;
  receiveAmount: number;
  usdValue: number;
  timestamp: number;
};

const KEY = "veyl.activity.v1";
const MAX = 50;
const CHANGE_EVENT = "veyl:activity";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isActivity(item: unknown): item is SwapActivity {
  if (typeof item !== "object" || item === null) return false;
  const entry = item as Partial<SwapActivity>;
  return (
    typeof entry.hash === "string" &&
    typeof entry.account === "string" &&
    (entry.side === "buy" || entry.side === "sell") &&
    typeof entry.symbol === "string" &&
    typeof entry.name === "string" &&
    typeof entry.paySymbol === "string" &&
    typeof entry.receiveSymbol === "string" &&
    isFiniteNumber(entry.payAmount) &&
    isFiniteNumber(entry.receiveAmount) &&
    isFiniteNumber(entry.usdValue) &&
    isFiniteNumber(entry.timestamp)
  );
}

function safeLoad(): SwapActivity[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isActivity);
  } catch {
    return [];
  }
}

function save(items: SwapActivity[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch {
    /* storage unavailable */
  }
}

export function loadActivity(account: string | null): SwapActivity[] {
  if (!account) return [];
  const lowered = account.toLowerCase();
  return safeLoad()
    .filter((item) => item.account.toLowerCase() === lowered)
    .sort((a, b) => b.timestamp - a.timestamp);
}

export function addActivity(entry: Omit<SwapActivity, "id">): void {
  const rest = safeLoad().filter((item) => item.hash !== entry.hash);
  save([{ ...entry, id: entry.hash }, ...rest]);
}

export function clearActivity(account: string | null): void {
  if (!account) return;
  const lowered = account.toLowerCase();
  save(safeLoad().filter((item) => item.account.toLowerCase() !== lowered));
}

export function onActivityChange(handler: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}
