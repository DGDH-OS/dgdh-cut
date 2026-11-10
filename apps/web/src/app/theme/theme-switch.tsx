// AUTO-GENERATED door 1. OPS/tools/theme/sync.sh uit ThemeSwitch.tsx. NIET HANDMATIG WIJZIGEN.
"use client";
import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Pref = "system" | "light" | "dark";
type Api = {
  get(): Pref;
  set(pref: Pref): void;
  onChange(fn: (pref: Pref) => void): () => void;
};
const API = () => (window as unknown as { DgdhTheme?: Api }).DgdhTheme;
const OPTIONS: { value: Pref; label: string; Icon: typeof Sun }[] = [
  { value: "system", label: "Systeem", Icon: Monitor },
  { value: "light", label: "Licht", Icon: Sun },
  { value: "dark", label: "Donker", Icon: Moon },
];

/** Systeem / Licht / Donker. radiogroup, pijltoetsen, 44px doelen, Lucide-iconen. Stijl: .dgdh-theme-switch in dgdh-theme.css. */
export function ThemeSwitch({ className = "" }: { className?: string }) {
  const [pref, setPref] = useState<Pref>("system");
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    const api = API();
    if (!api) return;
    setPref(api.get());
    return api.onChange((p) => setPref(p));
  }, []);
  const choose = (value: Pref) => {
    setPref(value);
    API()?.set(value);
  };
  return (
    <div role="radiogroup" aria-label="Weergave" className={`dgdh-theme-switch ${className}`}>
      {OPTIONS.map(({ value, label, Icon }, i) => (
        <button
          key={value}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={pref === value}
          aria-label={label}
          title={label}
          tabIndex={pref === value ? 0 : -1}
          onClick={() => choose(value)}
          onKeyDown={(e) => {
            const step =
              e.key === "ArrowRight" || e.key === "ArrowDown"
                ? 1
                : e.key === "ArrowLeft" || e.key === "ArrowUp"
                  ? -1
                  : 0;
            if (!step) return;
            e.preventDefault();
            const n = (i + step + OPTIONS.length) % OPTIONS.length;
            refs.current[n]?.focus();
            choose(OPTIONS[n].value);
          }}
        >
          <Icon aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
