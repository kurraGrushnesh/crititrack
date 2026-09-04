"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { suggest, type Suggestion } from "@/lib/search";

/**
 * The discovery search box: typeahead suggestions grouped into a direct
 * name lookup, people, professions and categories. Enter with nothing
 * selected runs the full grouped search at `/search`. Everything is
 * computed from bundled data — no request.
 */

const GROUP_LABEL: Record<Suggestion["kind"], string> = {
  lookup: "",
  person: "People",
  occupation: "Profession",
  industry: "Industry",
  sector: "Sector",
  category: "Category",
};

export default function SearchBox({
  placeholder = "Search people, professions, industries…",
}: {
  placeholder?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [debounced, setDebounced] = useState("");
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const arrowUsed = useRef(false);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebounced(q);
      setActive(-1);
    }, 110);
    return () => window.clearTimeout(t);
  }, [q]);

  const items = useMemo<Suggestion[]>(
    () => (debounced.trim().length >= 2 ? suggest(debounced) : []),
    [debounced],
  );

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  function submit() {
    const term = q.trim();
    if (!term) return;
    // Only follow a highlighted item if the user chose it with the
    // arrow keys — a mouse hover must not hijack Enter.
    if (arrowUsed.current && active >= 0 && items[active]) {
      return go(items[active].href);
    }
    go(`/search/?q=${encodeURIComponent(term)}`);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      arrowUsed.current = true;
      setActive((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      arrowUsed.current = true;
      setActive((i) => Math.max(-1, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showList = open && items.length > 0;

  return (
    <div className="searchbox" ref={rootRef} role="search">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
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
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          arrowUsed.current = false;
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={placeholder}
        aria-expanded={showList}
        aria-controls={showList ? listId : undefined}
        aria-activedescendant={
          showList && active >= 0 ? `${listId}-${active}` : undefined
        }
        autoComplete="off"
        role="combobox"
      />

      {showList && (
        <ul className="searchbox-list" id={listId} role="listbox">
          {items.map((s, i) => {
            const prevKind = items[i - 1]?.kind;
            const header =
              s.kind !== "lookup" && s.kind !== prevKind
                ? GROUP_LABEL[s.kind]
                : null;
            return (
              <li key={`${s.kind}-${s.label}-${i}`}>
                {header && <span className="searchbox-group">{header}</span>}
                <button
                  type="button"
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className={`searchbox-item${i === active ? " is-active" : ""}${
                    s.kind === "lookup" ? " is-lookup" : ""
                  }`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(s.href)}
                >
                  <span className="searchbox-item-label">{s.label}</span>
                  {s.sublabel && (
                    <span className="searchbox-item-sub">{s.sublabel}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
