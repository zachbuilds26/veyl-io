import { useCallback, useEffect, useState } from "react";
import { ConnectDialog } from "./components/ConnectDialog";
import { EligibilityGate, RegionBlocked, markEligibility, readEligibility } from "./components/EligibilityGate";
import { Explore } from "./components/Explore";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { Portfolio } from "./components/Portfolio";
import { StockDetail } from "./components/StockDetail";
import { TabBar } from "./components/TabBar";
import { useMarket } from "./hooks/useMarket";
import { WalletProvider } from "./hooks/useWallet";
import { useRoute } from "./lib/router";

type GeoState =
  | { status: "checking" }
  | { status: "ok" }
  | { status: "blocked" }
  | { status: "error" };

export default function App() {
  const { route, navigate } = useRoute();
  const market = useMarket();
  const [connectOpen, setConnectOpen] = useState(false);
  const [accepted, setAccepted] = useState(() => readEligibility());
  const [geo, setGeo] = useState<GeoState>({ status: "checking" });
  const [geoAttempt, setGeoAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 8000);
    setGeo({ status: "checking" });
    fetch("/api/geo", { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Availability check failed (${res.status}).`);
        return (await res.json()) as { blocked?: unknown };
      })
      .then((body) => {
        if (!alive) return;
        setGeo(body?.blocked === true ? { status: "blocked" } : { status: "ok" });
      })
      .catch(() => {
        if (alive) setGeo({ status: "error" });
      })
      .finally(() => window.clearTimeout(timer));
    return () => {
      alive = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [geoAttempt]);

  const active: "explore" | "portfolio" = route.name === "portfolio" ? "portfolio" : "explore";
  const openConnect = () => setConnectOpen(true);
  const closeConnect = useCallback(() => setConnectOpen(false), []);

  if (geo.status === "checking") {
    return (
      <div className="gate gate-splash" role="status" aria-label="Checking availability">
        <img
          src={`${import.meta.env.BASE_URL}veyl-mark.png`}
          alt=""
          width={62}
          height={80}
          className="gate-mark"
        />
      </div>
    );
  }
  if (geo.status === "blocked") {
    return <RegionBlocked />;
  }
  if (geo.status === "error") {
    return (
      <div className="gate">
        <span className="dots-backdrop" aria-hidden="true" />
        <div className="gate-blocked">
          <h1>Availability check failed</h1>
          <p className="gate-blocked-lead">
            Veyl could not confirm which region you are connecting from, so it cannot safely open.
          </p>
          <p className="gate-blocked-note">
            Check your connection and try again. Veyl stays closed until the check succeeds.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setGeoAttempt((n) => n + 1)}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
  if (!accepted) {
    return (
      <EligibilityGate
        onAccept={() => {
          markEligibility();
          setAccepted(true);
        }}
      />
    );
  }

  return (
    <WalletProvider>
      <div className="app">
        <Header active={active} onNavigate={navigate} onConnect={openConnect} />

        <main className="main">
          {route.name === "portfolio" ? (
            <Portfolio
              market={market.data}
              marketError={market.error}
              onExplore={() => navigate({ name: "explore" })}
              onSelect={(ticker) => navigate({ name: "stock", ticker })}
              onConnect={openConnect}
            />
          ) : route.name === "stock" ? (
            <StockDetail
              key={route.ticker}
              ticker={route.ticker}
              market={market.data}
              onBack={() => navigate({ name: "explore" })}
              onConnect={openConnect}
            />
          ) : (
            <Explore
              market={market.data}
              loading={market.loading}
              error={market.error}
              onRetry={market.reload}
              onSelect={(ticker) => navigate({ name: "stock", ticker })}
            />
          )}
        </main>

        <Footer />
        <TabBar active={active} onNavigate={navigate} />
        <ConnectDialog open={connectOpen} onClose={closeConnect} />
      </div>
    </WalletProvider>
  );
}
