"use client";

import { useSearchParams } from "next/navigation";
import CorrectionForm from "@/components/CorrectionForm";

/**
 * Reads an optional `?slug=` so a "Report a correction" link from a
 * profile page pre-selects that profile. Kept in its own client
 * component so the page can wrap it in a Suspense boundary, which
 * `useSearchParams` requires.
 */
export default function CorrectionFormSection() {
  const slug = useSearchParams().get("slug") ?? "";
  return <CorrectionForm defaultSlug={slug} />;
}
