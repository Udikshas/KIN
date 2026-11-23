import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { FamilyMessages } from "@/components/family-messages";
import { KinCallCard } from "@/components/kin-call";
import { InsightCard, shareCall } from "@/components/insight-card";
import { UrgentBanner } from "@/components/urgent-banner";
import { useChores } from "@/components/chores";
import { Card, Icon, icon, Ring, Rings } from "@/components/kit";
import { gutter, ParentPill, Screen } from "@/components/screen";
import { TabIcon } from "@/components/tab-icons";
import { formatDay, formatDuration, istDate, istTime, medsLabel, moodLabel, painStreak, sleepOf, type DailyStatus } from "@/lib/data";
import { useKin } from "@/lib/kin";
import { color, display, glass, metric } from "@/lib/theme";

const moodValue = { happy: 1, ok: 0.88, low: 0.5, distressed: 0.25 };
const medsValue = { all: 1, some: 0.5, none: 0, unclear: 0 };

/** Medicines with 5 days or fewer left (apps/api/app/stock.py): one line, opens Medicines to reorder. */
function RunningLow() {
  const { family } = useKin();
  const low = (family.parent.stock ?? []).filter((s) => s.low);
  if (!low.length) return null;
  const first = low[0];
  const text =
    first.left <= 0
      ? `${first.name} has run out`
      : `${first.name}: ${first.daysLeft === 0 ? "runs out today" : `${first.daysLeft} ${first.daysLeft === 1 ? "day" : "days"} left`}`;
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/medicines", params: { reorder: "1" } })}
      style={({ pressed }) => [glass, styles.lowLine, pressed && { opacity: 0.7 }]}>
      <View style={styles.lowDot} />
      <Text style={styles.lowText} numberOfLines={1}>
        {text}
        {low.length > 1 ? ` · +${low.length - 1} more` : ""}
      </Text>
      <Text style={styles.lowAction}>Reorder</Text>
    </Pressable>
  );
}

/** Groceries due this week (apps/api/app/groceries.py): one line, opens the order sheet. */
function GroceriesDue() {
  const { family } = useKin();
  const due = (family.parent.groceries ?? []).filter((g) => g.due);
  if (!due.length) return null;
  const names = due.slice(0, 3).map((g) => g.name).join(", ") + (due.length > 3 ? "…" : "");
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/groceries", params: { order: "1" } })}
      style={({ pressed }) => [glass, styles.lowLine, pressed && { opacity: 0.7 }]}
    >
      <View style={[styles.lowDot, { backgroundColor: color.watch }]} />
      <Text style={styles.lowText} numberOfLines={1}>
        Groceries due: {names}
      </Text>
      <Text style={styles.lowAction}>Order</Text>
    </Pressable>
  );
}

