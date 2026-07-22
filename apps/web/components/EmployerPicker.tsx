'use client';
// Search-as-you-type employer picker, backed by /api/companies. Replaces the
// 1,735-option native <select> on the hero and compare pages. Commits a slug to
// the parent only when the user picks a match (or clears) — a half-typed name
// never silently keeps a stale employer.
import { useCallback, useEffect, useId, useRef, useState } from 'react';

type Match = { slug: string; display_name: string };

export function EmployerPicker({
  value,
  onChange,
  inputCls,
  placeholder = 'Search employers…',
  clearLabel = 'Clear',
}: {
  value: string; // selected slug ('' = none)
  onChange: (slug: string) => void;
  inputCls: string;
  placeholder?: string;
  clearLabel?: string;
}) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [active, setActive] = useState(-1);
  const seq = useRef(0);
  const wrap = useRef<HTMLDivElement>(null);
  const typing = useRef(false); // guards the slug→name resolve from clobbering typed text
  const listId = useId();

  // Resolve an externally-set slug (deep link ?employer=, or reset) to its name.
  useEffect(() => {
    if (typing.current) return;
    if (!value) {
      setText('');
      return;
    }
    let live = true;
    fetch(`/api/companies/${value}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (live && p?.display_name) setText(p.display_name);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [value]);

  // Debounced suggestion fetch while typing.
  useEffect(() => {
    if (!open || !typing.current) return;
    const query = text.trim();
    if (!query) {
      setMatches([]);
      return;
    }
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/companies?q=${encodeURIComponent(query)}&page=0`).then((x) =>
          x.json()
        );
        if (mine !== seq.current) return;
        setMatches((r.companies ?? []).slice(0, 8));
        setActive(-1);
      } catch {
        if (mine === seq.current) setMatches([]);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [text, open]);

  // Close on outside click.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = useCallback(
    (m: Match) => {
      typing.current = false;
      setText(m.display_name);
      onChange(m.slug);
      setMatches([]);
      setOpen(false);
      setActive(-1);
    },
    [onChange]
  );

  const clear = () => {
    typing.current = false;
    setText('');
    onChange('');
    setMatches([]);
    setOpen(false);
  };

  const onType = (v: string) => {
    typing.current = true;
    setText(v);
    setOpen(true);
    if (value) onChange(''); // typing invalidates any committed pick
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && active >= 0 && matches[active]) {
      e.preventDefault();
      pick(matches[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={wrap} className="relative">
      <input
        type="text"
        role="combobox"
        aria-expanded={open && matches.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        className={inputCls}
        placeholder={placeholder}
        value={text}
        onChange={(e) => onType(e.target.value)}
        onFocus={() => text && setOpen(true)}
        onKeyDown={onKey}
      />
      {value && (
        <button
          type="button"
          onClick={clear}
          aria-label={clearLabel}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint transition-colors hover:text-text"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>
      )}
      {open && matches.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-line-2 bg-panel py-1 shadow-xl shadow-black/40"
        >
          {matches.map((m, i) => (
            <li key={m.slug} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(m)}
                onMouseEnter={() => setActive(i)}
                className={`block w-full truncate px-3 py-2 text-left text-sm transition-colors ${
                  i === active ? 'bg-inset text-text' : 'text-muted hover:text-text'
                }`}
              >
                {m.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
