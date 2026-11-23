import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient as SvgGradient, Polygon, Polyline, Rect, Stop, Text as SvgText } from "react-native-svg";

import { useAskKin } from "@/components/kin-call";
import { TrendNoteCard } from "@/components/insight-card";
import { Button, Card, Pill, Ring } from "@/components/kit";
import { gutter, ParentPill, Screen } from "@/components/screen";
import { istDate, sampleTrendNote, type Mood, type TrendNote } from "@/lib/data";
import { api } from "@/lib/api";
import { useKin } from "@/lib/kin";
import { color, display, glass, metric } from "@/lib/theme";

const ranges = [7, 30, 90] as const;
type Range = (typeof ranges)[number];

export default function Trends() {
  const { family } = useKin();
  const [range, setRange] = useState<Range>(30);
  const { ask, sheet } = useAskKin();
  const name = family.parent.name;
  // The note on the last 30 days (apps/api/app/insights.py); the sample family has its own.
  const [note, setNote] = useState<TrendNote | null>(family.source === "sample" ? sampleTrendNote : null);
  const phone = family.parent.phone;
  const answeredCount = family.calls.filter((c) => c.status === "connected").length;
  const evening = family.calls.filter((c) => c.kind !== "reminder"); // medicine reminder calls aren't check-ins
  useEffect(() => {
    if (family.source !== "api") return setNote(sampleTrendNote);
    let alive = true;
    api
      .trends(phone)
      .then((r) => alive && setNote(r.note))
      .catch(() => alive && setNote(null));
    return () => {
      alive = false;
    };
  }, [family.source, phone, answeredCount]);

  const from = new Date(Date.now() - (range - 1) * 86400000);
  const fromIso = istDate(from);
  const inRange = evening.filter((c) => c.date >= fromIso);
  const answered = inRange.filter((c) => c.status === "connected").reverse(); // oldest first
  const withMeds = answered.filter((c) => c.outputs.meds_taken && c.outputs.meds_taken !== "unclear");
  const medsPct = withMeds.length ? withMeds.filter((c) => c.outputs.meds_taken === "all").length / withMeds.length : 0;

  // Sleep: hours when the call reported them (sample), else the 1–5 score.
  const hours = answered.every((c) => c.outputs.sleep_hours != null);
  const sleep = answered
    .map((c) => (hours ? c.outputs.sleep_hours : c.outputs.sleep_quality))
    .filter((v): v is number => v != null);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const avgSleep = avg(sleep);
  const lastWeek = avg(sleep.slice(-7));
  const unit = hours ? " h" : "/5";

  const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const speech = family.speech30?.slice(-Math.min(range, 30));

  return (
    <Screen>
      <View style={styles.toolbar}>
        <ParentPill />
        {family.calls.length ? (
          <View style={[glass, styles.segment]}>
            {ranges.map((r) => (
              <Pressable key={r} onPress={() => setRange(r)} style={[styles.seg, r === range && styles.segOn]} accessibilityState={{ selected: r === range }}>
                <Text style={[styles.segText, r === range && { color: "#fff" }]}>{r}D</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.kicker}>
          {fmt(from)} to {fmt(new Date())} · {inRange.length} {inRange.length === 1 ? "call" : "calls"}
        </Text>
        <Text style={[display, styles.title]}>Trends</Text>
      </View>

      <View style={[gutter, { marginTop: 14 }]}>
        {family.calls.length === 0 ? (
          // Nothing to chart yet: say what will appear here and how to get there.
          <Card style={{ gap: 14 }}>
            <View style={{ gap: 4 }}>
              <Text style={styles.cardTitle}>No calls yet</Text>
              <Text style={styles.sub}>
                After a few calls with Kin you&apos;ll see how {name} is doing over time, each compared with their own usual.
              </Text>
            </View>
            <View style={{ gap: 10 }}>
              <Preview c={metric.green} title="Medicine" text="How often all medicines were taken" />
              <Preview c={metric.lilac} title="Sleep" text="How well they slept, call by call" />
              <Preview c={metric.blue} title="Answered" text="How many of Kin's calls they picked up" />
            </View>
            <View style={{ gap: 8 }}>
              <Button onPress={ask}>{`Ask Kin to call ${name}`}</Button>
              {!family.parent.dailyCalls ? (
                <Button variant="soft" onPress={() => router.push("/parent")}>
                  Turn on daily calls
                </Button>
              ) : null}
            </View>
          </Card>
        ) : (
          <>
            <Card style={styles.rings}>
              <Stat ring={medsPct} c={metric.green} value={withMeds.length ? `${Math.round(medsPct * 100)}%` : "–"} label="Medicine" />
              <Stat ring={hours ? avgSleep / 7.5 : avgSleep / 5} c={metric.lilac} value={sleep.length ? `${avgSleep.toFixed(1)}${hours ? "h" : ""}` : "–"} label={hours ? "Sleep" : "Sleep /5"} />
              <Stat ring={inRange.length ? answered.length / inRange.length : 0} c={metric.blue} value={inRange.length ? `${answered.length}/${inRange.length}` : "–"} label="Answered" />
            </Card>

            {note ? <TrendNoteCard note={note} /> : null}

            {answered.length >= 2 ? (
              <Card style={{ paddingVertical: 14, gap: 10 }}>
                <View style={styles.between}>
                  <Text style={styles.cardTitle}>Mood and pain</Text>
                  <Text style={styles.sub}>
                    <Text style={{ fontWeight: "600", color: color.ink }}>{answered.filter((c) => c.outputs.pain_mentioned).length}</Text> of {answered.length} calls with pain
                  </Text>
                </View>
                <Strip label="Mood" values={answered.map((c) => (c.outputs.mood ? moodColor[c.outputs.mood] : null))} />
                <Strip label="Pain" values={answered.map((c) => (c.outputs.pain_mentioned ? metric.gold : c.outputs.pain_mentioned === false ? "#e3e8f0" : null))} />
                <View style={styles.legend}>
                  {(Object.keys(moodColor) as Mood[]).map((m) => (
                    <View key={m} style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: moodColor[m] }]} />
                      <Text style={styles.legendText}>{moodName[m]}</Text>
                    </View>
                  ))}
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: metric.gold }]} />
                    <Text style={styles.legendText}>Pain</Text>
                  </View>
                </View>
              </Card>
            ) : null}

            {sleep.length >= 2 ? (
              <Card style={{ paddingVertical: 14 }}>
                <View style={styles.between}>
                  <Text style={styles.cardTitle}>Sleep</Text>
                  <Text style={styles.sub}>
                    <Text style={{ fontWeight: "600", color: color.ink }}>
                      {lastWeek.toFixed(1)}
                      {unit}
                    </Text>{" "}
                    last 7 calls
                  </Text>
                </View>
                <BarChart
                  values={sleep}
                  min={hours ? 3.5 : 0}
                  max={hours ? 8 : 5}
                  usual={hours ? 7 : avgSleep}
                  usualLabel={hours ? "usual 7 h" : `usual ${avgSleep.toFixed(1)}/5`}
                  from={answered[0] ? fmt(new Date(answered[0].date + "T12:00:00")) : ""}
                />
              </Card>
            ) : (
              <Card style={{ gap: 4 }}>
                <Text style={styles.cardTitle}>{emptyTitle(range, inRange.length, answered.length, name)}</Text>
                <Text style={styles.sub}>{emptyText(range, inRange.length, answered.length, sleep.length, name)}</Text>
                {inRange.length === 0 && range < 90 ? (
                  <Pressable onPress={() => setRange(90)} style={({ pressed }) => [glass, styles.chip, pressed && { opacity: 0.7 }]}>
                    <Text style={styles.chipText}>Show 90 days</Text>
                  </Pressable>
                ) : null}
              </Card>
            )}
          </>
        )}

        {speech && speech.length > 5 ? (
          <Card style={{ paddingVertical: 14 }}>
            <View style={[styles.between, { alignItems: "center" }]}>
              <Text style={styles.cardTitle}>Speech rate</Text>
              <Pill tone="watch">Slower</Pill>
            </View>
            <SpeechChart values={speech} />
            <Text style={[styles.sub, { marginTop: 8 }]}>Below her usual range (dashed) for the last 5 calls.</Text>
          </Card>
        ) : null}

        {family.alert ? (
          <Pressable onPress={() => router.push("/alert")} style={({ pressed }) => [glass, styles.thread, pressed && { opacity: 0.7 }]}>
            <LinearGradient
              colors={family.alert.level === "red" ? ["#ff8a8d", color.alert] : ["#ffd76a", "#ffb800"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.threadIcon}
            >
              <Text style={styles.bang}>!</Text>
            </LinearGradient>
            <Text numberOfLines={1} style={styles.threadText}>
              <Text style={{ color: color.body }}>{family.alert.level === "red" ? "Red alert: " : "Amber alert: "}</Text>
              <Text style={{ fontWeight: "600" }}>{family.alert.title}</Text>
            </Text>
          </Pressable>
        ) : null}
      </View>
      {sheet}
    </Screen>
  );
}

