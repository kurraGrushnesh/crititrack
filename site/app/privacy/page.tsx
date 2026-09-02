import type { Metadata } from "next";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What CritiTrack collects, why, and what you can do about it.",
};

export default function PrivacyPage() {
  return (
    <>
      <SiteNav />
      <main id="main" className="page page-narrow">
        <div className="page-head">
          <h1>Privacy</h1>
          <p className="form-note" style={{ marginBottom: 12 }}>
            Last updated 2 September 2026
          </p>
          <p>
            What CritiTrack collects, why, and what you can do about it.
            Written against the actual code. If something here does not
            match the app&rsquo;s behaviour, that is a bug and we want to
            hear about it.
          </p>
        </div>

        <div className="prose">
          <h2>The short version</h2>
          <ul>
            <li>No name, email address or phone number is requested.</li>
            <li>No advertising. No sale or sharing of data with brokers.</li>
            <li>No behavioural analytics or tracking SDK.</li>
            <li>
              Your watchlist and search history stay on your device unless
              you sign in, and even then are readable only by you.
            </li>
            <li>Everything held about you can be deleted from inside the app.</li>
          </ul>

          <h2>This website</h2>
          <p>
            The marketing and reference site is a static export. It sets no
            cookies, runs no analytics, and makes no third-party requests.
            The watchlist on this site is stored in your browser&rsquo;s
            local storage and never leaves your device.
          </p>

          <h2>The app: an anonymous identifier</h2>
          <p>
            On first launch the app signs in anonymously with Firebase
            Authentication, producing a random identifier not linked to any
            real-world identity. It is used for three things: enforcing
            per-user request limits, storing your watchlist so it can follow
            you to another device if you choose to sign in, and scoping your
            data in the security rules so only you can read it.
          </p>

          <h2>The app: what is stored server-side</h2>
          <p>
            Cached public-figure profiles, which are not personal to you.
            Rate-limit counters keyed to your anonymous identifier. If you
            opt into alerts, a per-install record with your quiet-hours
            preference, keyed by a random install id rather than by account.
          </p>

          <h2>Deletion</h2>
          <p>
            The app has a control that deletes your search history, your
            watchlist, and your usage counters, and removes any alert
            registrations for the device. Uninstalling also ends anonymous
            authentication for that install.
          </p>

          <h2>Contact</h2>
          <p>
            Use the correction form for anything about a specific profile.
            For privacy questions, open an issue on the repository.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
