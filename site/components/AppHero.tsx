"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const APP = "/app/";

/**
 * The app-home hero: a headline, a search that hands off to the real app,
 * and a slow parallax glow. Parallax is disabled under
 * `prefers-reduced-motion` and only runs while the hero is on screen.
 */
export default function AppHero({
  title,
  lede,
  children,
}: {
  title: string;
  lede: string;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    el.dataset.parallax = "on";
    let raf = 0;
    let visible = true;
    const io = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting;
      },
      { threshold: 0 },
    );
    io.observe(el);

    const onScroll = () => {
      if (raf || !visible) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = Math.min(60, window.scrollY * 0.12);
        el.style.setProperty("--parallax-y", `${y}px`);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    window.location.href = term
      ? `${APP}?q=${encodeURIComponent(term)}`
      : APP;
  }

  return (
    <header ref={ref} className="app-hero">
      <div className="wrap">
        <h1>{title}</h1>
        <p className="lede">{lede}</p>
        <form className="app-search" onSubmit={submit} role="search">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search a public figure…"
            aria-label="Search a public figure"
          />
          <button type="submit">Search</button>
        </form>
        {children}
      </div>
    </header>
  );
}
