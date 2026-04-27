import { lazy, type ComponentType, type JSX } from "react";

import { TmaFeedPage } from "@/tma/pages/TmaFeedPage";
import { MarketDetailPage } from "@/tma/pages/MarketDetailPage";
import { TmaPageWrapper } from "@/tma/components/TmaPageWrapper";

// Eagerly loaded — on the critical render path
import { IndexPage } from "@/tma/pages/IndexPage/IndexPage";
import { InitDataPage } from "@/tma/pages/InitDataPage.tsx";
import { LaunchParamsPage } from "@/tma/pages/LaunchParamsPage.tsx";
import { ThemeParamsPage } from "@/tma/pages/ThemeParamsPage.tsx";
import { TONConnectPage } from "@/tma/pages/TONConnectPage/TONConnectPage";

// Lazily loaded — heavy pages not needed on startup
const MarketsPage = lazy(() =>
  import("@/tma/pages/MarketsPage").then((m) => ({ default: m.MarketsPage }))
);
const TONBetPage = lazy(() =>
  import("@/tma/pages/TONBetPage").then((m) => ({ default: m.TONBetPage }))
);
const DKBankBetPage = lazy(() =>
  import("@/tma/pages/DKBankBetPage").then((m) => ({ default: m.DKBankBetPage }))
);
const PwaMyBetsPage = lazy(() =>
  import("@/pwa/pages/PwaMyBetsPage").then((m) => ({ default: m.PwaMyBetsPage }))
);
const PwaResultsPage = lazy(() =>
  import("@/pwa/pages/PwaResultsPage").then((m) => ({ default: m.PwaResultsPage }))
);
const TmaProfilePage = lazy(() =>
  import("@/tma/pages/TmaProfilePage").then((m) => ({ default: m.TmaProfilePage }))
);
const ResolvedMarketsPage = lazy(() =>
  import("@/tma/pages/ResolvedMarketsPage").then((m) => ({ default: m.ResolvedMarketsPage }))
);
const TmaLeaderboardPage = lazy(() =>
  import("@/tma/pages/TmaLeaderboardPage").then((m) => ({ default: m.TmaLeaderboardPage }))
);
const TmaSettingsPage = lazy(() =>
  import("@/tma/pages/TmaSettingsPage").then((m) => ({ default: m.TmaSettingsPage }))
);
const TmaChallengesPage = lazy(() =>
  import("@/tma/pages/TmaChallengesPage").then((m) => ({ default: m.TmaChallengesPage }))
);
const TmaWalletPage = lazy(() =>
  import("@/tma/pages/TmaWalletPage").then((m) => ({ default: m.TmaWalletPage }))
);

interface Route {
  path: string;
  Component: ComponentType;
  title?: string;
  icon?: JSX.Element;
}

const WrappedMyBets = () => (
  <TmaPageWrapper>
    <PwaMyBetsPage />
  </TmaPageWrapper>
);

const WrappedResults = () => (
  <TmaPageWrapper>
    <PwaResultsPage />
  </TmaPageWrapper>
);

export const routes: Route[] = [
  { path: "/", Component: TmaFeedPage },
  { path: "/markets", Component: MarketsPage },
  { path: "/market/:id", Component: MarketDetailPage },
  { path: "/ton-bet/:id", Component: TONBetPage, title: "Trade with TON" },
  { path: "/dkbank-bet/:id", Component: DKBankBetPage, title: "Trade with DK Bank" },
  { path: "/dev", Component: IndexPage, title: "Dev Tools" },
  { path: "/init-data", Component: InitDataPage, title: "Init Data" },
  { path: "/theme-params", Component: ThemeParamsPage, title: "Theme Params" },
  { path: "/launch-params", Component: LaunchParamsPage, title: "Launch Params" },
  {
    path: "/ton-connect",
    Component: TONConnectPage,
    title: "TON Connect",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 56 56" fill="none">
        <path d="M28 56C43.464 56 56 43.464 56 28C56 12.536 43.464 0 28 0C12.536 0 0 12.536 0 28C0 43.464 12.536 56 28 56Z" fill="#0098EA" />
        <path d="M37.5603 15.6277H18.4386C14.9228 15.6277 12.6944 19.4202 14.4632 22.4861L26.2644 42.9409C27.0345 44.2765 28.9644 44.2765 29.7345 42.9409L41.5381 22.4861C43.3045 19.4251 41.0761 15.6277 37.5627 15.6277H37.5603ZM26.2548 36.8068L23.6847 31.8327L17.4833 20.7414C17.0742 20.0315 17.5795 19.1218 18.4362 19.1218H26.2524V36.8092L26.2548 36.8068ZM38.5108 20.739L32.3118 31.8351L29.7417 36.8068V19.1194H37.5579C38.4146 19.1194 38.9199 20.0291 38.5108 20.739Z" fill="white" />
      </svg>
    ),
  },
  { path: "/my-bets", Component: WrappedMyBets, title: "My Positions" },
  { path: "/results", Component: WrappedResults, title: "Results" },
  { path: "/profile", Component: TmaProfilePage, title: "Profile" },
  { path: "/resolved", Component: ResolvedMarketsPage, title: "Resolution Record" },
  { path: "/leaderboard", Component: TmaLeaderboardPage, title: "Leaderboard" },
  { path: "/settings", Component: TmaSettingsPage, title: "Settings" },
  { path: "/challenges", Component: TmaChallengesPage, title: "Duels" },
  { path: "/wallet", Component: TmaWalletPage, title: "Wallet" },
];
