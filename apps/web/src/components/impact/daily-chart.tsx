"use client";

import { useState } from "react";

export type Day = { day: string; calls: number; answered: number };

const W = 640;
const H = 180;
const PAD = { top: 12, right: 8, bottom: 26, left: 28 };

function label(iso: string, long = false) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-IN", long ? { weekday: "short", day: "numeric", month: "short" } : { day: "numeric", month: "short" });
}

/** Answered calls per day (IST), one bar per day; hover or tap a day for answered of placed. */
export function DailyChart({ days }: { days: Day[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(4, ...days.map((d) => d.answered));
  const top = Math.ceil(max / 4) * 4; // a round axis maximum
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const slot = plotW / days.length;
  const bar = Math.max(4, Math.min(28, slot - 6));
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const ticks = [0, top / 2, top];
  const a = active === null ? null : days[active];

  return (
    <figure className="relative m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        role="img"
        aria-label={`Answered calls per day for the last ${days.length} days`}
        onMouseLeave={() => setActive(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--color-body)">
              {t}
            </text>
          </g>
        ))}
        {days.map((d, i) => {
          const cx = PAD.left + slot * i + slot / 2;
          const h = Math.max(0, y(0) - y(d.answered));
          const r = Math.min(4, bar / 2, h);
          const x0 = cx - bar / 2;
          // Rounded at the data end only, square on the baseline.
          const path = h
            ? `M${x0},${y(0)} V${y(d.answered) + r} Q${x0},${y(d.answered)} ${x0 + r},${y(d.answered)} H${x0 + bar - r} Q${x0 + bar},${y(d.answered)} ${x0 + bar},${y(d.answered) + r} V${y(0)} Z`
            : "";
          return (
            <g key={d.day}>
              {path ? <path d={path} fill="var(--color-blue)" opacity={active === null || active === i ? 1 : 0.45} /> : null}
              {d.calls > 0 && d.answered === 0 ? <circle cx={cx} cy={y(0) - 4} r={2.5} fill="var(--color-faint)" /> : null}
              {/* Hit area: the whole day column, wider than the bar. */}
              <rect
                x={PAD.left + slot * i}
                y={PAD.top}
                width={slot}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setActive(i)}
                onClick={() => setActive(i)}
              />
              {i === 0 || i === days.length - 1 || i === Math.floor(days.length / 2) ? (
                <text x={cx} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--color-body)">
                  {i === days.length - 1 ? "Today" : label(d.day)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {a && active !== null ? (
        <div
          className={`pointer-events-none absolute top-0 whitespace-nowrap rounded-[12px] bg-charcoal px-3 py-2 text-[13px] leading-tight text-cloud shadow-chip ${
            // Kept inside the chart: anchored left on the first days, right on the last.
            active < 3 ? "" : active > days.length - 4 ? "-translate-x-full" : "-translate-x-1/2"
          }`}
          style={{ left: `${((PAD.left + slot * active + slot / 2) / W) * 100}%` }}
        >
          <div className="font-medium">{label(a.day, true)}</div>
          <div className="text-cloud/80">
            {a.answered} answered of {a.calls} {a.calls === 1 ? "call" : "calls"}
          </div>
        </div>
      ) : null}
      <details className="mt-2 text-[13px] text-body">
        <summary className="cursor-pointer select-none">Show as a table</summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr className="text-ink">
              <th className="py-1 font-medium">Day</th>
              <th className="py-1 font-medium">Calls placed</th>
              <th className="py-1 font-medium">Answered</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.day} className="border-t border-line">
                <td className="py-1">{label(d.day, true)}</td>
                <td className="py-1">{d.calls}</td>
                <td className="py-1">{d.answered}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
