export type NimiqPayWindow = Window & {
  nimiqPay?: {
    language?: string;
    network?: string;
    version?: string;
  };
};

export function isNimiqPay(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean((window as NimiqPayWindow).nimiqPay);
}
