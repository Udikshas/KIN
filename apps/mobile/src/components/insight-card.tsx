import { Share, StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/kit";
import { formatDay, type Call, type Insight, type TrendNote } from "@/lib/data";
import { color, metric } from "@/lib/theme";

// What changed (apps/api/app/insights.py): each call against the parent's own usual,
// and one thing the family could do. Every line comes from a number in the calls.

export function InsightCard({ insight, kicker = "What changed" }: { insight: Insight; kicker?: string }) {
  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <View style={styles.dot} />
        <Text style={styles.kicker}>{kicker}</Text>
      </View>
      <Text style={styles.headline}>{insight.headline}</Text>
      {insight.changes.map((c) => (
        <View key={c} style={styles.row}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.point}>{c}</Text>
        </View>
      ))}
      {insight.suggestion ? (
        <View style={styles.suggest}>
          <Text style={styles.suggestLabel}>Try this</Text>
          <Text style={styles.suggestText}>{insight.suggestion}</Text>
        </View>
      ) : null}
    </Card>
  );
}

export function TrendNoteCard({ note }: { note: TrendNote }) {
  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <View style={styles.dot} />
        <Text style={styles.kicker}>Kin noticed · last {note.calls} calls</Text>
      </View>
      <Text style={styles.summary}>{note.summary}</Text>
      {note.points.map((p) => (
        <View key={p} style={styles.row}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.point}>{p}</Text>
        </View>
      ))}
      {note.watch ? (
        <View style={styles.suggest}>
          <Text style={styles.suggestLabel}>Keep an eye on</Text>
          <Text style={styles.suggestText}>{note.watch}</Text>
        </View>
      ) : null}
    </Card>
  );
}

/** The evening card as plain text, for the family WhatsApp group (or anywhere the share sheet goes). */
export function shareCall(name: string, call: Call) {
  const i = call.insight;
  const lines = [
    `${name} · ${formatDay(call.date)}, ${call.time}`,
    i ? i.headline : `${call.headline}. ${call.summary}`,
    ...(i?.changes.map((c) => `• ${c}`) ?? []),
    i?.suggestion ? `Try this: ${i.suggestion}` : "",
    "— from Kin",
  ];
  return Share.share({ message: lines.filter(Boolean).join("\n") });
}

const styles = StyleSheet.create({
  card: { gap: 8 },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: metric.lilac },
  kicker: { fontSize: 12, fontWeight: "600", letterSpacing: 0.4, textTransform: "uppercase", color: color.body },
  headline: { fontSize: 18, lineHeight: 24, fontWeight: "600", letterSpacing: -0.3, color: color.ink },
  summary: { fontSize: 16, lineHeight: 22, fontWeight: "500", color: color.ink },
  row: { flexDirection: "row", gap: 8, paddingRight: 8 },
  bullet: { fontSize: 15, lineHeight: 21, color: metric.lilac, fontWeight: "700" },
  point: { flex: 1, fontSize: 15, lineHeight: 21, color: color.ink },
  suggest: { marginTop: 4, borderRadius: 16, padding: 12, gap: 2, backgroundColor: `${metric.lilac}1f` },
  suggestLabel: { fontSize: 12, fontWeight: "600", letterSpacing: 0.4, textTransform: "uppercase", color: metric.lilac },
  suggestText: { fontSize: 15, lineHeight: 21, color: color.ink },
});
