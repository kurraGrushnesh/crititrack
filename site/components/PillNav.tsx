"use client";

import { useState } from "react";
import Link from "next/link";

const APP = "/app/";

/**
 * The floating pill navigation. The search lives here — type a name and
 * it hands off to the real app — so the home page below can lead with the
 * headline and the categories instead of a search box.
 */
export default function PillNav() {
  const [q, setQ] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    window.location.href = term ? `${APP}?q=${encodeURIComponent(term)}` : APP;
  }

  return (
    <div className="pillnav-wrap">
      <nav className="pillnav" aria-label="Primary">
        <Link href="/" className="pillnav-brand">
          CritiTrack
        </Link>

        <form className="pillnav-search" onSubmit={submit} role="search">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle
              cx="11"
              cy="11"
              r="7"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="m20 20-3.5-3.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search a public figure…"
            aria-label="Search a public figure"
          />
        </form>

        <div className="pillnav-links">
          <Link href="/category/actors">Categories</Link>
          <Link href="/methodology">Method</Link>
          <Link href="/about">About</Link>
        </div>

        <a href={APP} className="pillnav-cta">
          Open app
        </a>
      </nav>
    </div>
  );
}
