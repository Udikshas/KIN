import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/kit";
import { formatDay, type MedicineDayState, type MedicineHistory } from "@/lib/data";
import { color, metric } from "@/lib/theme";

// The last 30 days of medicines (apps/api/app/reminders.py history): reminder call
// results plus what evening calls said, the current run of days with everything
// taken, and a calendar. Each state has a mark as well as a colour.

const look: Record<MedicineDayState, { bg: string; fg: string; mark: string; label: string }> = {
  taken: { bg: color.ok, fg: "#fff", mark: "✓", label: "All taken" },
  partly: { bg: color.watchSoft, fg: color.watch, mark: "½", label: "Some doses unanswered" },
  not_taken: { bg: color.alert, fg: "#fff", mark: "✕", label: "Not taken" },
  no_answer: { bg: color.watchSoft, fg: color.watch, mark: "–", label: "No answer" },
  unclear: { bg: "rgba(34,35,38,0.08)", fg: color.body, mark: "?", label: "Not sure" },
};
const result: Record<string, string> = { taken: "taken", not_taken: "not taken", no_answer: "no answer", unclear: "not sure" };
const WEEK = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export function MedicineCalendar({ history, name }: { history: MedicineHistory; name: string }) {
  const [picked, setPicked] = useState<number | null>(null);
  const { days, streak, best, takenDays, knownDays } = history;
  if (!knownDays) return null;

  // Monday-first weeks: blank cells before the first day.
  const first = new Date(days[0].day + "T12:00:00");
  const lead = (first.getDay() + 6) % 7;
  const cells: (number | null)[] = [...Array<null>(lead).fill(null), ...days.map((_, i) => i)];
  // Explicit rows of 7 (Mon..Sun): percentage widths with wrapping can round to 6 a row on iOS.
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
  const sel = picked === null ? null : days[picked];

  return (
    <Card style={{ gap: 14 }}>
      <View style={styles.top}>
        <View style={styles.flame}>
          <Text style={styles.flameNum}>{streak}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>
            {streak ? `${streak} ${streak === 1 ? "day" : "days"} in a row` : "No run yet"}
          </Text>
          <Text style={styles.sub}>
            {streak
              ? `${name} has taken every dose ${streak === 1 ? "today" : `for ${streak} days`}. Best run: ${best}.`
              : `Every day ${name} takes all their medicines adds to the run. Best so far: ${best}.`}
          </Text>
        </View>
      </View>

      <View>
        <View style={styles.row}>
          {WEEK.map((d, i) => (
            <View key={i} style={styles.weekdayCell}>
              <Text style={styles.weekday}>{d}</Text>
            </View>
          ))}
        </View>
        {weeks.map((week, w) => (
          <View key={w} style={styles.row}>
            {week.map((i, k) => {
              if (i === null) return <View key={`b${k}`} style={styles.cell} />;
              const d = days[i];
              const l = d.state ? look[d.state] : null;
              const today = i === days.length - 1;
              return (
                <View key={d.day} style={styles.cell}>
                  <Pressable
                    onPress={() => setPicked(picked === i ? null : i)}
                    accessibilityRole="button"
                    accessibilityLabel={`${formatDay(d.day)}: ${l ? l.label : "no result"}`}
                    style={[
                      styles.day,
                      { backgroundColor: l ? l.bg : "transparent" },
                      !l && styles.empty,
                      today && styles.today,
                      picked === i && styles.picked,
                    ]}
                  >
                    <Text style={[styles.dayText, { color: l ? l.fg : color.faint }]}>{Number(d.day.slice(8))}</Text>
                    {l ? <Text style={[styles.mark, { color: l.fg }]}>{l.mark}</Text> : null}
                  </Pressable>
                </View>
              );
            })}
          </View>
        ))}
      </View>

      {sel ? (
        <View style={styles.detail}>
          <Text style={styles.detailTitle}>{formatDay(sel.day)}</Text>
          {sel.items.length ? (
            sel.items.map((x, k) => (
              <Text key={k} style={styles.sub}>
                {x.what}: {result[x.result] ?? x.result}
              </Text>
            ))
          ) : (
            <Text style={styles.sub}>No medicine result this day.</Text>
          )}
        </View>
      ) : null}

      <View style={styles.legend}>
        {(["taken", "not_taken", "no_answer", "partly"] as const).map((s) => (
          <View key={s} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: look[s].bg }]}>
              <Text style={[styles.legendMark, { color: look[s].fg }]}>{look[s].mark}</Text>
            </View>
            <Text style={styles.legendText}>{look[s].label}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.foot}>
        All taken on {takenDays} of {knownDays} {knownDays === 1 ? "day" : "days"} with a result · tap a day for details
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", gap: 12 },
  flame: { width: 58, height: 58, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: `${metric.green}26` },
  flameNum: { fontSize: 24, fontWeight: "700", letterSpacing: -0.5, color: color.ok },
  title: { fontSize: 18, fontWeight: "600", letterSpacing: -0.3, color: color.ink },
  sub: { fontSize: 13, lineHeight: 18, color: color.body },
  row: { flexDirection: "row" },
  weekdayCell: { flex: 1, alignItems: "center", marginBottom: 4 },
  weekday: { fontSize: 11, fontWeight: "600", color: color.faint },
  cell: { flex: 1, aspectRatio: 1, padding: 3 },
  day: { flex: 1, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  empty: { borderWidth: 1, borderColor: color.line },
  today: { borderWidth: 2, borderColor: color.ink },
  picked: { transform: [{ scale: 1.08 }] },
  dayText: { fontSize: 14, fontWeight: "700" },
  mark: { position: "absolute", top: 3, right: 5, fontSize: 9, fontWeight: "700" },
  detail: { borderRadius: 14, padding: 12, gap: 2, backgroundColor: "rgba(235,240,248,0.8)" },
  detailTitle: { fontSize: 14, fontWeight: "600", color: color.ink },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 16, height: 16, borderRadius: 5, alignItems: "center", justifyContent: "center" },
  legendMark: { fontSize: 10, fontWeight: "700" },
  legendText: { fontSize: 12, color: color.body },
  foot: { fontSize: 12, color: color.faint },
});
