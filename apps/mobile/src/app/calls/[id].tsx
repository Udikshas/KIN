import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { InsightCard, shareCall } from "@/components/insight-card";
import { Card, Icon, Pill, SectionLabel } from "@/components/kit";
import { gutter, Screen, SubHeader } from "@/components/screen";
import { api, toCall } from "@/lib/api";
import { formatDay, formatDuration, medsLabel, moodLabel, signalLabel, signalTone, sleepOf, type Call } from "@/lib/data";
import { useKin } from "@/lib/kin";
import { speakParts, stopSpeaking, type Part } from "@/lib/speech";
import { color, glass, metric } from "@/lib/theme";

const speakerIcon = "M4 9.5h3.5L12 5.5v13l-4.5-4H4zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11";
const stopIcon = "M7 7h10v10H7z";

const failure: Record<string, string> = {
  no_answer: "Kin tries again after 20 minutes, up to two times.",
  busy: "The line was busy. Kin tries again after 20 minutes.",
};

export default function CallDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { family } = useKin();
  const listed = family.calls.find((c) => c.id === id);
  // Kin keeps only the summary and results, never a transcript. A call that isn't in the
  // parent's list (one Kin made to a family member) is fetched on its own.
  const [fetched, setFetched] = useState<Call | null>(null);
  const [loadError, setLoadError] = useState("");
  const call = fetched ?? listed;

  // Read the summary aloud with the phone's own voice (lib/speech.ts).
  const [reading, setReading] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);
  useEffect(() => stopSpeaking, []); // leaving the screen stops it
  const read = useCallback((parts: Part[]) => {
    if (stopRef.current) {
      stopRef.current();
      return; // the button was Stop
    }
    setReading(true);
    stopRef.current = speakParts(
      parts,
      () => {},
      () => {
        stopRef.current = null;
        setReading(false);
      },
    );
  }, []);

  useEffect(() => {
    if (family.source !== "api" || listed) return;
    let live = true;
    api
      .call(id)
      .then((c) => live && setFetched(toCall(c, family.parent.language)))
      .catch((e) => live && setLoadError(e instanceof Error ? e.message : "Could not load the call."));
    return () => {
      live = false;
    };
  }, [id, listed, family.source, family.parent.language]);

  if (!call) {
    return (
      <Screen tabs={false}>
        {loadError || family.source !== "api" ? <SubHeader title="Call not found" /> : <ActivityIndicator style={{ marginTop: 80 }} color={color.ink} />}
      </Screen>
    );
  }
  // Who Kin talked to: the parent, or the family member Kin was asked to call.
  const speaker =
    call.phone && call.phone !== family.parent.phone
      ? (family.members.find((m) => m.phone === call.phone)?.name ?? "Them")
      : family.parent.name;
  const o = call.outputs;
  const sleep = sleepOf(o);
  const summaryParts = (): Part[] => {
    const i = call.insight;
    const changed = i && (i.changes.length || i.suggestion) ? ` What changed: ${[...i.changes, i.suggestion].filter(Boolean).join(". ")}.` : "";
    return [{ text: `${speaker}'s call, ${formatDay(call.date)}, ${call.time}. ${call.summary}${changed}`, language: "en-IN" }];
  };
  const rows =
    call.status === "connected"
      ? [
          o.meds_taken && { c: metric.green, label: "Medicine", value: medsLabel[o.meds_taken] },
          sleep && { c: metric.lilac, label: "Sleep", value: sleep.label },
          o.mood && { c: metric.blue, label: "Mood", value: moodLabel[o.mood] },
          o.pain_mentioned != null && { c: metric.gold, label: "Pain", value: o.pain_mentioned ? (o.pain_location ?? "Yes") : "None" },
          o.wants_family_callback != null && { c: metric.coral, label: "Wants a call back", value: o.wants_family_callback ? "Yes" : "No" },
          o.concerns && { c: color.alert, label: "Concerns", value: o.concerns },
        ].filter((r): r is { c: string; label: string; value: string } => !!r)
      : [];

  return (
    <Screen tabs={false}>
      <SubHeader
        kicker={`${speaker !== family.parent.name ? `${speaker} · ` : ""}${formatDay(call.date)} · ${call.time}${call.direction === "inbound" ? " · they called Kin" : ""}`}
        title={call.headline}
      />
      <View style={gutter}>
        <Card style={{ gap: 10 }}>
          <View style={styles.between}>
            {call.signal ? <Pill tone={signalTone[call.signal]}>{signalLabel[call.signal]}</Pill> : <Pill tone="plain">{call.headline}</Pill>}
            <Text style={styles.meta}>{call.status === "connected" ? `${formatDuration(call.duration_s)} · ${call.language}` : ""}</Text>
          </View>
          <Text style={styles.body}>{call.summary}</Text>
          {call.status === "connected" ? (
            <View style={styles.actions}>
              <ListenButton on={reading} onPress={() => read(summaryParts())} />
              <Pressable accessibilityRole="button" onPress={() => shareCall(speaker, call)} style={[glass, styles.share]}>
                <Text style={styles.toggleText}>Share with the family</Text>
              </Pressable>
            </View>
          ) : null}
        </Card>

        {call.insight ? <InsightCard insight={call.insight} /> : null}

        {rows.length ? (
          <Card style={{ gap: 12 }}>
            {rows.map((r) => (
              <View key={r.label} style={styles.evidence}>
                <View style={[styles.bar, { backgroundColor: r.c }]} />
                <Text style={styles.label}>{r.label}</Text>
                <Text style={styles.value} numberOfLines={2}>
                  {r.value}
                </Text>
              </View>
            ))}
          </Card>
        ) : null}

        <Text style={[styles.meta, { paddingHorizontal: 6 }]}>
          {call.status === "connected"
            ? "Kin keeps this summary, not a recording or a transcript of the call."
            : (failure[call.status] ?? "Kin will try again at the next call time.")}
        </Text>
      </View>
    </Screen>
  );
}

/** Listen / Stop: reads aloud with the phone's voice; tap again to stop. */
function ListenButton({ on, onPress }: { on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={on ? "Stop reading" : "Read the summary aloud"}
      onPress={onPress}
      style={({ pressed }) => [glass, styles.listen, on && styles.listenOn, pressed && { opacity: 0.7 }]}
    >
      <Icon d={on ? stopIcon : speakerIcon} size={15} color={on ? "#fff" : color.ink} />
      <Text style={[styles.toggleText, on && { color: "#fff" }]}>{on ? "Stop" : "Listen"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  listen: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  listenOn: { backgroundColor: color.charcoal },
  share: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  meta: { fontSize: 13, lineHeight: 18, color: color.body },
  body: { fontSize: 16, lineHeight: 22, color: color.ink },
  evidence: { flexDirection: "row", alignItems: "center", gap: 10 },
  bar: { width: 4, height: 22, borderRadius: 2 },
  label: { fontSize: 15, color: color.body },
  value: { marginLeft: "auto", flexShrink: 1, textAlign: "right", fontSize: 15, fontWeight: "600", color: color.ink },
  toggleText: { fontSize: 13, fontWeight: "600", color: color.ink },
});
