import { useEffect, useState } from "react";

export type Route =
  | { name: "explore" }
  | { name: "portfolio" }
  | { name: "stock"; ticker: string };

export function routeFromPath(pathname: string): Route {
  const parts = pathname.split("?")[0].split("/").filter(Boolean);
  if (parts[0] === "portfolio") return { name: "portfolio" };
  if (parts[0] === "stock" && parts[1]) {
    try {
      return { name: "stock", ticker: decodeURIComponent(parts[1]).toUpperCase() };
    } catch {
      return { name: "explore" };
    }
  }
  return { name: "explore" };
}

export function pathFor(route: Route): string {
  if (route.name === "portfolio") return "/portfolio";
  if (route.name === "stock") return `/stock/${encodeURIComponent(route.ticker)}`;
  return "/";
}

function currentPath(): string {
  const hash = window.location.hash.replace(/^#/, "");
  return hash || "/";
}

export function useRoute() {
  const [route, setRoute] = useState<Route>(() => routeFromPath(currentPath()));

  useEffect(() => {
    const onHashChange = () => {
      setRoute(routeFromPath(currentPath()));
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  function navigate(next: Route) {
    const path = pathFor(next);
    if (currentPath() !== path) {
      window.location.hash = path;
    } else {
      setRoute(next);
    }
    window.scrollTo(0, 0);
  }

  return { route, navigate };
}
