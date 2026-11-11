import { ChartNoAxesCombined, ChartPie } from "lucide-react";
import type { Route } from "../lib/router";

type Props = {
  active: "explore" | "portfolio";
  onNavigate: (route: Route) => void;
};

export function TabBar({ active, onNavigate }: Props) {
  return (
    <nav className="tabbar" aria-label="Sections">
      <button
        type="button"
        className={active === "explore" ? "tab active" : "tab"}
        aria-current={active === "explore" ? "page" : undefined}
        onClick={() => onNavigate({ name: "explore" })}
      >
        <span className="tab-icon">
          <ChartNoAxesCombined size={19} strokeWidth={1.9} aria-hidden="true" />
        </span>
        <span>Stocks</span>
      </button>
      <button
        type="button"
        className={active === "portfolio" ? "tab active" : "tab"}
        aria-current={active === "portfolio" ? "page" : undefined}
        onClick={() => onNavigate({ name: "portfolio" })}
      >
        <span className="tab-icon">
          <ChartPie size={19} strokeWidth={1.9} aria-hidden="true" />
        </span>
        <span>Portfolio</span>
      </button>
    </nav>
  );
}