export default function Today() {
  const { family, mode } = useKin();
  const { parent } = family;
  const chores = useChores();
  const calls = family.calls.filter((c) => c.kind !== "reminder"); // evening calls; reminders live under Medicines
  const latest = calls[0];
  const call = calls.find((c) => c.status === "connected");
  const o = call?.outputs ?? {};
  const sleep = sleepOf(o);
  const pain = painStreak(calls);
  const week = calls.filter((c) => c.status === "connected").slice(0, 7).reverse();
  const good = week.filter((c) => c.signal === "green").length;
  const owner = family.members.find((m) => m.role === "Owner")?.name;
  const dateLine = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  // Per-medicine ticks when we know them (sample), else what the call said overall.
  const meds = family.medicines;
  const medsStat =
    meds.length && meds.every((m) => m.takenToday !== null)
      ? `${meds.filter((m) => m.takenToday).length}/${meds.length}`
      : o.meds_taken
        ? medsLabel[o.meds_taken].split(" ")[0]
        : "–";

  // A missed call newer than the last answered one is the news of the day.
  const headline = latest && latest.status !== "connected" ? latest.headline : (call?.headline ?? "No calls yet");
  const callTitle = call && formatDay(call.date) === "Today" ? "Tonight's call" : call ? `${formatDay(call.date)}'s call` : "";

  return (
    <Screen>
      <View style={styles.toolbar}>
        <ParentPill />
        <View style={[glass, styles.toolGroup]}>
          <Pressable accessibilityLabel="Alerts" onPress={() => router.push("/alert")} style={styles.toolBtn}>
            <Icon d={icon.bell} />
            {family.alert || chores.length ? <View style={styles.badge} /> : null}
          </Pressable>
          {call ? (
            <Pressable
              accessibilityLabel="Share the evening card"
              style={styles.toolBtn}
              onPress={() => shareCall(parent.name, call)}
            >
              <Icon d={icon.share} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.kicker}>
          {mode === "sample" ? "Sample · " : ""}
          {dateLine}
          {parent.city ? ` · ${parent.city}` : ""}
        </Text>
        <Text style={[display, styles.title]}>{headline}</Text>
      </View>

      <View style={[gutter, { marginTop: 14 }]}>
        <UrgentBanner />
        {parent.dailyCalls && parent.daily ? <DailyLine status={parent.daily} name={parent.name} /> : null}
        <FamilyMessages />

        {call?.insight ? <InsightCard insight={call.insight} kicker={`${callTitle} · what changed`} /> : null}
        {call ? null : <GetStarted />}

        <Card onPress={call ? () => router.push(`/calls/${call.id}`) : undefined} style={styles.heroCard}>
          {/* No call yet: a faded preview of what the card will show, with a note on top. */}
          <View style={[styles.hero, !call && styles.preview]}>
            <Rings
              size={118}
              stroke={13}
              rings={
                call
                  ? [
                      { value: o.meds_taken ? medsValue[o.meds_taken] : 0, color: metric.green, to: "#a6f36b" },
                      { value: sleep?.value ?? 0, color: metric.lilac, to: "#d9cdff" },
                      { value: o.mood ? moodValue[o.mood] : 0, color: metric.blue, to: "#8fb0ff" },
                    ]
                  : [
                      { value: 0.8, color: metric.green, to: "#a6f36b" },
                      { value: 0.65, color: metric.lilac, to: "#d9cdff" },
                      { value: 0.9, color: metric.blue, to: "#8fb0ff" },
                    ]
              }
            />
            <View style={{ flex: 1 }}>
              <Stat3 color={metric.green} value={call ? medsStat : "2/3"} label="Medicine" />
              <Stat3 color={metric.lilac} value={call ? (sleep?.label ?? "–") : "7 h"} label="Sleep" divider />
              <Stat3 color={metric.blue} value={call ? (o.mood ? moodLabel[o.mood] : "–") : "Good"} label="Mood" divider />
            </View>
          </View>
          {call ? null : (
            <View style={styles.previewNote} pointerEvents="none">
              <View style={[glass, styles.previewBox]}>
                <View style={styles.previewIcon}>
                  <TabIcon name="trends" on={false} color={metric.blue} size={17} />
                </View>
                <View>
                  <Text style={styles.cardTitleSm}>Not enough data yet</Text>
                  <Text style={styles.small}>Fills in after the first call</Text>
                </View>
              </View>
            </View>
          )}
        </Card>

        {call ? (
          <Card onPress={() => router.push(`/calls/${call.id}`)} style={styles.callCard}>
            <View style={styles.callHead}>
              <LinearGradient colors={["#3a3c45", color.charcoal]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.docIcon}>
                <Icon d={icon.transcript} size={20} width={2} color="#fff" />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{callTitle}</Text>
                <Text style={styles.small}>
                  {call.time} · {formatDuration(call.duration_s)} · {call.language}
                </Text>
              </View>
            </View>
            {call.summary ? (
              <Text numberOfLines={2} style={styles.callSummary}>
                {call.summary}
              </Text>
            ) : null}
            <View style={styles.callLink}>
              <Text style={styles.callLinkText}>Read the summary</Text>
              <Icon d={icon.chevron} size={14} width={2.4} color={color.faint} />
            </View>
          </Card>
        ) : (
          <Card style={styles.callCard}>
            <View style={styles.callHead}>
              <View style={[styles.docIcon, styles.docIconEmpty]}>
                <Icon d={icon.transcript} size={20} width={2} color={color.faint} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>No call summary yet</Text>
                <Text style={styles.small}>
                  {parent.dailyCalls ? `First daily call at ${parent.callTime}` : "Waiting for the first call"}
                </Text>
              </View>
            </View>
            <View style={{ gap: 7 }}>
              <View style={[styles.skeleton, { width: "92%" }]} />
              <View style={[styles.skeleton, { width: "64%" }]} />
            </View>
            <Text style={styles.callSummary}>After each call, Kin writes a short summary of how {parent.name} is.</Text>
          </Card>
        )}

        {call && (o.pain_mentioned || o.wants_family_callback) ? (
          <View style={styles.tiles}>
            {o.pain_mentioned ? (
              <Pressable onPress={() => router.push(family.alert ? "/alert" : `/calls/${call.id}`)} style={styles.tilePress}>
                <LinearGradient
                  colors={["rgba(255,236,190,0.9)", "rgba(255,255,255,0.5)"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[glass, styles.tile]}
                >
                  <Ring value={Math.min(1, pain / 5)} color={metric.gold} size={36} stroke={4.5} fontSize={11}>
                    {`${pain}d`}
                  </Ring>
                  <View>
                    <Text style={[styles.tileKicker, { color: color.watch }]}>Watch</Text>
                    <Text style={styles.tileText}>
                      {family.source === "sample" ? "Knee pain, a little worse" : o.pain_location ? `Pain: ${o.pain_location}` : "Mentioned pain"}
                    </Text>
                  </View>
                </LinearGradient>
              </Pressable>
            ) : null}
            {o.wants_family_callback ? (
              <Pressable onPress={() => router.push("/call")} style={styles.tilePress}>
                <View style={[glass, styles.tile]}>
                  <LinearGradient colors={["#c9bcff", "#ffc6b5"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.quote}>
                    <Text style={styles.quoteMark}>&ldquo;</Text>
                  </LinearGradient>
                  <View>
                    <Text style={styles.tileKicker}>{family.source === "sample" ? "She asked" : `${parent.name} asked`}</Text>
                    <Text style={styles.tileText}>{family.source === "sample" ? `Can ${owner} call on Sunday?` : "For the family to call back"}</Text>
                  </View>
                </View>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {family.nextTopic ? (
          <Pressable onPress={() => router.push("/memory")} style={({ pressed }) => [glass, styles.thread, pressed && { opacity: 0.7 }]}>
            <LinearGradient colors={["#8fb0ff", metric.blue]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.threadIcon}>
              <Icon d={icon.bulb} size={17} color="#fff" />
            </LinearGradient>
            <Text numberOfLines={1} style={styles.threadText}>
              <Text style={{ color: color.body }}>Next call Kin asks </Text>
              <Text style={{ fontWeight: "600" }}>{family.nextTopic}</Text>
            </Text>
          </Pressable>
        ) : null}

        {week.length ? (
          <Card onPress={() => router.push("/trends")} style={{ paddingVertical: 12 }}>
            <View style={styles.between}>
              <Text style={styles.cardTitle}>This week</Text>
              <Text style={styles.sub}>
                {good} of {week.length} good {week.length === 1 ? "day" : "days"}
              </Text>
            </View>
            <View style={[styles.week, week.length < 7 && styles.weekShort]}>
              {week.map((c, i) => {
                const ok = c.signal === "green";
                const last = i === week.length - 1;
                const tint = ok ? metric.green : c.signal === "red" ? color.alert : metric.gold;
                return (
                  <View key={c.id} style={{ alignItems: "center", gap: 6 }}>
                    <View style={[styles.dayRing, last && styles.dayRingOn]}>
                      <View style={[styles.day, { backgroundColor: tint, shadowColor: tint }]}>
                        {ok ? (
                          <Svg width={13} height={13} viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round">
                            <Path d="m2.5 6.3 2.3 2.2 4.7-5" />
                          </Svg>
                        ) : (
                          <Text style={styles.bang}>!</Text>
                        )}
                      </View>
                    </View>
                    <Text style={[styles.dayLabel, last && { color: color.ink }]}>
                      {new Date(c.date + "T12:00:00").toLocaleDateString("en-IN", { weekday: "narrow" })}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Card>
        ) : (
          <Card style={{ paddingVertical: 12 }}>
            <View style={styles.between}>
              <Text style={styles.cardTitle}>This week</Text>
              <Text style={styles.sub}>Not enough calls yet</Text>
            </View>
            <View style={styles.week}>
              {lastWeek().map((d, i, all) => (
                <View key={d.key} style={{ alignItems: "center", gap: 6 }}>
                  <View style={[styles.dayRing, i === all.length - 1 && styles.dayRingOn]}>
                    <View style={styles.dayEmpty} />
                  </View>
                  <Text style={[styles.dayLabel, i === all.length - 1 && { color: color.ink }]}>{d.label}</Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        <RunningLow />
        <GroceriesDue />
        <KinCallCard />

        {mode === "sample" ? <SampleNote /> : null}
      </View>
    </Screen>
  );
}

/** The last 7 days (today last) as narrow weekday letters, in India time. */
function lastWeek() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86_400_000);
    return { key: istDate(d), label: d.toLocaleDateString("en-IN", { weekday: "narrow", timeZone: "Asia/Kolkata" }) };
  });
}

/** New family: what to do before Kin's first daily call, ticked off as it happens. */
function GetStarted() {
  const { family } = useKin();
  const { parent } = family;
  const steps = [
    {
      done: Boolean(parent.consentAt),
      title: `Introduce Kin to ${parent.name}`,
      sub: "A short call, so they know Kin",
      to: "/introduce",
      icon: icon.phone,
      tint: ["#c9bcff", metric.lilac],
    },
    { done: parent.dailyCalls, title: "Turn on daily calls", sub: `Pick a time that suits ${parent.name}`, to: "/parent", icon: icon.bell, tint: ["#8fb0ff", metric.blue] },
    { done: family.medicines.length > 0, title: "Add medicines", sub: "Kin asks about each one by name", to: "/medicines", icon: icon.pill, tint: ["#ffc6b5", metric.coral] },
  ] as const;
  const done = steps.filter((x) => x.done).length;
  const next = steps.findIndex((x) => !x.done);
  return (
    <Card style={styles.setup}>
      <View style={styles.setupHead}>
        <Ring value={done / steps.length} color={metric.green} size={52} stroke={6} fontSize={13}>
          {`${done}/${steps.length}`}
        </Ring>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.setupTitle}>Set up Kin for {parent.name}</Text>
          <Text style={styles.sub}>{done === steps.length ? "All set for the first daily call" : "A few steps before the first daily call"}</Text>
        </View>
      </View>
      <View style={styles.steps}>
        {steps.map((x, i) => (
          <Pressable
            key={x.title}
            onPress={() => router.push(x.to)}
            style={({ pressed }) => [styles.step, i === next && styles.stepNext, pressed && { opacity: 0.7 }]}
          >
            <LinearGradient
              colors={x.done ? ["#4ade1a", color.ok] : [...x.tint]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.stepIcon, !x.done && i !== next && { opacity: 0.55 }]}
            >
              {x.done ? (
                <Svg width={14} height={14} viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round">
                  <Path d="m2.5 6.3 2.3 2.2 4.7-5" />
                </Svg>
              ) : (
                <Icon d={x.icon} size={17} color="#fff" />
              )}
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={[styles.stepTitle, x.done && { color: color.body }]}>{x.title}</Text>
              <Text style={styles.sub} numberOfLines={1}>
                {x.done ? "Done" : x.sub}
              </Text>
            </View>
            {i === next ? (
              <View style={styles.startPill}>
                <Text style={styles.startText}>Start</Text>
              </View>
            ) : (
              <Icon d={icon.chevron} size={14} width={2.4} color={color.faint} />
            )}
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

/** "today 7:30 pm" / "tomorrow 7:30 pm" in India time. */
function when(iso: string) {
  const d = new Date(iso);
  const day = istDate(d) === istDate() ? "today" : istDate(d) === istDate(new Date(Date.now() + 86_400_000)) ? "tomorrow" : formatDay(istDate(d));
  return `${day} ${istTime(d)}`;
}

/** Tonight's daily call, from the scheduler: next call, ringing, retrying, or how it went. */
function DailyLine({ status, name }: { status: DailyStatus; name: string }) {
  const next = status.next ? ` Next call ${when(status.next)}.` : "";
  const [tone, text] = (() => {
    switch (status.state) {
      case "scheduled":
        return ["plain", status.at ? `Next call ${when(status.at)}` : "Next call today"] as const;
      case "calling":
        return ["live", `Kin is calling ${name} now${status.tries && status.tries > 1 ? ` (try ${status.tries} of 3)` : ""}`] as const;
      case "retrying":
        return ["watch", status.at ? `No answer yet. Kin tries again at ${istTime(new Date(status.at))}` : "No answer yet. Kin will try again in 20 minutes"] as const;
      case "answered":
        return ["ok", `Kin spoke with ${name} today.${next}`] as const;
      case "missed":
        return ["alert", `${name} didn't answer tonight after 3 tries.${next}`] as const;
      case "failed":
        return ["alert", `Tonight's call couldn't be placed.${next}`] as const;
    }
  })();
  const dot = { plain: color.faint, live: metric.green, watch: metric.gold, ok: metric.green, alert: color.alert }[tone];
  return (
    <Pressable onPress={() => router.push("/parent")} style={({ pressed }) => [glass, styles.daily, pressed && { opacity: 0.7 }]}>
      <View style={[styles.dailyDot, { backgroundColor: dot }]} />
      <Text style={styles.dailyText}>{text}</Text>
    </Pressable>
  );
}

function SampleNote() {
  return (
    <Pressable onPress={() => router.push("/settings")} style={({ pressed }) => [glass, styles.sampleNote, pressed && { opacity: 0.7 }]}>
      <Text style={styles.sub}>You are looking at a sample family.</Text>
      <Text style={styles.cardTitleSm}>Sign in</Text>
    </Pressable>
  );
}

function Stat3({ color: c, value, label, divider }: { color: string; value: string; label: string; divider?: boolean }) {
  return (
    <View style={[styles.stat, divider && styles.statDivider]}>
      <View style={styles.statLabel}>
        <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: c }} />
        <Text style={styles.statText}>{label}</Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  lowLine: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 16 },
  lowDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: color.alert },
  lowText: { flex: 1, fontSize: 15, fontWeight: "600", color: color.ink },
  lowAction: { fontSize: 15, fontWeight: "600", color: metric.blue },
  toolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, minHeight: 46 },
  toolGroup: { flexDirection: "row", borderRadius: 999, padding: 2, gap: 2 },
  toolBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: 9, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: metric.coral, borderWidth: 2, borderColor: "#fff" },
  titleBlock: { paddingHorizontal: 22, paddingTop: 8 },
  kicker: { fontSize: 14, fontWeight: "500", color: color.body },
  title: { fontSize: 36, lineHeight: 40, marginTop: 4, letterSpacing: -1.5 },
  heroCard: { paddingVertical: 14 },
  hero: { flexDirection: "row", alignItems: "center", gap: 16 },
  preview: { opacity: 0.3 },
  previewNote: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", padding: 20 },
  previewBox: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 999, paddingVertical: 7, paddingLeft: 7, paddingRight: 16, backgroundColor: "rgba(255,255,255,0.9)" },
  previewIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: `${metric.blue}1a` },
  stat: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 9 },
  statDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(34,35,38,0.12)" },
  statLabel: { flexDirection: "row", alignItems: "center", gap: 7 },
  statText: { fontSize: 15, fontWeight: "500", color: color.body },
  statValue: { fontSize: 20, fontWeight: "600", letterSpacing: -0.6, color: color.ink },
  callCard: { gap: 12, padding: 14 },
  callHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  docIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1f2025",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  docIconEmpty: { backgroundColor: "rgba(34,35,38,0.06)", shadowOpacity: 0, elevation: 0 },
  skeleton: { height: 9, borderRadius: 5, backgroundColor: "rgba(34,35,38,0.07)" },
  dayEmpty: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderStyle: "dashed", borderColor: "rgba(34,35,38,0.18)" },
  setup: { gap: 14, padding: 16 },
  setupHead: { flexDirection: "row", alignItems: "center", gap: 14 },
  setupTitle: { fontSize: 17, fontWeight: "600", letterSpacing: -0.3, color: color.ink },
  steps: { gap: 6 },
  step: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 18, paddingVertical: 9, paddingHorizontal: 10 },
  stepNext: { backgroundColor: "rgba(255,255,255,0.75)", shadowColor: "#28326e", shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  stepIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  stepTitle: { fontSize: 15, fontWeight: "600", color: color.ink },
  startPill: { height: 30, borderRadius: 15, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", backgroundColor: color.charcoal },
  startText: { fontSize: 13, fontWeight: "600", color: "#fff" },
  callSummary: { fontSize: 14, lineHeight: 20, color: color.body },
  callLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(34,35,38,0.12)",
  },
  callLinkText: { fontSize: 13, fontWeight: "600", color: color.ink },
  between: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  week: { marginTop: 10, flexDirection: "row", justifyContent: "space-between" },
  weekShort: { justifyContent: "flex-start", gap: 12 },
  cardTitle: { fontSize: 15, fontWeight: "600", color: color.ink },
  cardTitleSm: { fontSize: 14, fontWeight: "600", color: color.ink },
  small: { fontSize: 12, fontWeight: "500", color: color.body, fontVariant: ["tabular-nums"] },
  sub: { fontSize: 13, lineHeight: 18, color: color.body },
  tiles: { flexDirection: "row", gap: 8 },
  tilePress: { flex: 1 },
  tile: { flex: 1, borderRadius: 24, padding: 14, gap: 10 },
  tileKicker: { fontSize: 12, fontWeight: "600", letterSpacing: 0.5, textTransform: "uppercase", color: color.body },
  tileText: { marginTop: 2, fontSize: 16, lineHeight: 18.5, fontWeight: "600", color: color.ink },
  quote: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  quoteMark: { fontSize: 24, lineHeight: 30, fontWeight: "600", color: "#fff" },
  thread: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 999, paddingVertical: 6, paddingLeft: 6, paddingRight: 14 },
  threadIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  threadText: { flex: 1, fontSize: 14, color: color.ink },
  dayRing: { padding: 2, borderRadius: 21, borderWidth: 2, borderColor: "transparent" },
  dayRingOn: { borderColor: "rgba(34,35,38,0.8)" },
  day: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", shadowOpacity: 0.5, shadowRadius: 5, shadowOffset: { width: 0, height: 4 } },
  bang: { fontSize: 14, fontWeight: "700", color: "#fff" },
  dayLabel: { fontSize: 12, fontWeight: "600", color: color.body },
  daily: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 999, paddingVertical: 11, paddingHorizontal: 16 },
  dailyDot: { width: 8, height: 8, borderRadius: 4 },
  dailyText: { flex: 1, fontSize: 14, lineHeight: 19, fontWeight: "500", color: color.ink },
  sampleNote: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 999, paddingVertical: 12, paddingHorizontal: 16 },
});
