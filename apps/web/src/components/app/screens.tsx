import { VoiceOrb } from "../ui/voice-orb";
import { Avatar, Card, Check, Icon, icon, metric, Pill, Ring, Rings, ScreenHeader, TabBar } from "./kit";

/* Every screen renders inside <Phone>, on a 393 × 852 canvas. */

/* ── Today: the evening card ─────────────────────────────────────────── */
export function TodayScreen() {
  return (
    <>
      {/* toolbar */}
      <div className="flex items-center justify-between px-[18px] pt-[58px]">
        <span className="glass flex items-center gap-[8px] rounded-full py-[4px] pr-[14px] pl-[4px]">
          <Avatar name="amma" size={36} />
          <span className="text-[15px] font-semibold">Amma</span>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="opacity-50">
            <path d="m2 3.5 3 3 3-3" />
          </svg>
        </span>
        <span className="glass flex items-center gap-[2px] rounded-full p-[2px]">
          <span className="relative grid size-[40px] place-items-center">
            <Icon d={icon.bell} />
            <i className="absolute top-[9px] right-[10px] size-[8px] rounded-full bg-coral ring-2 ring-white" />
          </span>
          <span className="grid size-[40px] place-items-center">
            <Icon d={icon.share} />
          </span>
        </span>
      </div>

      {/* large title */}
      <div className="px-[22px] pt-[18px]">
        <p className="text-[14px] font-medium text-body">Thursday, 9 October · Lucknow</p>
        <h2 className="mt-[4px] text-[36px] leading-none font-semibold tracking-[-0.04em]">A normal day</h2>
      </div>

      <div className="mt-[14px] flex flex-col gap-[8px] px-[14px]">
        {/* hero rings */}
        <Card className="flex items-center gap-[16px] px-[16px] py-[14px]">
          <div className="relative">
            <Rings
              size={118}
              stroke={13}
              gap={3}
              rings={[
                { value: 1, color: metric.green, to: "#a6f36b" },
                { value: 0.82, color: metric.lilac, to: "#d9cdff" },
                { value: 0.88, color: metric.blue, to: "#8fb0ff" },
              ]}
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col divide-y divide-ink/[0.07]">
            <Stat3 color={metric.green} value="2/2" label="Medicine" />
            <Stat3 color={metric.lilac} value="6 h" label="Sleep" />
            <Stat3 color={metric.blue} value="Good" label="Mood" />
          </div>
        </Card>

        {/* call */}
        <Card className="flex items-center gap-[12px] py-[10px] pr-[10px] pl-[10px]">
          <Orb size={48} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between">
              <p className="text-[15px] font-semibold">Tonight&apos;s call</p>
              <p className="text-[12px] font-medium text-body tabular-nums">3:40</p>
            </div>
            <div className="mt-[6px] flex h-[20px] items-center justify-between">
              {wave.map((v, i) => (
                <i
                  key={i}
                  className="block w-[3px] rounded-full"
                  style={{ height: v, background: i < 18 ? "#222326" : "rgb(34 35 38 / 0.18)" }}
                />
              ))}
            </div>
          </div>
          <span className="grid size-[42px] shrink-0 place-items-center rounded-full bg-gradient-to-b from-[#3a3c45] to-charcoal text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_8px_16px_-8px_rgba(0,0,0,0.5)]">
            <svg width="14" height="16" viewBox="0 0 16 18" className="ml-[2px]">
              <path d="M2 1.5v15l13-7.5z" fill="currentColor" />
            </svg>
          </span>
        </Card>

        {/* bento tiles */}
        <div className="grid grid-cols-2 gap-[8px]">
          <div
            className="glass-tint relative flex flex-col gap-[10px] overflow-hidden rounded-[24px] p-[14px]"
            style={{ background: "linear-gradient(160deg, rgb(255 236 190 / 0.85), rgb(255 255 255 / 0.45))" }}
          >
            <Ring value={0.6} color={metric.gold} size={36} stroke={4.5} textClass="text-[11px]">
              3d
            </Ring>
            <div>
            <p className="text-[12px] font-semibold tracking-wide text-watch uppercase">Watch</p>
            <p className="mt-[2px] text-[16px] leading-[1.15] font-semibold tracking-[-0.01em]">Knee pain, a little worse</p>
            </div>
          </div>
          <div className="glass relative flex flex-col gap-[10px] rounded-[24px] p-[14px]">
            <span className="grid size-[36px] place-items-center rounded-full bg-gradient-to-br from-[#c9bcff] to-[#ffc6b5] text-[22px] leading-none font-semibold text-white">
              &ldquo;
            </span>
            <div>
            <p className="text-[12px] font-semibold tracking-wide text-body uppercase">She asked</p>
            <p className="mt-[2px] text-[16px] leading-[1.15] font-semibold tracking-[-0.01em]">Can Neha call on Sunday?</p>
            </div>
          </div>
        </div>

        {/* memory thread */}
        <div className="glass flex items-center gap-[10px] rounded-full py-[6px] pr-[14px] pl-[6px]">
          <span className="grid size-[34px] shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#8fb0ff] to-blue text-white">
            <Icon d="M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3ZM9.5 19.5h5" size={17} />
          </span>
          <p className="min-w-0 flex-1 truncate text-[14px]">
            <span className="text-body">Tomorrow Kin asks </span>
            <span className="font-semibold">about Aarav&apos;s exam</span>
          </p>
        </div>

        {/* this week */}
        <Card className="px-[16px] py-[12px]">
          <div className="flex items-baseline justify-between">
            <p className="text-[15px] font-semibold">This week</p>
            <p className="text-[13px] text-body">6 of 7 good days</p>
          </div>
          <div className="mt-[10px] flex justify-between">
            {week.map((d, i) => (
              <div key={i} className="flex flex-col items-center gap-[6px]">
                <span
                  className={`grid size-[34px] place-items-center rounded-full text-white ${i === week.length - 1 ? "ring-2 ring-ink/80 ring-offset-2 ring-offset-white/60" : ""}`}
                  style={{ background: d.tone === "ok" ? metric.green : metric.gold, boxShadow: `0 4px 10px -4px ${d.tone === "ok" ? metric.green : metric.gold}` }}
                >
                  {d.tone === "ok" ? (
                    <svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <path d="m2.5 6.3 2.3 2.2 4.7-5" />
                    </svg>
                  ) : (
                    <span className="text-[14px] leading-none font-bold">!</span>
                  )}
                </span>
                <span className={`text-[12px] font-semibold ${i === week.length - 1 ? "text-ink" : "text-body"}`}>{d.day}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <TabBar active="today" />
    </>
  );
}

const week: { day: string; tone: "ok" | "watch" }[] = [
  { day: "F", tone: "ok" },
  { day: "S", tone: "ok" },
  { day: "S", tone: "ok" },
  { day: "M", tone: "ok" },
  { day: "T", tone: "watch" },
  { day: "W", tone: "ok" },
  { day: "T", tone: "ok" },
];

const wave = [6, 10, 8, 14, 9, 16, 12, 18, 10, 7, 12, 15, 9, 13, 17, 11, 8, 12, 9, 14, 10, 7, 11, 8, 12, 6, 9, 13, 7, 10];

function Stat3({ color, value, label }: { color: string; value: string; label: string }) {
  return (
    <div className="flex items-center justify-between gap-[8px] py-[9px] first:pt-0 last:pb-0">
      <p className="flex items-center gap-[7px] text-[15px] font-medium text-body">
        <i className="block size-[9px] rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
        {label}
      </p>
      <p className="text-[20px] leading-none font-semibold tracking-[-0.03em]">{value}</p>
    </div>
  );
}

/** The Kin voice orb, same as the landing page call sphere. */
export function Orb({ size = 48 }: { size?: number }) {
  return (
    <span
      className="relative block shrink-0 rounded-full shadow-[0_6px_16px_-6px_rgba(65,94,238,0.6)]"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 30% 28%, #ffffffcc 0%, transparent 35%), radial-gradient(circle at 72% 35%, ${metric.coral} 0%, transparent 55%), radial-gradient(circle at 35% 78%, ${metric.blue} 0%, transparent 60%), radial-gradient(circle, #c9bcff 0%, #8d7bff 80%)`,
      }}
    />
  );
}

/* ── Live call ───────────────────────────────────────────────────────── */
export function CallScreen() {
  return (
    <div className="absolute inset-0 flex flex-col items-center overflow-hidden bg-charcoal pt-[86px] text-white">
      <div
        aria-hidden
        className="absolute -top-[120px] left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
        style={{ background: `radial-gradient(circle, ${metric.lilac} 0%, transparent 60%)` }}
      />
      <p className="relative text-[15px] text-white/60">Kin is talking with</p>
      <p className="relative mt-[4px] text-[30px] font-semibold tracking-[-0.03em]">Amma</p>
      <p className="relative mt-[2px] text-[15px] text-white/60 tabular-nums">02:14 · हिन्दी</p>

      <div className="relative mt-[26px]">
        <VoiceOrb size={176} active />
      </div>

      <div className="relative mt-[28px] flex w-full flex-col gap-[10px] px-[18px] font-deva">
        <Bubble who="Kin">कल भी आपने घुटने का बताया था। आज दर्द ज़्यादा है या कम?</Bubble>
        <Bubble who="Amma" right>
          थोड़ा ज़्यादा।
        </Bubble>
        <div className="flex items-center gap-[8px] self-start glass-dark rounded-full px-[12px] py-[7px] font-sans text-[13px] text-white/80">
          <i className="block size-[7px] rounded-full" style={{ background: metric.gold }} />
          Noted: knee pain, day 3
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-[44px] flex justify-center gap-[28px]">
        <CallButton label="Mute" />
        <CallButton label="Join" accent />
        <CallButton label="End" end />
      </div>
    </div>
  );
}

function Bubble({ who, right, children }: { who: string; right?: boolean; children: string }) {
  return (
    <div
      className={`max-w-[88%] rounded-[20px] px-[14px] py-[10px] ${
        right ? "self-end rounded-br-[6px] bg-white text-ink" : "glass-dark self-start rounded-bl-[6px]"
      }`}
    >
      <p className={`font-sans text-[11px] font-semibold tracking-wide uppercase ${right ? "text-body" : "text-white/50"}`}>{who}</p>
      <p className="mt-[2px] text-[16px] leading-snug">{children}</p>
    </div>
  );
}

function CallButton({ label, accent, end }: { label: string; accent?: boolean; end?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-[8px]">
      <span
        className={`grid size-[66px] place-items-center rounded-full ${
          end ? "bg-alert shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]" : accent ? "bg-white text-charcoal" : "glass-dark"
        }`}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {end ? (
            <path d="M3 13.5c5-4.6 13-4.6 18 0l-2.3 2.6-3.4-1.4v-2.4a10 10 0 0 0-6.6 0v2.4l-3.4 1.4z" fill="currentColor" stroke="none" />
          ) : accent ? (
            <path d="M12 5v14M5 12h14" />
          ) : (
            <>
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
            </>
          )}
        </svg>
      </span>
      <span className="text-[13px] text-white/70">{label}</span>
    </div>
  );
}

/* ── Lock screen with the evening push ───────────────────────────────── */
/** `notifications="high"` sits the stack under the clock, for tightly cropped mockups. */
export function LockScreen({ notifications = "bottom" }: { notifications?: "bottom" | "high" }) {
  return (
    <div
      className="absolute inset-0 text-white"
      style={{
        background: `radial-gradient(90% 55% at 20% 85%, ${metric.coral} 0%, transparent 70%), radial-gradient(80% 50% at 90% 70%, #ffd9a8 0%, transparent 70%), linear-gradient(180deg, #5b6fd0 0%, #9d8cff 45%, #c9a3e6 70%, #f2b8a6 100%)`,
      }}
    >
      {/* lock glyph under the Dynamic Island */}
      <div className="absolute top-[62px] left-1/2 -translate-x-1/2 opacity-90">
        <svg width="16" height="20" viewBox="0 0 16 20" fill="currentColor">
          <path d="M3 8V5.5a5 5 0 0 1 10 0V8h.5A2.5 2.5 0 0 1 16 10.5v7a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 0 17.5v-7A2.5 2.5 0 0 1 2.5 8H3Zm2 0h6V5.5a3 3 0 0 0-6 0V8Z" />
        </svg>
      </div>

      {/* date + time */}
      <div className="absolute inset-x-0 top-[96px] flex flex-col items-center">
        <p className="text-[21px] font-semibold text-white/90">Thursday 9 October</p>
        <p className="mt-[-4px] text-[104px] leading-none font-bold tracking-[-0.03em] text-white/95">7:16</p>
      </div>

      {/* notifications rise from the bottom, as on iOS */}
      <div className={`absolute inset-x-[10px] ${notifications === "high" ? "top-[262px]" : "bottom-[120px]"}`}>
        <NotificationStack />
      </div>

      {/* torch and camera */}
      <span className="absolute bottom-[46px] left-[46px] grid size-[52px] place-items-center rounded-full bg-black/25 backdrop-blur-xl">
        <svg width="18" height="24" viewBox="0 0 18 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
          <path d="M3 1.5h12v4l-3 4.5v12.5H6V10L3 5.5z" />
          <path d="M9 13.5v3" strokeLinecap="round" />
        </svg>
      </span>
      <span className="absolute right-[46px] bottom-[46px] grid size-[52px] place-items-center rounded-full bg-black/25 backdrop-blur-xl">
        <svg width="24" height="20" viewBox="0 0 24 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
          <path d="M2 6a2 2 0 0 1 2-2h3l2-2.5h6L17 4h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" />
          <circle cx="12" cy="11" r="4" />
        </svg>
      </span>
      <div className="absolute bottom-[10px] left-1/2 h-[5px] w-[134px] -translate-x-1/2 rounded-full bg-white" />
    </div>
  );
}

const pushes = [
  {
    title: "Amma's day: normal",
    time: "now",
    body: "Took both medicines, slept about 6 hours. Knee pain for the third day, worth asking about.",
  },
  { title: "Call finished", time: "7:14 pm", body: "Kin spoke with Amma for 3 min 40 s, in Hindi." },
  { title: "Tomorrow", time: "7:14 pm", body: "Kin will ask Amma how Aarav's exam went." },
];

/** An expanded iOS notification group: app header, then each notification. */
export function NotificationStack() {
  return (
    <div className="flex flex-col gap-[8px]">
      <div className="flex items-center justify-between px-[6px]">
        <p className="text-[19px] font-semibold text-white">Kin</p>
        <span className="flex items-center gap-[6px]">
          <span className="rounded-full bg-white/35 px-[12px] py-[5px] text-[13px] font-semibold text-ink/80 backdrop-blur-xl">
            Show less
          </span>
          <span className="grid size-[28px] place-items-center rounded-full bg-white/35 text-ink/70 backdrop-blur-xl">
            <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M2 2l6 6M8 2 2 8" />
            </svg>
          </span>
        </span>
      </div>
      {pushes.map((p) => (
        <div
          key={p.title}
          className="flex gap-[12px] rounded-[22px] bg-white/60 p-[13px] text-ink shadow-[0_10px_30px_-14px_rgba(40,30,90,0.35)] backdrop-blur-2xl"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/app-icon.svg" alt="" width={36} height={36} className="size-[36px] shrink-0 rounded-[9px]" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-[8px]">
              <p className="truncate text-[15px] font-semibold">{p.title}</p>
              <p className="shrink-0 text-[13px] text-ink/50">{p.time}</p>
            </div>
            <p className="text-[14.5px] leading-snug">{p.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── 30-day trends ───────────────────────────────────────────────────── */
const sleep = [7, 7.2, 6.8, 7.1, 7.4, 6.9, 7, 7.2, 6.6, 7.1, 7.3, 6.9, 7, 6.8, 7.2, 7, 6.7, 7.1, 6.9, 7.2, 6.5, 6.4, 6.2, 6.3, 6.1, 6, 6.2, 5.9, 6.1, 6];
const speech = [118, 121, 116, 123, 119, 122, 117, 120, 124, 118, 121, 119, 116, 122, 120, 123, 118, 117, 121, 119, 122, 120, 118, 121, 119, 108, 104, 101, 99, 97];

export function TrendsScreen() {
  // sleep chart geometry
  const SW = 330;
  const SH = 78;
  const sy = (v: number) => SH - ((v - 3.5) / 4.5) * SH;
  const bw = SW / sleep.length;
  // speech chart geometry
  const W = 330;
  const H = 84;
  const y = (v: number) => H - ((v - 90) / 40) * H;
  const x = (i: number) => (i * W) / (speech.length - 1);
  const line = speech.map((v, i) => `${x(i)},${y(v)}`).join(" ");

  return (
    <>
      {/* toolbar */}
      <div className="flex items-center justify-between px-[18px] pt-[58px]">
        <span className="glass flex items-center gap-[8px] rounded-full py-[4px] pr-[14px] pl-[4px]">
          <Avatar name="amma" size={36} />
          <span className="text-[15px] font-semibold">Amma</span>
        </span>
        <span className="glass flex rounded-full p-[3px] text-[13px] font-semibold">
          <span className="rounded-full px-[12px] py-[7px] text-body">7D</span>
          <span className="rounded-full bg-ink px-[12px] py-[7px] text-white">30D</span>
          <span className="rounded-full px-[12px] py-[7px] text-body">90D</span>
        </span>
      </div>

      <div className="px-[22px] pt-[16px]">
        <p className="text-[14px] font-medium text-body">10 Sep to 9 Oct · 30 calls</p>
        <h2 className="mt-[4px] text-[34px] leading-none font-semibold tracking-[-0.04em]">Trends</h2>
      </div>

      <div className="mt-[14px] flex flex-col gap-[8px] px-[14px]">
        {/* three rings with the value inside */}
        <Card className="flex justify-between px-[10px] py-[12px]">
          <Stat ring={0.93} color={metric.green} value="93%" label="Medicine" />
          <Stat ring={0.87} color={metric.lilac} value="6.4h" label="Sleep" />
          <Stat ring={1} color={metric.blue} value="30/30" label="Answered" />
        </Card>

        {/* sleep */}
        <Card className="px-[16px] py-[14px]">
          <div className="flex items-baseline justify-between">
            <p className="text-[16px] font-semibold">Sleep</p>
            <p className="text-[13px] text-body">
              <span className="font-semibold text-ink">6.0 h</span> this week
            </p>
          </div>
          <svg viewBox={`0 -14 ${SW} ${SH + 30}`} className="mt-[6px] h-auto w-full overflow-visible">
            <defs>
              <linearGradient id="sleepBar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={metric.lilac} />
                <stop offset="1" stopColor="#c9bcff" />
              </linearGradient>
            </defs>
                        {sleep.map((v, i) => (
              <rect
                key={i}
                x={i * bw + 1.5}
                y={sy(v)}
                width={bw - 3}
                height={SH - sy(v)}
                rx="3"
                fill={i >= 23 ? "url(#sleepBar)" : "#d9d2fb"}
              />
            ))}
            <line x1="0" x2={SW} y1={sy(7)} y2={sy(7)} stroke="#222326" strokeOpacity=".45" strokeWidth="1" strokeDasharray="2 4" />
            <text x={SW} y={sy(7) - 6} fontSize="11" fill="#4d5056" textAnchor="end" fontWeight="600">usual 7 h</text>
            <text x="0" y={SH + 14} fontSize="11" fill="#747679">10 Sep</text>
            <text x={SW} y={SH + 14} fontSize="11" fill="#747679" textAnchor="end">Today</text>
                      </svg>
        </Card>

        {/* speech rate */}
        <Card className="px-[16px] py-[14px]">
          <div className="flex items-center justify-between">
            <p className="text-[16px] font-semibold">Speech rate</p>
            <Pill tone="watch">Slower</Pill>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="mt-[10px] h-auto w-full overflow-visible">
            <defs>
              <linearGradient id="speechArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={metric.blue} stopOpacity=".22" />
                <stop offset="1" stopColor={metric.blue} stopOpacity="0" />
              </linearGradient>
            </defs>
            {[113, 127].map((v) => (
              <line key={v} x1="0" x2={W} y1={y(v)} y2={y(v)} stroke="#222326" strokeOpacity=".3" strokeDasharray="2 4" />
            ))}
            <polygon points={`0,${H} ${line} ${W},${H}`} fill="url(#speechArea)" />
            <polyline
              points={speech.slice(0, 26).map((v, i) => `${x(i)},${y(v)}`).join(" ")}
              fill="none"
              stroke={metric.blue}
              strokeWidth="2.4"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <polyline
              points={speech.slice(25).map((v, i) => `${x(i + 25)},${y(v)}`).join(" ")}
              fill="none"
              stroke="#ff7a59"
              strokeWidth="2.8"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <circle cx={x(29)} cy={y(97)} r="5" fill="#ff7a59" stroke="white" strokeWidth="2" />
          </svg>
          <p className="mt-[8px] text-[13px] text-body">Below her usual range (dashed) for the last 5 calls.</p>
        </Card>

        {/* what Kin did about it */}
        <div className="glass flex items-center gap-[10px] rounded-full py-[6px] pr-[14px] pl-[6px]">
          <span className="grid size-[34px] shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#ffd76a] to-[#ffb800] text-[15px] font-bold text-white">
            !
          </span>
          <p className="min-w-0 flex-1 truncate text-[14px]">
            <span className="text-body">Amber alert sent to </span>
            <span className="font-semibold">Neha and Rahul</span>
          </p>
        </div>
      </div>
      <TabBar active="trends" />
    </>
  );
}

function Stat({ ring, color, value, label }: { ring: number; color: string; value: string; label: string }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-[6px]">
      <Ring value={ring} color={color} size={74} stroke={8} textClass="text-[16px]">
        {value}
      </Ring>
      <p className="text-[13px] font-medium text-body">{label}</p>
    </div>
  );
}

/* ── Memory ──────────────────────────────────────────────────────────── */
const memories = [
  { tag: "Family", text: "Grandson Aarav has his board exams in March.", when: "Mon" },
  { tag: "Health", text: "Knee pain since Tuesday. Left knee, worse on stairs.", when: "Today" },
  { tag: "Plans", text: "Wants a green silk sari for Diwali.", when: "Today" },
  { tag: "People", text: "Sharma aunty visits on Wednesdays.", when: "Last week" },
];

export function MemoryScreen() {
  return (
    <>
      <ScreenHeader kicker="What Kin remembers" title="Memory" />
      <div className="flex flex-col gap-[10px] px-[16px]">
        <div className="glass-tint rounded-[28px] p-[16px] text-white" style={{ background: "linear-gradient(150deg, rgb(31 32 37 / 0.92), rgb(65 70 110 / 0.8))" }}>
          <p className="text-[13px] font-semibold tracking-wide text-white/50 uppercase">Tonight Kin will ask</p>
          <p className="mt-[6px] text-[17px] leading-snug">
            &ldquo;Did Aarav&apos;s maths test go well? You were worried on Monday.&rdquo;
          </p>
        </div>
        {memories.map((m) => (
          <Card key={m.text} className="flex gap-[12px]">
            <span className="mt-[2px] h-fit rounded-full bg-white/70 px-[9px] py-[3px] text-[12px] font-semibold">{m.tag}</span>
            <p className="min-w-0 flex-1 text-[15px] leading-snug">{m.text}</p>
            <span className="shrink-0 text-[12px] text-body">{m.when}</span>
          </Card>
        ))}
        <div className="flex items-center gap-[10px] rounded-[22px] border border-dashed border-line p-[14px] text-[14px] text-body">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="5" y="10" width="14" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
          2 topics Kin never brings up
        </div>
      </div>
      <TabBar active="calls" />
    </>
  );
}

/* ── Amber / red alert ───────────────────────────────────────────────── */
export function AlertScreen() {
  return (
    <>
      <div className="px-[22px] pt-[66px]">
        <Pill tone="watch">Amber alert</Pill>
        <h2 className="mt-[12px] text-[28px] leading-[1.1] font-semibold tracking-[-0.03em]">
          Amma is speaking more slowly this week
        </h2>
        <p className="mt-[8px] text-[15px] text-body">Based on 5 calls, compared with her own last 30 days.</p>
      </div>
      <div className="mt-[18px] flex flex-col gap-[10px] px-[16px]">
        <Card className="flex flex-col gap-[12px]">
          <Evidence color={metric.coral} label="Speech rate" value="−18%" />
          <Evidence color={metric.lilac} label="Sleep" value="6.0 h, down 1 h" />
          <Evidence color={metric.gold} label="Knee pain" value="3 days" />
          <Evidence color={metric.green} label="Medicine" value="All taken" />
        </Card>
        <Card>
          <p className="text-[13px] font-semibold tracking-wide text-body uppercase">Ask her</p>
          <p className="mt-[6px] text-[16px] leading-snug">&ldquo;Are you feeling tired in the afternoons, Amma?&rdquo;</p>
        </Card>
      </div>
      <div className="absolute inset-x-[16px] bottom-[40px] flex flex-col gap-[10px]">
        <span className="flex h-[54px] items-center justify-center gap-[8px] rounded-full bg-gradient-to-b from-[#3a3c45] to-charcoal text-[17px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_12px_24px_-10px_rgba(0,0,0,0.5)]">
          Call Amma now
        </span>
        <span className="glass flex h-[54px] items-center justify-center rounded-full text-[17px] font-semibold">
          Book a teleconsult
        </span>
      </div>
    </>
  );
}

function Evidence({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-[10px] text-[15px]">
      <i className="block h-[22px] w-[4px] rounded-full" style={{ background: color }} />
      <span className="text-body">{label}</span>
      <span className="ml-auto font-semibold">{value}</span>
    </div>
  );
}

/* ── Medicines ───────────────────────────────────────────────────────── */
const meds = [
  { name: "Amlodipine 5 mg", hint: "After breakfast · 24 left", done: true, color: metric.blue, low: false },
  { name: "Metformin 500 mg", hint: "After lunch · 38 left", done: true, color: metric.lilac, low: false },
  { name: "Calcium + D3", hint: "After dinner · 4 days left", done: false, color: metric.coral, low: true },
];

export function MedicinesScreen() {
  return (
    <>
      <ScreenHeader kicker="Kin checks on every call" title="Medicines" />
      <div className="flex flex-col gap-[10px] px-[16px]">
        <Card className="flex items-center gap-[14px]">
          <span className="grid size-[54px] shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#ffd76a] to-[#ff8f70] text-[22px] font-semibold text-white shadow-[0_6px_14px_-6px_#ff8f70]">
            13
          </span>
          <div>
            <p className="text-[16px] font-semibold">13 days in a row</p>
            <p className="text-[13px] text-body">Every dose taken. Best run: 13.</p>
          </div>
        </Card>
        <Card className="flex flex-col gap-[12px]">
          {meds.map((m) => (
            <div key={m.name} className="flex items-center gap-[12px]">
              <span className="grid size-[38px] place-items-center rounded-[12px]" style={{ background: `${m.color}33` }}>
                <i className="block h-[9px] w-[20px] rounded-full" style={{ background: m.color }} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold">{m.name}</p>
                <p className={`text-[12.5px] ${m.low ? "font-medium text-alert" : "text-body"}`}>{m.hint}</p>
              </div>
              <Check done={m.done} />
            </div>
          ))}
        </Card>
        <Card className="flex items-center gap-[12px]">
          <span className="grid size-[38px] place-items-center rounded-full bg-blue/12 text-blue">
            <Icon d={icon.phone} size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">Reminder call · 8:30 am</p>
            <p className="text-[12.5px] text-body">One minute, at tablet time</p>
          </div>
          <Pill tone="ok">Taken</Pill>
        </Card>
        <div className="glass flex items-center gap-[10px] rounded-full px-[16px] py-[12px]">
          <i className="block size-[9px] rounded-full bg-alert" />
          <span className="flex-1 text-[14px] font-semibold">Calcium + D3: 4 days left</span>
          <span className="text-[14px] font-semibold text-blue">Reorder</span>
        </div>
      </div>
      <TabBar active="family" />
    </>
  );
}

/* ── Monthly groceries ───────────────────────────────────────────────── */
const groceries = [
  { name: "Atta", qty: "5 kg", due: "Due today", tone: "watch" as const },
  { name: "Toor dal", qty: "1 kg", due: "Due Sun", tone: "watch" as const },
  { name: "Tea", qty: "250 g", due: "Overdue", tone: "alert" as const },
  { name: "Milk powder", qty: "500 g", due: "Due Mon", tone: "watch" as const },
];

export function GroceriesScreen() {
  return (
    <>
      <ScreenHeader kicker="Amma's home in Lucknow" title="Groceries" />
      <div className="flex flex-col gap-[10px] px-[16px]">
        <Card className="flex flex-col gap-[12px]">
          <div className="flex items-baseline justify-between">
            <p className="text-[15px] font-semibold">Due this week</p>
            <p className="text-[13px] text-body">4 of 11 items</p>
          </div>
          {groceries.map((g) => (
            <div key={g.name} className="flex items-center gap-[10px]">
              <span className="grid size-[24px] place-items-center rounded-[7px] bg-charcoal text-white">
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="m2.5 6.3 2.3 2.2 4.7-5" /></svg>
              </span>
              <p className="flex-1 text-[15px] font-medium">
                {g.name} <span className="text-body">{g.qty}</span>
              </p>
              <Pill tone={g.tone}>{g.due}</Pill>
            </div>
          ))}
        </Card>
        <span className="flex h-[52px] items-center justify-center gap-[8px] rounded-full bg-gradient-to-b from-[#3a3c45] to-charcoal text-[16px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_12px_24px_-10px_rgba(0,0,0,0.5)]">
          Add all 4 to one Amazon cart
        </span>
        <span className="glass flex h-[52px] items-center justify-center rounded-full text-[16px] font-semibold">Send the list to the kirana</span>
        <Card>
          <p className="text-[13px] font-semibold tracking-wide text-body uppercase">Later</p>
          <p className="mt-[6px] text-[14px] leading-snug text-body">Rice, cooking oil, salt and 4 more, each on its own cycle.</p>
        </Card>
      </div>
      <TabBar active="family" />
    </>
  );
}

/* ── Scam shield ─────────────────────────────────────────────────────── */
export function ScamScreen() {
  return (
    <>
      <ScreenHeader kicker="Saturday, 31 October · Lucknow" title="Today" />
      <div className="flex flex-col gap-[10px] px-[16px]">
        <div className="rounded-[28px] bg-watch p-[18px] text-white shadow-[0_18px_30px_-16px_rgba(199,119,0,0.7)]">
          <p className="text-[12px] font-semibold tracking-wide text-white/80 uppercase">Scam warning · Today 4:12 pm</p>
          <p className="mt-[6px] text-[22px] leading-[1.15] font-semibold tracking-[-0.02em]">Amma may be talking to a scammer</p>
          <p className="mt-[8px] text-[14px] leading-snug text-white/90">
            Amma told Kin: &ldquo;A man from the bank wants the OTP for my KYC.&rdquo;
          </p>
          <div className="mt-[14px] flex gap-[8px]">
            <span className="flex h-[40px] flex-1 items-center justify-center rounded-full bg-white text-[14px] font-semibold text-watch">Call Amma</span>
            <span className="flex h-[40px] flex-1 items-center justify-center rounded-full bg-white/20 text-[14px] font-semibold">Call 1930</span>
          </div>
        </div>
        <Card>
          <p className="text-[13px] font-semibold tracking-wide text-body uppercase">What Kin told her</p>
          <p className="mt-[6px] text-[15px] leading-snug">
            &ldquo;Never share an OTP or PIN, and don&apos;t send money or install an app. Banks and police never ask. Please hang up.&rdquo;
          </p>
        </Card>
        <Card className="flex items-center gap-[12px]">
          <span className="grid size-[38px] place-items-center rounded-full bg-alert-soft text-[13px] font-bold text-alert">108</span>
          <div>
            <p className="text-[15px] font-semibold">Emergencies too</p>
            <p className="text-[13px] text-body">A fall or chest pain: Kin connects Rahul</p>
          </div>
        </Card>
      </div>
      <TabBar active="today" />
    </>
  );
}

/* ── Family circle ───────────────────────────────────────────────────── */
export function FamilyScreen() {
  return (
    <>
      <ScreenHeader kicker="Amma's circle" title="Family" />
      <div className="flex flex-col gap-[10px] px-[16px]">
        <Card className="flex flex-col gap-[14px]">
          <Member name="neha" title="Neha" sub="Daughter · Singapore" tag="Owner" />
          <Member name="rahul" title="Rahul" sub="Son · Pune" tag="Red alerts" />
          <Member name="priya" title="Dr. Priya Menon" sub="Family doctor · Lucknow" tag="Teleconsult" />
        </Card>
        <Card>
          <div className="flex items-center gap-[8px]">
            <span className="grid size-[26px] place-items-center rounded-full bg-gradient-to-br from-[#c9bcff] to-[#ffc6b5] text-[16px] leading-none font-semibold text-white">&ldquo;</span>
            <p className="text-[12.5px] font-medium text-body">Amma says · for Neha · 7:18 pm</p>
          </div>
          <p className="mt-[8px] text-[16px] leading-snug font-medium">Can Neha call me on Sunday? I want to hear about the new flat.</p>
          <div className="mt-[12px] flex items-center gap-[10px] rounded-[16px] bg-white/70 px-[12px] py-[9px]">
            <span className="grid size-[24px] place-items-center rounded-full bg-gradient-to-br from-[#c9bcff] to-[#8a72ff] text-white">
              <Icon d="M4 5h16v11H8l-4 4z" size={12} />
            </span>
            <p className="text-[13px]">
              <span className="font-semibold">Neha:</span> <span className="text-body">Yes! Sunday at 11. Kin tells her tomorrow.</span>
            </p>
          </div>
        </Card>
        <Card className="flex items-center gap-[12px]">
          <span className="grid size-[40px] place-items-center rounded-full bg-alert-soft text-[15px] font-bold text-alert">
            108
          </span>
          <div>
            <p className="text-[16px] font-semibold">Emergency</p>
            <p className="text-[13px] text-body">Kin connects Amma to Rahul on a red alert</p>
          </div>
        </Card>
      </div>
      <TabBar active="family" />
    </>
  );
}

function Member({ name, title, sub, tag }: { name: string; title: string; sub: string; tag: string }) {
  return (
    <div className="flex items-center gap-[12px]">
      <Avatar name={name} size={42} />
      <div className="min-w-0 flex-1">
        <p className="text-[16px] font-semibold">{title}</p>
        <p className="text-[13px] text-body">{sub}</p>
      </div>
      <span className="rounded-full bg-white/70 px-[10px] py-[4px] text-[12px] font-semibold">{tag}</span>
    </div>
  );
}

/* ── Introduction call (merge) ───────────────────────────────────────── */
export function IntroScreen() {
  return (
    <div className="absolute inset-0 flex flex-col pt-[70px]">
      <div className="px-[22px]">
        <p className="text-[14px] font-medium text-body">Step 3 of 3</p>
        <h2 className="mt-[2px] text-[28px] leading-[1.1] font-semibold tracking-[-0.03em]">Introduce Kin on a call with Amma</h2>
      </div>
      <div className="mt-[18px] flex flex-col gap-[10px] px-[16px]">
        <Step n={1} done title="Call Amma" sub="Like any other evening" />
        <Step n={2} done title="Tap Add call" sub="Dial Kin: +91 79714 13869" />
        <Step n={3} title="Tap Merge" sub="Kin says hello and asks for her OK" />
      </div>
      <div className="mx-[16px] mt-[16px] flex items-center gap-[12px] glass rounded-[26px] p-[14px]">
        <div className="flex -space-x-[10px]">
          <span className="rounded-full ring-2 ring-white"><Avatar name="neha" size={36} /></span>
          <span className="rounded-full ring-2 ring-white"><Avatar name="amma" size={36} /></span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/app-icon.svg" alt="" width={36} height={36} className="size-[36px] rounded-full ring-2 ring-white" />
        </div>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold">Conference · 00:42</p>
          <p className="text-[13px] text-body">Consent recorded in Amma&apos;s words</p>
        </div>
        <span className="ml-auto"><Check /></span>
      </div>
      <div className="mx-[16px] mt-[10px] glass rounded-[26px] p-[16px]">
        <p className="text-[13px] font-semibold tracking-wide text-body uppercase">Then</p>
        <div className="mt-[10px] flex flex-col gap-[10px] text-[14.5px]">
          <p className="flex items-center gap-[10px]">
            <i className="block size-[8px] rounded-full bg-green" /> Daily calls at 7:15 pm, in Hindi
          </p>
          <p className="flex items-center gap-[10px]">
            <i className="block size-[8px] rounded-full bg-blue" /> Reminder calls at tablet time
          </p>
          <p className="flex items-center gap-[10px]">
            <i className="block size-[8px] rounded-full bg-lilac" /> Kin always says it&apos;s an AI assistant
          </p>
        </div>
      </div>
    </div>
  );
}

function Step({ n, title, sub, done }: { n: number; title: string; sub: string; done?: boolean }) {
  return (
    <div className="flex items-center gap-[14px] glass rounded-[26px] p-[14px]">
      {done ? (
        <Check />
      ) : (
        <span className="grid size-[26px] place-items-center rounded-full bg-blue text-[12px] font-semibold text-white shadow-[0_4px_10px_-3px_rgba(65,94,238,0.6)]">{n}</span>
      )}
      <div>
        <p className="text-[16px] font-semibold">{title}</p>
        <p className="text-[13px] text-body">{sub}</p>
      </div>
    </div>
  );
}
