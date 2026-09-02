import type { Metadata } from "next";
import { Suspense } from "react";
import PillNav from "@/components/PillNav";
import SiteFooter from "@/components/SiteFooter";
import CorrectionFormSection from "./CorrectionFormSection";

export const metadata: Metadata = {
  title: "Report a correction",
  description:
    "Dispute something on a CritiTrack profile. Reports are validated against the same rules the backend enforces.",
};

export default function ReportCorrectionPage() {
  return (
    <>
      <PillNav />
      <main id="main" className="page page-narrow">
        <div className="page-head">
          <h1>Report a correction</h1>
          <p>
            If something on a profile is wrong, describe it here. A record is
            not changed without a source that supports the change.
          </p>
        </div>

        <div className="disclaimer">
          <strong>This is the static demo site.</strong> The profiles here
          are fabricated, and no correction endpoint is configured, so the
          form validates your input and then tells you it was not submitted.
          The same form in the app posts to the real endpoint.
        </div>

        <noscript>
          <p className="no-records">
            This form needs JavaScript to validate and send your report. With
            it turned off, please open an issue on the repository instead:{" "}
            <a
              href="https://github.com/kurraGrushnesh/crititrack/issues/new"
              rel="noopener noreferrer"
            >
              github.com/kurraGrushnesh/crititrack/issues
            </a>
            .
          </p>
        </noscript>

        <Suspense fallback={<p className="no-records">Loading the form.</p>}>
          <CorrectionFormSection />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
