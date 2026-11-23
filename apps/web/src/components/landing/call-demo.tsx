"use client";

import { useEffect, useRef, useState } from "react";
import { callAudioCues } from "./call-audio";
import { callScripts, type CallScript } from "./call-scripts";
import { StatusDot } from "../ui/section";
import { useAudioLevel, VoiceOrb } from "../ui/voice-orb";

const scriptFont: Record<CallScript["script"], string> = {
  deva: "font-deva",
  tamil: "font-tamil",
  latin: "font-sans",
};

export function CallDemo() {
  const [activeId, setActiveId] = useState<CallScript["id"]>("hi");
  const [visible, setVisible] = useState(callScripts[0].lines.length);
  const [playing, setPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const section = useRef<HTMLElement | null>(null);
  const list = useRef<HTMLOListElement | null>(null);
  const caption = useRef<HTMLDivElement | null>(null);

  const call = callScripts.find((c) => c.id === activeId) ?? callScripts[0];
  const cues = callAudioCues[call.id] ?? [];

  const stop = () => {
    audio.current?.pause();
    setPlaying(false);
  };

  useEffect(() => stop, []);

  // Pause (keeping the position) once the section is mostly scrolled away or
  // the tab is hidden; Play then resumes where it left off.
  useEffect(() => {
    if (!playing || !section.current) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) audio.current?.pause();
      },
      // Only the middle 40% of the viewport counts, whatever the section's height.
      { rootMargin: "-30% 0px -30% 0px" },
    );
    io.observe(section.current);
    const onHide = () => document.hidden && audio.current?.pause();
    document.addEventListener("visibilitychange", onHide);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [playing]);

  const selectTab = (id: CallScript["id"]) => {
    stop();
    setActiveId(id);
    const next = callScripts.find((c) => c.id === id);
    setVisible(next ? next.lines.length : 0);
  };

  const toggle = async () => {
    const el = audio.current;
    if (!el) return;
    if (playing) {
      stop();
      return;
    }
    // Start from the top unless resuming a paused call mid-way.
    if (el.ended || el.currentTime === 0) {
      el.currentTime = 0;
      setVisible(0);
    }
    try {
      await el.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  };

  useAudioLevel(audio, playing, caption);
  const speaking = playing && visible > 0 ? call.lines[visible - 1] : null;

  // Keep the line being spoken in view, scrolling only the transcript box.
  useEffect(() => {
    const box = list.current;
    if (!playing || !box || visible === 0) return;
    const line = box.children[visible - 1] as HTMLElement | undefined;
    if (line) box.scrollTo({ top: line.offsetTop - box.clientHeight / 2 + line.offsetHeight / 2, behavior: "smooth" });
  }, [visible, playing]);

  // Reveal each line when its audio starts.
  const onTime = () => {
    const t = audio.current?.currentTime ?? 0;
    setVisible(cues.filter((c) => c <= t + 0.05).length);
  };

  const onEnded = () => {
    setPlaying(false);
    setVisible(call.lines.length);
  };

  return (
    <section
      ref={section}
      id="call"
      className="relative scroll-mt-0 overflow-hidden bg-charcoal bg-cover bg-center py-16 text-white lg:py-20"
      style={{ backgroundImage: "url(/art/night-glow.svg)" }}
    >
      <div className="mx-auto max-w-[1200px] px-4 sm:px-8">
      <div className="mx-auto mb-10 flex max-w-3xl flex-col items-center gap-4 text-center">
        <h2 className="display text-[40px] sm:text-[56px] lg:text-[64px]">Hear tonight&apos;s call</h2>
        <p className="text-lg leading-[1.3] text-white/60 sm:text-xl">
          Pick a language and press play. Kin asks, listens, remembers yesterday, and notes what changed.
        </p>
      </div>
    <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-4 backdrop-blur sm:p-6 lg:p-8">
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
                    ? "border-white bg-white text-ink"
                    : "border-white/15 bg-transparent text-white/70 hover:border-white/40"
                } ${scriptFont[c.script]}`}
              >
                <span
                  aria-hidden
                  className={`size-1.5 rounded-full ${selected ? "bg-coral" : "bg-white/30"}`}
                />
                {c.tab}
              </button>
            );
          })}
        </div>
        <p className="text-[15px] text-white/50">Example call, 2 to 4 minutes a day</p>
      </div>

      <div className="mt-6 grid gap-4 lg:h-[480px] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-6">
        <div className="flex flex-col items-center justify-center gap-4 rounded-[24px] bg-white/[0.06] px-6 py-8">
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? "Pause the call" : `Play the ${call.parent} call`}
            className="group relative my-2 grid size-48 place-items-center rounded-full outline-offset-4"
          >
            <VoiceOrb size={192} active={playing} audio={audio}>
            <span className="relative grid size-14 place-items-center rounded-full bg-white/90 text-ink shadow-[0_8px_24px_-8px_rgba(0,0,0,0.5)] backdrop-blur transition-transform group-hover:scale-105 group-active:scale-95">
              {playing ? (
                <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden>
                  <rect x="6" y="4.5" width="4" height="15" rx="1.6" fill="currentColor" />
                  <rect x="14" y="4.5" width="4" height="15" rx="1.6" fill="currentColor" />
                </svg>
              ) : (
                <svg width="30" height="30" viewBox="1 0 24 24" aria-hidden>
                  <path d="M7 5.2v13.6a1.2 1.2 0 0 0 1.8 1l11-6.8a1.2 1.2 0 0 0 0-2l-11-6.8A1.2 1.2 0 0 0 7 5.2Z" fill="currentColor" />
                </svg>
              )}
            </span>
            </VoiceOrb>
          </button>
          {/* Pre-generated once with Sarvam TTS (apps/api/scripts/generate_call_audio.py); static file, no API cost per play. */}
          <audio
            key={call.id}
            ref={audio}
            src={`/audio/call-${call.id}.mp3`}
            preload="none"
            onTimeUpdate={onTime}
            onEnded={onEnded}
            onPause={() => setPlaying(false)}
          />
          <div ref={caption} className="flex min-h-[60px] flex-col items-center justify-center text-center">
            {speaking ? (
              <p className="inline-flex h-10 items-center gap-3 rounded-full bg-white/10 pr-4 pl-3.5 text-[15px] font-medium ring-1 ring-white/10" aria-live="polite">
                {/* live voice bars: height follows the call audio */}
                <span aria-hidden className="flex h-4 items-center gap-[3px]">
                  {[0.45, 0.8, 1, 0.7, 0.4].map((f, i) => (
                    <span
                      key={i}
                      className="w-[3px] rounded-full bg-white transition-[height] duration-100"
                      style={{ height: `calc(3px + var(--kin-level) * ${f * 13}px)` }}
                    />
                  ))}
                </span>
                {speaking.speaker === "kin" ? "Kin is speaking" : `${call.parent.split(",")[0]} is speaking`}
              </p>
            ) : (
              <>
                <p className="font-medium">Kin calling {call.parent}</p>
                <p className="mt-1 text-[14px] text-white/50">{call.meta}</p>
              </>
            )}
          </div>
        </div>

        <div className="flex h-[460px] min-w-0 flex-col overflow-hidden rounded-[24px] bg-white/[0.04] ring-1 ring-white/10 lg:h-auto">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
            <p className="text-[13px] font-semibold tracking-wide text-white/60 uppercase">Transcript</p>
            <p className="flex items-center gap-2 text-[13px] text-white/50">
              {playing ? (
                <>
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-coral opacity-70 motion-reduce:animate-none" />
                    <span className="relative inline-flex size-2 rounded-full bg-coral" />
                  </span>
                  Live
                </>
              ) : (
                `${call.lines.length} lines · English below`
              )}
            </p>
          </div>
          <ol
            ref={list}
            aria-live="polite"
            className="no-scrollbar relative flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-5 py-5 [mask-image:linear-gradient(to_bottom,transparent,black_24px,black_calc(100%-24px),transparent)]"
          >
            {call.lines.map((line, i) => {
              const shown = i < visible;
              const kin = line.speaker === "kin";
              return (
                <li
                  key={`${call.id}-${i}`}
                  className={`flex max-w-[92%] flex-col gap-1 rounded-[20px] px-4 py-3 transition-all duration-500 ${
                    kin
                      ? "self-start rounded-bl-md bg-charcoal/95 shadow-float ring-1 ring-white/10"
                      : "self-end rounded-br-md bg-white text-ink"
                  } ${shown ? "translate-y-0 opacity-100" : "translate-y-1 opacity-20"}`}
                >
                  <span className={`text-[11px] font-semibold tracking-wide uppercase ${kin ? "text-white/50" : "text-body"}`}>
                    {kin ? "Kin" : call.parent.split(",")[0]}
                  </span>
                  <span className={`text-[15px] leading-relaxed ${scriptFont[call.script]}`}>
                    {line.said}
                  </span>
                  {line.english ? (
                    <span className={`text-[13px] leading-snug ${kin ? "text-white/60" : "text-body"}`}>{line.english}</span>
                  ) : null}
                </li>
              );
            })}
          </ol>
          <div className="flex items-start gap-3 border-t border-white/10 bg-white/[0.03] px-5 py-4 text-[15px] text-white/75">
            <span className="mt-1.5">
              <StatusDot tone={call.note.tone} />
            </span>
            <p>{call.note.text}</p>
          </div>
        </div>
      </div>
    </div>
      </div>
    </section>
  );
}
