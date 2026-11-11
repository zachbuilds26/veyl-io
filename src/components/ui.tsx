import { useState } from "react";
import type { Asset } from "../lib/assets";
import { percent } from "../lib/format";

export function AssetLogo({
  asset,
  size = 38,
  priority = false,
  round = false,
}: {
  asset: Asset;
  size?: number;
  priority?: boolean;
  round?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const radius = round ? 999 : Math.max(8, Math.round(size * 0.28));

  return (
    <span
      className="asset-logo"
      style={{ width: size, height: size, borderRadius: radius }}
      aria-hidden="true"
    >
      {failed ? (
        <span className="asset-logo-fallback" style={{ fontSize: size * 0.42 }}>
          {asset.ticker.slice(0, 1)}
        </span>
      ) : (
        <img
          src={asset.logo}
          alt=""
          width={size}
          height={size}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}

export function ChangePill({
  value,
  tone = "soft",
}: {
  value: number | null | undefined;
  tone?: "soft" | "plain";
}) {
  const dir = value === null || value === undefined ? "flat" : value > 0.0001 ? "up" : value < -0.0001 ? "down" : "flat";

  return <span className={`chg chg-${dir} chg-${tone}`}>{percent(value)}</span>;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <span className={`sk ${className}`} aria-hidden="true" />;
}
