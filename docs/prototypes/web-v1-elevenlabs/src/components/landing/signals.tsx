import { Section, SectionHead } from "../ui/section";

const signals = [
  { title: "What they say", body: "Pain, sleep, appetite, mood, medicine, who came by." },
  { title: "How they say it", body: "Pause length, speech rate, word finding, range of vocabulary." },
  { title: "Whether they answer", body: "Three missed calls in a row is itself the first warning sign." },
];

// Example series, words per minute: 25 calls inside the usual band, then 5 below it.
const series = [
  118, 121, 116, 123, 119, 122, 117, 120, 124, 118, 121, 119, 116, 122, 120, 123, 118, 117, 121,
  119, 122, 120, 118, 121, 119, 108, 104, 101, 99, 97,
];
const DIP_FROM = 25;

const W = 560;
const H = 240;
const PAD = { l: 40, r: 16, t: 16, b: 32 };
const LO = 90;
const HI = 130;
const BAND = { lo: 113, hi: 127 };

const x = (i: number) => PAD.l + (i * (W - PAD.l - PAD.r)) / (series.length - 1);
const y = (v: number) => PAD.t + ((HI - v) * (H - PAD.t - PAD.b)) / (HI - LO);
const toPoints = (from: number, to: number) =>
  series
    .slice(from, to)
    .map((v, i) => `${x(i + from)},${y(v)}`)
    .join(" ");

function SpeechChart() {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label="Example: speech rate stays in her usual range for 25 calls, then drops below it for the last 5"
    >
      {[90, 100, 110, 120, 130].map((v) => (
        <g key={v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="#ebe8e4" />
          <text x={PAD.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#a59f97" fontFamily="var(--font-mono)">
            {v}
          </text>
        </g>
      ))}
      <rect
        x={PAD.l}
        y={y(BAND.hi)}
        width={W - PAD.l - PAD.r}
        height={y(BAND.lo) - y(BAND.hi)}
        fill="#2f7d4f"
        fillOpacity="0.1"
      />
      <polyline points={toPoints(0, DIP_FROM + 1)} fill="none" stroke="#44403b" strokeWidth="2" strokeLinejoin="round" />
      <polyline points={toPoints(DIP_FROM, series.length)} fill="none" stroke="#ff4704" strokeWidth="2.5" strokeLinejoin="round" />
      {series.slice(DIP_FROM).map((v, i) => (
        <circle key={i} cx={x(i + DIP_FROM)} cy={y(v)} r="3.5" fill="#ff4704" />
      ))}
      {[
        { label: "Call 1", i: 0, anchor: "start" as const },
        { label: "Call 15", i: 14, anchor: "middle" as const },
        { label: "Call 30", i: 29, anchor: "end" as const },
      ].map((t) => (
        <text key={t.label} x={x(t.i)} y={H - 8} textAnchor={t.anchor} fontSize="11" fill="#a59f97" fontFamily="var(--font-mono)">
          {t.label}
        </text>
      ))}
    </svg>
  );
}

export function Signals() {
  return (
    <Section id="signals" band>
      <SectionHead
        eyebrow="The conversation is the sensor"
        title="Kin compares today with your parent's own last 30 days."
        lede="Not with a population average. A quiet person stays quiet; Kin looks for the change. Nothing to wear, charge or press."
      />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <dl className="border-t border-stone">
          {signals.map((s) => (
            <div key={s.title} className="grid gap-2 border-b border-stone py-6 sm:grid-cols-[180px_1fr] sm:gap-6">
              <dt className="font-medium">{s.title}</dt>
              <dd className="text-[15px] leading-relaxed text-graphite">{s.body}</dd>
            </div>
          ))}
        </dl>
        <figure className="flex min-w-0 flex-col gap-4 rounded-panel bg-eggshell p-6 shadow-lift sm:p-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-medium">Speech rate, last 30 calls</p>
            <p className="font-mono text-[12px] text-smoke">Example data · words per minute</p>
          </div>
          <SpeechChart />
          <figcaption className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-smoke">
            <span className="inline-flex items-center gap-2">
              <i className="inline-block h-2 w-4 rounded-sm bg-ok/20" />
              Her usual range
            </span>
            <span className="inline-flex items-center gap-2">
              <i className="inline-block h-2 w-4 rounded-sm bg-ember" />
              Below range 5 calls running, so the family is alerted
            </span>
          </figcaption>
        </figure>
      </div>
    </Section>
  );
}
