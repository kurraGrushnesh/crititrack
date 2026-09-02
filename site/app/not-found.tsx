import type { Metadata } from "next";
import Link from "next/link";
import PillNav from "@/components/PillNav";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Page not found",
  description: "That page does not exist.",
};

export default function NotFound() {
  return (
    <>
      <PillNav />
      <main id="main" className="page page-narrow" tabIndex={-1}>
        <div className="page-head">
          <h1>That page does not exist</h1>
          <p>
            The address may be mistyped, or the page may have moved. Here is
            the way back.
          </p>
        </div>
        <p className="link-row">
          <Link href="/">Home</Link>
          <Link href="/explore">Explore profiles</Link>
          <Link href="/methodology">Method</Link>
          <Link href="/about">About</Link>
          <Link href="/report-correction">Report a correction</Link>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
