import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card, Icon, icon, Pill, SectionLabel } from "@/components/kit";
import { gutter, Header, Screen } from "@/components/screen";
import { formatDay, formatDuration, signalLabel, signalTone } from "@/lib/data";
import { useKin } from "@/lib/kin";
import { color } from "@/lib/theme";

export default function Calls() {
  const { family } = useKin();
  const { parent } = family;
  return (
    <Screen>
      <Header kicker={parent.dailyCalls ? `Every day at ${parent.callTime}` : "Daily calls are off"} title="Calls" />
      <View style={gutter}>
        <Pressable onPress={() => router.push("/memory")}>
          <LinearGradient colors={["rgba(31,32,37,0.94)", "rgba(65,70,110,0.85)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.next}>
            <Text style={styles.nextLabel}>{family.source === "sample" ? "Tonight Kin will ask" : "On the next call"}</Text>
            <Text style={styles.nextText}>
              {family.source === "sample" ? `“${family.nextQuestion}”` : (family.nextQuestion ?? `Kin asks how ${parent.name} slept, about pain, mood and medicine, and picks up one thing from earlier calls.`)}
            </Text>
            <View style={styles.nextLink}>
              <Text style={styles.nextLinkText}>What Kin remembers</Text>
              <Icon d={icon.chevron} size={14} color="rgba(255,255,255,0.7)" />
            </View>
          </LinearGradient>
        </Pressable>

        <View style={styles.section}>
          <SectionLabel>Recent calls</SectionLabel>
        </View>
        {family.calls.length === 0 ? (
          <Card>
            <Text style={styles.summary}>No calls yet. Each call shows here a few seconds after it ends.</Text>
          </Card>
        ) : null}
        {family.calls.slice(0, 60).map((c) => {
          const answered = c.status === "connected";
          return (
            <Card key={c.id} onPress={() => router.push(`/calls/${c.id}`)} style={styles.row}>
              <View style={{ flex: 1, gap: 3 }}>
                <View style={styles.between}>
                  <Text style={styles.when}>
                    {formatDay(c.date)} · {c.time}
                  </Text>
                  <Text style={styles.meta}>{answered ? `${formatDuration(c.duration_s)} · ${c.language}` : "No answer"}</Text>
                </View>
                <Text style={styles.headline}>{c.headline}</Text>
                <Text numberOfLines={2} style={styles.summary}>
                  {c.summary}
                </Text>
                {c.signal ? (
                  <View style={{ marginTop: 6 }}>
                    <Pill tone={signalTone[c.signal]}>{signalLabel[c.signal]}</Pill>
                  </View>
                ) : null}
              </View>
              <Icon d={icon.chevron} size={16} color={color.faint} />
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  next: { borderRadius: 28, padding: 16 },
  nextLabel: { fontSize: 13, fontWeight: "600", letterSpacing: 0.5, textTransform: "uppercase", color: "rgba(255,255,255,0.5)" },
  nextText: { marginTop: 6, fontSize: 17, lineHeight: 23, color: "#fff" },
  nextLink: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 4 },
  nextLinkText: { fontSize: 14, fontWeight: "600", color: "rgba(255,255,255,0.75)" },
  section: { paddingHorizontal: 6, paddingTop: 10, paddingBottom: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  when: { fontSize: 13, fontWeight: "600", color: color.body },
  meta: { fontSize: 12, color: color.body, fontVariant: ["tabular-nums"] },
  headline: { fontSize: 17, fontWeight: "600", color: color.ink, letterSpacing: -0.3 },
  summary: { fontSize: 14, lineHeight: 19, color: color.body },
});