// Why there is no sleep chart yet, for the range on screen.
function emptyTitle(range: number, calls: number, answered: number, name: string) {
  if (!calls) return `No calls in the last ${range} days`;
  if (!answered) return `${name} didn't answer in these ${range} days`;
  return "Not enough sleep answers yet";
}

function emptyText(range: number, calls: number, answered: number, sleep: number, name: string) {
  if (!calls) return `Kin hasn't called ${name} in this time. Older calls are still in Calls.`;
  if (!answered) return `Kin tried ${calls === 1 ? "once" : `${calls} times`}. Trends start from the first answered call.`;
  return `It appears after 2 calls where ${name} talks about sleep. ${sleep === 1 ? "1 so far." : "None yet."}`;
}

function Preview({ c, title, text }: { c: string; title: string; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Ring value={0.7} color={c} size={34} stroke={5} fontSize={1}>
        {""}
      </Ring>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: color.ink }}>{title}</Text>
        <Text style={styles.sub}>{text}</Text>
      </View>
    </View>
  );
}

const moodColor: Record<Mood, string> = { happy: metric.green, ok: metric.blue, low: metric.gold, distressed: color.alert };
const moodName: Record<Mood, string> = { happy: "Happy", ok: "Good", low: "Low", distressed: "Upset" };

