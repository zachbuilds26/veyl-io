import { useEffect, useRef, useState } from "react";
import { Check, Wallet } from "lucide-react";
import type { Route } from "../lib/router";
import { shortAddress } from "../lib/format";
import { useWallet } from "../hooks/useWallet";

type Props = {
  active: "explore" | "portfolio";
  onNavigate: (route: Route) => void;
  onConnect: () => void;
};

export function Header({ active, onNavigate, onConnect }: Props) {
  const { account, connecting, connect } = useWallet();
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    },
    [],
  );

  useEffect(() => setCopied(false), [account]);

  async function handleConnect() {
    try {
      const wired = await connect();
      if (!wired) onConnect();
    } catch {
      /* the wallet surfaced its own rejection */
    }
  }

  async function copyAddress() {
    if (!account) return;
    try {
      await navigator.clipboard.writeText(account);
      setCopied(true);
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <header className="hdr">
      <div className="container hdr-inner">
        <button
          type="button"
          className="brand"
          onClick={() => onNavigate({ name: "explore" })}
          aria-label="Veyl home"
        >
          <img
            src={`${import.meta.env.BASE_URL}veyl-mark.png`}
            alt=""
            width={93}
            height={120}
            loading="eager"
            decoding="async"
            className="brand-mark"
          />
          <span className="brand-word">eyl</span>
        </button>

        <nav className="nav" aria-label="Primary">
          <button
            type="button"
            className={active === "explore" ? "nav-link active" : "nav-link"}
            aria-current={active === "explore" ? "page" : undefined}
            onClick={() => onNavigate({ name: "explore" })}
          >
            Stocks
          </button>
          <button
            type="button"
            className={active === "portfolio" ? "nav-link active" : "nav-link"}
            aria-current={active === "portfolio" ? "page" : undefined}
            onClick={() => onNavigate({ name: "portfolio" })}
          >
            Portfolio
          </button>
        </nav>

        <div className="actions">
          {account ? (
            <button
              type="button"
              className="btn btn-ghost btn-connect"
              onClick={() => void copyAddress()}
              title={`Copy address ${account}`}
              aria-label={`Copy address ${account}`}
            >
              {copied ? (
                <Check size={16} strokeWidth={2.2} aria-hidden="true" />
              ) : (
                <Wallet size={16} strokeWidth={1.9} aria-hidden="true" />
              )}
              <span className="btn-connect-addr">{copied ? "Copied" : shortAddress(account)}</span>
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary btn-connect"
              onClick={() => void handleConnect()}
              disabled={connecting}
            >
              <Wallet size={16} strokeWidth={1.9} aria-hidden="true" />
              <span>{connecting ? "Connecting…" : "Connect"}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
