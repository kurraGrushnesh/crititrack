/**
 * Illustrative profile data for the static site.
 *
 * Every figure here is a fabricated composite, not a real person. The
 * site is a static export with no backend, so it cannot show a live
 * profile; these exist only to demonstrate the format -- typed
 * controversies, a deterministic index, sourced evidence, a sentiment
 * trend. Each profile page states plainly that it is fabricated.
 *
 * Names are invented and deliberately not close to any well-known public
 * figure. Sources are illustrative publication names, not links to real
 * articles about a real person.
 */

import type { Controversy } from "./controversy";

export interface EvidenceFragment {
  fragment: string;
  source: string;
}

export interface TrendPoint {
  date: string;
  score: number;
}

export interface DemoProfile {
  slug: string;
  name: string;
  profession: string;
  summary: string;
  sentimentScore: number;
  trendDirection: "up" | "down" | "stable";
  trend: TrendPoint[];
  evidence: EvidenceFragment[];
  controversies: Controversy[];
}

export const DEMO_PROFILES: DemoProfile[] = [
  {
    slug: "marisol-quivera",
    name: "Marisol Quivera",
    profession: "Pop musician",
    summary:
      "A fabricated composite of a touring musician whose album cycle drew both strong reviews and a run of off-stage disputes.",
    sentimentScore: 58,
    trendDirection: "down",
    trend: [
      { date: "2026-06-01", score: 71 },
      { date: "2026-07-01", score: 66 },
      { date: "2026-08-01", score: 61 },
      { date: "2026-09-01", score: 58 },
    ],
    evidence: [
      { fragment: "praised the record's production as her most focused yet", source: "news" },
      { fragment: "fans criticised the last-minute cancellation of two arena dates", source: "youtube" },
      { fragment: "the label declined to comment on the reported contract dispute", source: "news" },
    ],
    controversies: [
      {
        title: "Cancelled arena dates without refunds for a week",
        summary:
          "Two stadium shows were called off hours before doors. Refunds were delayed about a week, and the promoter and management gave conflicting reasons.",
        category: "Professional",
        severity: 3,
        status: "resolved",
        year: 2026,
        sources: ["Rolling Stone", "Billboard"],
      },
      {
        title: "Public feud with a former collaborator over songwriting credit",
        summary:
          "A producer said in an interview that their contribution to two singles went uncredited. Representatives disputed the characterisation.",
        category: "Professional",
        severity: 2,
        status: "ongoing",
        year: 2025,
        sources: ["Pitchfork"],
      },
      {
        title: "Reported non-payment claim from a lighting contractor",
        summary:
          "A staging vendor filed a claim over an unpaid invoice from a 2024 tour leg. The matter was later reported as settled.",
        category: "Financial",
        severity: 4,
        status: "resolved",
        year: 2024,
        sources: ["Variety", "The Hollywood Reporter"],
      },
    ],
  },
  {
    slug: "davion-arkwright",
    name: "Davion Arkwright",
    profession: "Technology founder",
    summary:
      "A fabricated composite of a startup founder whose public statements and workplace record have both drawn sustained coverage.",
    sentimentScore: 39,
    trendDirection: "down",
    trend: [
      { date: "2026-06-01", score: 52 },
      { date: "2026-07-01", score: 47 },
      { date: "2026-08-01", score: 43 },
      { date: "2026-09-01", score: 39 },
    ],
    evidence: [
      { fragment: "former staff described a culture of abrupt public criticism", source: "news" },
      { fragment: "the company disputed the account and pointed to its review scores", source: "news" },
      { fragment: "commentators noted the product roadmap had slipped twice", source: "youtube" },
    ],
    controversies: [
      {
        title: "Regulator opened an inquiry into marketing claims",
        summary:
          "A consumer regulator said it was examining whether performance figures in an ad campaign could be substantiated. No finding has been published.",
        category: "Legal",
        severity: 4,
        status: "ongoing",
        year: 2026,
        sources: ["Reuters", "Financial Times"],
      },
      {
        title: "Reported mass layoff handled by an early-morning email",
        summary:
          "About a fifth of staff were let go with immediate loss of system access. The company said severance exceeded the statutory minimum.",
        category: "Professional",
        severity: 3,
        status: "historical",
        year: 2025,
        sources: ["Bloomberg", "The Verge"],
      },
      {
        title: "Deleted social posts after a backlash over a rival's outage",
        summary:
          "Posts appearing to mock a competitor during a service outage were removed within hours. A follow-up post called them a lapse in judgement.",
        category: "Social media",
        severity: 2,
        status: "resolved",
        year: 2026,
        sources: ["TechCrunch"],
      },
    ],
  },
  {
    slug: "priya-anand-cole",
    name: "Priya Anand-Cole",
    profession: "Film director",
    summary:
      "A fabricated composite of a filmmaker whose work is well reviewed and whose public profile is mostly free of dispute.",
    sentimentScore: 74,
    trendDirection: "stable",
    trend: [
      { date: "2026-06-01", score: 72 },
      { date: "2026-07-01", score: 75 },
      { date: "2026-08-01", score: 73 },
      { date: "2026-09-01", score: 74 },
    ],
    evidence: [
      { fragment: "critics called the festival premiere assured and unshowy", source: "news" },
      { fragment: "crew members praised the on-set hours as unusually humane", source: "news" },
    ],
    controversies: [
      {
        title: "Criticised for a historical detail in a period drama",
        summary:
          "Historians pointed out an anachronism in a widely-seen scene. The director acknowledged it in a later interview.",
        category: "Professional",
        severity: 1,
        status: "resolved",
        year: 2024,
        sources: ["The Guardian"],
      },
    ],
  },
];

export function demoProfileBySlug(slug: string): DemoProfile | undefined {
  return DEMO_PROFILES.find((p) => p.slug === slug);
}
