import type { Metadata } from "next";
import PillNav from "@/components/PillNav";
import SiteFooter from "@/components/SiteFooter";
import WatchlistView from "@/components/WatchlistView";

export const metadata: Metadata = {
  title: "Watchlist",
  description:
    "A device-local watchlist of CritiTrack profiles. Stored only in this browser; never sent anywhere.",
};

export default function WatchlistPage() {
  return (
    <>
      <PillNav />
      <main id="main" className="page">
        <div className="page-head">
          <h1>Watchlist</h1>
          <p>
            The profiles you have chosen to watch. This list lives only in
            this browser&rsquo;s storage and is never sent anywhere, the
            same way the app keeps your watchlist on your device.
          </p>
        </div>
        <WatchlistView />
      </main>
      <SiteFooter />
    </>
  );
}
