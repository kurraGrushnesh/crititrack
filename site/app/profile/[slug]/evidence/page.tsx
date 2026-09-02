import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import EvidenceList from "@/components/EvidenceList";
import ControversyRecord from "@/components/ControversyRecord";
import { DEMO_PROFILES, demoProfileBySlug } from "@/lib/demo-data";
import { corroborated } from "@/lib/controversy";

export const dynamicParams = false;

export function generateStaticParams() {
  return DEMO_PROFILES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = demoProfileBySlug(slug);
  return {
    title: p ? `Evidence for ${p.name}` : "Evidence",
    description:
      "The retrieved fragments and sourced records a CritiTrack profile is built from.",
  };
}

export default async function EvidencePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = demoProfileBySlug(slug);
  if (!p) notFound();

  const kept = corroborated(p.controversies);

  return (
    <>
      <SiteNav />
      <main id="main" className="page page-narrow">
        <div className="breadcrumb">
          <Link href="/explore">Explore</Link>
          <span>/</span>
          <Link href={`/profile/${p.slug}`}>{p.name}</Link>
          <span>/</span>
          <span>Evidence</span>
        </div>

        <div className="page-head">
          <h1>Evidence for {p.name}</h1>
          <p>
            A score is only as good as what it was computed from. This page
            lists the fragments behind the sentiment score and the sourced
            records behind the Controversy Index.
          </p>
        </div>

        <div className="disclaimer">
          <strong>Fabricated composite.</strong> The fragments and sources
          below are invented for illustration.
        </div>

        <h2 className="prose">Sentiment fragments</h2>
        <p className="form-note" style={{ margin: "6px 0 16px" }}>
          Short spans from retrieved coverage, tagged by source type. The
          ensemble scores each one; the spread between methods becomes the
          confidence band.
        </p>
        <EvidenceList items={p.evidence} />

        <h2 className="prose section-gap">Sourced controversy records</h2>
        <p className="form-note" style={{ margin: "6px 0 16px" }}>
          {p.controversies.length - kept.length > 0
            ? `${p.controversies.length - kept.length} record(s) held back by the corroboration gate are not shown.`
            : "Every record here cites at least one source."}
        </p>
        {kept.map((c, i) => (
          <ControversyRecord key={i} item={c} />
        ))}

        <p className="form-note section-gap">
          <Link href="/methodology">How the pipeline produces these</Link>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