/** One dot per answered call, oldest on the left; grey when the call didn't say. */
function Strip({ label, values }: { label: string; values: (string | null)[] }) {
  return (
    <View style={styles.strip}>
      <Text style={styles.stripLabel}>{label}</Text>
      <View style={styles.dots}>
        {values.slice(-30).map((c, i) => (
          <View key={i} style={[styles.stripDot, { backgroundColor: c ?? "rgba(34,35,38,0.08)" }]} />
        ))}
      </View>
    </View>
  );
}

function Stat({ ring, c, value, label }: { ring: number; c: string; value: string; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 6 }}>
      <Ring value={ring} color={c} size={74} stroke={8} fontSize={16}>
        {value}
      </Ring>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const W = 330;

function BarChart({ values, min, max, usual, usualLabel, from }: { values: number[]; min: number; max: number; usual: number; usualLabel: string; from: string }) {
  const H = 78;
  const y = (v: number) => H - ((Math.max(min, Math.min(max, v)) - min) / (max - min)) * H;
  const bw = W / Math.max(values.length, 7);
  const recent = values.length - 7;
  return (
    <Svg width="100%" viewBox={`0 -14 ${W} ${H + 30}`} style={{ marginTop: 6, aspectRatio: W / (H + 30) }}>
      <Defs>
        <SvgGradient id="sleepBar" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={metric.lilac} />
          <Stop offset="1" stopColor="#c9bcff" />
        </SvgGradient>
      </Defs>
      {values.map((v, i) => (
        <Rect key={i} x={i * bw + 1.5} y={y(v)} width={Math.max(1, bw - 3)} height={Math.max(2, H - y(v))} rx={3} fill={i >= recent ? "url(#sleepBar)" : "#d9d2fb"} />
      ))}
      <Line x1={0} x2={W} y1={y(usual)} y2={y(usual)} stroke={color.ink} strokeOpacity={0.45} strokeWidth={1} strokeDasharray="2 4" />
      <SvgText x={W} y={y(usual) - 6} fontSize={11} fill="#4d5056" textAnchor="end" fontWeight="600">
        {usualLabel}
      </SvgText>
      <SvgText x={0} y={H + 14} fontSize={11} fill={color.body}>
        {from}
      </SvgText>
      <SvgText x={W} y={H + 14} fontSize={11} fill={color.body} textAnchor="end">
        Latest
      </SvgText>
    </Svg>
  );
}

