"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";

/*
  Kin's voice orb: a glass sphere with coloured light drifting inside it.

  The light is one blended cloud, not separate shapes: two edgeless conic
  colour fields, offset from the centre and heavily blurred, turn slowly in
  opposite directions while a soft glow wanders across them. Every animation
  runs at a fixed speed for the life of the orb, so nothing ever snaps.

  Nothing pulses or scales. With `audio`, the light only brightens slightly
  with the voice: `--kin-level` (0 to 1) is read live from that <audio>
  element through a Web Audio analyser and smoothed.
  Keyframes and the registered --kin-level live in globals.css; all of them
  stop under prefers-reduced-motion.
*/

// Two colour fields in the landing palette. Conic gradients have no edges, so
// heavily blurred and turning against each other they read as one cloud.
const fieldA = "conic-gradient(from 0deg at 50% 50%, #2a2f7a, #415eee, #9d86ff, #ff8f70, #3b3f9a, #6a5cff, #2a2f7a)";
const fieldB = "conic-gradient(from 180deg at 50% 50%, #23264f, #9d86ff, #ff8f70, #ffb36b, #415eee, #23264f)";

// One analyser per <audio> element: createMediaElementSource may only be
// called once per element, so cache it.
const analysers = new WeakMap<HTMLAudioElement, AnalyserNode>();
let audioContext: AudioContext | null = null;

function analyserFor(el: HTMLAudioElement): AnalyserNode | null {
  const cached = analysers.get(el);
  if (cached) return cached;
  try {
    audioContext ??= new AudioContext();
    const source = audioContext.createMediaElementSource(el);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.6;
    source.connect(analyser);
    analyser.connect(audioContext.destination);
    analysers.set(el, analyser);
    return analyser;
  } catch {
    return null;
  }
}

/**
 * Writes the smoothed loudness (0 to 1) of `audio` to `--kin-level` on
 * `target` while `active`. No React re-renders: the value goes straight to CSS.
 */
export function useAudioLevel(
  audio: RefObject<HTMLAudioElement | null> | undefined,
  active: boolean,
  target: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    const el = audio?.current;
    const node = target.current;
    if (!active || !el || !node) return;
    const analyser = analyserFor(el);
    if (!analyser) return;
    void audioContext?.resume();
    const data = new Uint8Array(analyser.fftSize);
    let level = 0;
    let frame = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const v of data) sum += ((v - 128) / 128) ** 2;
      const loud = Math.min(1, Math.sqrt(sum / data.length) * 4.5);
      // Rise quickly on a word, fall back gently in the gaps.
      level += (loud - level) * (loud > level ? 0.35 : 0.08);
      node.style.setProperty("--kin-level", level.toFixed(3));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      node.style.setProperty("--kin-level", "0");
    };
  }, [active, audio, target]);
}

export function VoiceOrb({
  size = 208,
  active = false,
  audio,
  children,
  className = "",
}: {
  size?: number;
  active?: boolean;
  /** Make the orb follow this element's loudness while it plays. */
  audio?: RefObject<HTMLAudioElement | null>;
  children?: ReactNode;
  className?: string;
}) {
  const root = useRef<HTMLSpanElement>(null);

  useAudioLevel(audio, active, root);

  return (
    <span
      ref={root}
      className={`kin-orb relative grid shrink-0 place-items-center ${className}`}
      style={{ width: size, height: size }}
    >
      {/* outer glow */}
      <span
        aria-hidden
        className="absolute -inset-[24%] rounded-full blur-2xl"
        style={{
          background: "radial-gradient(circle, rgb(157 134 255 / 0.45) 0%, rgb(255 143 112 / 0.15) 45%, transparent 70%)",
          opacity: 0.55,
        }}
      />

      {/* sphere */}
      <span
        aria-hidden
        className="absolute inset-0 overflow-hidden rounded-full"
        style={{
          background: "radial-gradient(circle at 50% 60%, #3b3f9a 0%, #23264f 70%, #1b1d38 100%)",
          boxShadow: "inset 0 -12px 28px rgb(255 255 255 / 0.1), 0 0 0 1px rgb(255 255 255 / 0.08), 0 24px 60px -20px rgb(65 94 238 / 0.55)",
        }}
      >
        {/* drifting light: two turning colour fields and a wandering glow */}
        <span
          className="absolute inset-0"
          style={{
            filter: `blur(${Math.round(size * 0.1)}px) saturate(1.15) brightness(calc(0.8 + var(--kin-level) * 0.15))`,
          }}
        >
          <span
            className="absolute -inset-[35%] rounded-full"
            style={{ background: fieldA, translate: "-8% 6%", animation: "kin-orbit 22s linear infinite" }}
          />
          <span
            className="absolute -inset-[30%] rounded-full mix-blend-screen opacity-30"
            style={{ background: fieldB, translate: "12% -10%", animation: "kin-orbit 31s linear infinite reverse" }}
          />
          <span
            className="absolute inset-[18%] rounded-full mix-blend-soft-light"
            style={{
              background: "radial-gradient(circle, rgb(255 255 255 / 0.3) 0%, transparent 65%)",
              animation: "kin-wander 9s ease-in-out infinite alternate",
            }}
          />
        </span>

        {/* glass: soft specular highlight + warm under-light */}
        <span
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "radial-gradient(55% 40% at 32% 22%, rgb(255 255 255 / 0.3) 0%, rgb(255 255 255 / 0) 60%), radial-gradient(80% 30% at 50% 108%, rgb(255 202 0 / 0.3) 0%, transparent 70%)",
          }}
        />
      </span>

      {children ? <span className="relative">{children}</span> : null}
    </span>
  );
}
