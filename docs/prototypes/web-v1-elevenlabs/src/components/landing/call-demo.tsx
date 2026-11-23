"use client";

import { useEffect, useRef, useState } from "react";
import { callScripts, type CallScript } from "./call-scripts";
import { StatusDot } from "../ui/section";

const scriptFont: Record<CallScript["script"], string> = {
  deva: "font-deva",
  tamil: "font-tamil",
  latin: "font-sans",
};

const STEP_MS = 1400;

export function CallDemo() {
  const [activeId, setActiveId] = useState<CallScript["id"]>("hi");
  const [visible, setVisible] = useState(callScripts[0].lines.length);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const call = callScripts.find((c) => c.id === activeId) ?? callScripts[0];

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setPlaying(false);
  };

  useEffect(() => stop, []);

  const selectTab = (id: CallScript["id"]) => {
    stop();
    setActiveId(id);
    const next = callScripts.find((c) => c.id === id);
    setVisible(next ? next.lines.length : 0);
  };

  const play = () => {
    stop();
    setVisible(0);
    setPlaying(true);
    let shown = 0;
    timer.current = setInterval(() => {
      shown += 1;
      setVisible(shown);
      if (shown >= call.lines.length) stop();
    }, STEP_MS);
  };

  return (
    <div className="rounded-panel bg-taupe p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Call language" className="flex flex-wrap gap-2">
          {callScripts.map((c) => {
            const selected = c.id === activeId;
            return (
              <button
                key={c.id}
                role="tab"
                aria-selected={selected}
                onClick={() => selectTab(c.id)}
                className={`inline-flex h-9 items-center gap-2 rounded-full border px-4 text-sm transition-colors ${
                  selected
                    ? "border-ink bg-eggshell text-ink"
                    : "border-hairline bg-eggshell/60 text-graphite hover:border-ash"
                } ${scriptFont[c.script]}`}
              >
                <span
                  aria-hidden
                  className={`size-1.5 rounded-full ${selected ? "bg-ember" : "bg-ash"}`}
                />
                {c.tab}
              </button>
            );
          })}
        </div>
        <p className="font-mono text-[13px] text-smoke">Example call · 2–4 minutes a day</p>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
        <div className="flex flex-col items-center justify-center gap-6 rounded-card bg-eggshell px-6 py-10 shadow-lift">
          <button
            type="button"
            onClick={play}
            aria-label={playing ? "Call playing" : `Play the ${call.parent} call`}
            className="group relative grid size-48 place-items-center rounded-full outline-offset-4 sm:size-52"
          >
            <span
              aria-hidden
              className={`absolute inset-0 rounded-full ${playing ? "animate-breathe" : ""}`}
              style={{
                background:
                  "radial-gradient(circle at 30% 30%, #ffd2e8 0%, transparent 45%), radial-gradient(circle at 70% 35%, #ff4704 0%, transparent 55%), radial-gradient(circle at 40% 75%, #0447ff 0%, transparent 60%), radial-gradient(circle at 50% 50%, #ff9ac9 0%, #f5f3f1 75%)",
                filter: "saturate(0.9)",
              }}
            />
            <span
              aria-hidden
              className={`absolute inset-3 rounded-full opacity-60 mix-blend-soft-light ${playing ? "animate-drift" : ""}`}
              style={{
                background:
                  "conic-gradient(from 0deg, transparent, rgb(255 255 255 / 0.7), transparent 40%, rgb(255 255 255 / 0.4), transparent 75%)",
              }}
            />
            <span className="relative grid size-14 place-items-center rounded-full bg-eggshell/90 text-ink shadow-lift transition-transform group-hover:scale-105">
              {playing ? (
                <span className="flex h-4 items-end gap-[3px]" aria-hidden>
                  <i className="block h-2 w-[3px] animate-pulse rounded bg-ink" />
                  <i className="block h-4 w-[3px] animate-pulse rounded bg-ink [animation-delay:150ms]" />
                  <i className="block h-3 w-[3px] animate-pulse rounded bg-ink [animation-delay:300ms]" />
                </span>
              ) : (
                <svg width="16" height="18" viewBox="0 0 16 18" aria-hidden>
                  <path d="M2 1.5v15l13-7.5z" fill="currentColor" />
                </svg>
              )}
            </span>
          </button>
          <div className="text-center">
            <p className="font-medium">Kin calling {call.parent}</p>
            <p className="mt-1 font-mono text-[13px] text-smoke">{call.meta}</p>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <ol className="flex flex-col gap-3" aria-live="polite">
            {call.lines.map((line, i) => {
              const shown = i < visible;
              const kin = line.speaker === "kin";
              return (
                <li
                  key={`${call.id}-${i}`}
                  className={`flex max-w-[92%] flex-col gap-1 rounded-2xl px-4 py-3 transition-all duration-500 ${
                    kin
                      ? "self-start rounded-bl-md bg-eggshell"
                      : "self-end rounded-br-md bg-stone"
                  } ${shown ? "translate-y-0 opacity-100" : "translate-y-1 opacity-20"}`}
                >
                  <span className="font-mono text-[11px] tracking-wide text-ash uppercase">
                    {kin ? "Kin" : call.parent.split(",")[0]}
                  </span>
                  <span className={`text-[15px] leading-relaxed ${scriptFont[call.script]}`}>
                    {line.said}
                  </span>
                  {line.english ? (
                    <span className="text-[13px] leading-snug text-smoke">{line.english}</span>
                  ) : null}
                </li>
              );
            })}
          </ol>
          <div className="mt-2 flex items-start gap-3 border-t border-stone pt-4 text-sm text-graphite">
            <span className="mt-1.5">
              <StatusDot tone={call.note.tone} />
            </span>
            <p>{call.note.text}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