function SpeechChart({ values }: { values: number[] }) {
  const H = 84;
  const y = (v: number) => H - ((v - 90) / 40) * H;
  const x = (i: number) => (i * W) / Math.max(1, values.length - 1);
  const pts = (arr: number[], offset = 0) => arr.map((v, i) => `${x(i + offset)},${y(v)}`).join(" ");
  const split = Math.max(0, values.length - 5);
  const last = values.length - 1;
  return (
    <Svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ marginTop: 10, aspectRatio: W / H, overflow: "visible" }}>
      <Defs>
        <SvgGradient id="speechArea" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={metric.blue} stopOpacity={0.22} />
          <Stop offset="1" stopColor={metric.blue} stopOpacity={0} />
        </SvgGradient>
      </Defs>
      {[113, 127].map((v) => (
        <Line key={v} x1={0} x2={W} y1={y(v)} y2={y(v)} stroke={color.ink} strokeOpacity={0.3} strokeDasharray="2 4" />
      ))}
      <Polygon points={`0,${H} ${pts(values)} ${W},${H}`} fill="url(#speechArea)" />
      <Polyline points={pts(values.slice(0, split + 1))} fill="none" stroke={metric.blue} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />
      <Polyline points={pts(values.slice(split), split)} fill="none" stroke="#ff7a59" strokeWidth={2.8} strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx={x(last)} cy={y(values[last])} r={5} fill="#ff7a59" stroke="#fff" strokeWidth={2} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, minHeight: 46 },
  segment: { flexDirection: "row", borderRadius: 999, padding: 3 },
  seg: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  segOn: { backgroundColor: color.ink },
  segText: { fontSize: 13, fontWeight: "600", color: color.body },
  titleBlock: { paddingHorizontal: 22, paddingTop: 8 },
  kicker: { fontSize: 14, fontWeight: "500", color: color.body },
  title: { fontSize: 34, lineHeight: 38, marginTop: 4, letterSpacing: -1.4 },
  rings: { flexDirection: "row", paddingHorizontal: 10, paddingVertical: 12 },
  statLabel: { fontSize: 13, fontWeight: "500", color: color.body },
  between: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  cardTitle: { fontSize: 16, fontWeight: "600", color: color.ink },
  sub: { fontSize: 13, lineHeight: 18, color: color.body },
  thread: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 999, paddingVertical: 6, paddingLeft: 6, paddingRight: 14 },
  threadIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  threadText: { flex: 1, fontSize: 14, color: color.ink },
  bang: { fontSize: 15, fontWeight: "700", color: "#fff" },
  chip: { alignSelf: "flex-start", marginTop: 8, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 13, fontWeight: "600", color: color.ink },
  strip: { flexDirection: "row", alignItems: "center", gap: 10 },
  stripLabel: { width: 38, fontSize: 12, fontWeight: "600", color: color.body },
  dots: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 4 },
  stripDot: { width: 8, height: 14, borderRadius: 4 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 2 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, color: color.body },
});
