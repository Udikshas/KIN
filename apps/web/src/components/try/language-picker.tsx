"use client";

import { useEffect, useId, useRef, useState } from "react";

export type LanguageOption = { value: string; native: string; english?: string };

/**
 * Custom listbox for the call language. Submits through a hidden input named
 * `name`, so it works with the server action like a native select.
 */
export function LanguagePicker({ name, options, defaultValue }: {
  name: string; options: LanguageOption[]; defaultValue: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();

  const selected = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  // Keep the highlighted option in view while using the keyboard.
  useEffect(() => {
    if (open) (list.current?.children[active] as HTMLElement | undefined)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const show = () => {
    setActive(Math.max(0, options.indexOf(selected)));
    setOpen(true);
  };

  const pick = (i: number) => {
    setValue(options[i].value);
    setOpen(false);
    button.current?.focus();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        show();
      }
      return;
    }
    if (e.key === "ArrowDown") setActive((a) => Math.min(options.length - 1, a + 1));
    else if (e.key === "ArrowUp") setActive((a) => Math.max(0, a - 1));
    else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(options.length - 1);
    else if (e.key === "Enter" || e.key === " ") pick(active);
    else if (e.key === "Escape" || e.key === "Tab") {
      setOpen(false);
      return;
    } else return;
    e.preventDefault();
  };

  return (
    <div ref={root} className="relative">
      <input type="hidden" name={name} value={value} />
      <button
        ref={button}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKey}
        className={`flex h-12 w-full items-center justify-between gap-2 rounded-[14px] border bg-white/90 px-4 text-left text-[16px] text-ink outline-none transition-colors focus-visible:border-ink ${
          open ? "border-ink" : "border-line"
        }`}
      >
        <span className="truncate">{selected.native}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`shrink-0 text-body transition-transform ${open ? "rotate-180" : ""}`} aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <ul
          ref={list}
          id={`${id}-list`}
          role="listbox"
          aria-label="Language"
          className="no-scrollbar absolute top-[calc(100%+6px)] right-0 z-30 max-h-[300px] w-[min(260px,calc(100vw-48px))] animate-fade-up overflow-y-auto rounded-[18px] border border-line bg-paper p-1.5 shadow-chip"
        >
          {options.map((o, i) => {
            const isSelected = o.value === value;
            return (
              <li
                key={o.value}
                id={`${id}-${i}`}
                role="option"
                aria-selected={isSelected}
                onPointerEnter={() => setActive(i)}
                onClick={() => pick(i)}
                className={`flex cursor-pointer items-center gap-3 rounded-[12px] px-3 py-2.5 text-[15px] ${
                  i === active ? "bg-cloud" : ""
                } ${isSelected ? "font-semibold text-ink" : "text-ink"}`}
              >
                <span className="min-w-0 flex-1 truncate">{o.native}</span>
                {o.english ? <span className="text-[13px] font-normal text-body">{o.english}</span> : null}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
                  className={`shrink-0 ${isSelected ? "text-ink" : "invisible"}`} aria-hidden>
                  <path d="m5 12.5 4.5 4.5L19 7.5" />
                </svg>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
