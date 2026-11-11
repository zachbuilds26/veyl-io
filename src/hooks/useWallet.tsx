import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Address } from "viem";
import { connectAccount, findAccount, injected } from "../lib/wallet";
import { isNimiqPay } from "../lib/nimiq";

type WalletContextValue = {
  account: Address | null;
  connecting: boolean;
  connect: () => Promise<boolean>;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Address | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (!isNimiqPay()) return;
    let alive = true;
    void findAccount().then((found) => {
      if (alive && found) setAccount(found);
    });
    const eth = injected();
    const handler = (...args: unknown[]) => {
      const next = (args[0] as string[] | undefined)?.[0];
      setAccount((next as Address) ?? null);
    };
    eth?.on?.("accountsChanged", handler);
    return () => {
      alive = false;
      eth?.removeListener?.("accountsChanged", handler);
    };
  }, []);

  const connect = useCallback(async () => {
    if (!isNimiqPay() || !injected()) return false;
    setConnecting(true);
    try {
      const next = await connectAccount();
      if (next) setAccount(next);
      return next !== null;
    } finally {
      setConnecting(false);
    }
  }, []);

  return (
    <WalletContext.Provider value={{ account, connecting, connect }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}
