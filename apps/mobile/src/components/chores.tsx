import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card, Icon, icon, SectionLabel } from "@/components/kit";
import { useKin } from "@/lib/kin";
import { color } from "@/lib/theme";

type Chore = { key: string; dot: string; title: string; action: string; go: () => void };

/** Things to do for the parent's home, not emergencies: medicines running low, groceries due. */
export function useChores(): Chore[] {
  const { family } = useKin();
  const out: Chore[] = [];
  const low = (family.parent.stock ?? []).filter((s) => s.low);
  if (low.length) {
    const first = low[0];
    const text =
      first.left <= 0
        ? `${first.name} has run out`
        : `${first.name}: ${first.daysLeft === 0 ? "runs out today" : `${first.daysLeft} ${first.daysLeft === 1 ? "day" : "days"} left`}`;
    out.push({
      key: "stock",
      dot: color.alert,
      title: text + (low.length > 1 ? ` · +${low.length - 1} more` : ""),
      action: "Reorder",
      go: () => router.push({ pathname: "/medicines", params: { reorder: "1" } }),
    });
  }
  const due = (family.parent.groceries ?? []).filter((g) => g.due);
  if (due.length) {
    out.push({
      key: "groceries",
      dot: color.watch,
      title: `Groceries due: ${due.slice(0, 3).map((g) => g.name).join(", ")}${due.length > 3 ? "…" : ""}`,
      action: "Order",
      go: () => router.push({ pathname: "/groceries", params: { order: "1" } }),
    });
  }
  return out;
}

/** "To do" card for the Alerts sheet. */
export function ChoreList({ onBefore }: { onBefore?: () => void }) {
  const chores = useChores();
  if (!chores.length) return null;
  return (
    <Card style={{ gap: 2 }}>
      <SectionLabel>To do</SectionLabel>
      {chores.map((c, i) => (
        <Pressable
          key={c.key}
          onPress={() => {
            onBefore?.();
            c.go();
          }}
          style={({ pressed }) => [styles.row, i > 0 && styles.line, pressed && { opacity: 0.6 }]}
        >
          <View style={[styles.dot, { backgroundColor: c.dot }]} />
          <Text style={styles.text} numberOfLines={1}>
            {c.title}
          </Text>
          <Text style={styles.action}>{c.action}</Text>
          <Icon d={icon.chevron} size={13} width={2.4} color={color.faint} />
        </Pressable>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11 },
  line: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(34,35,38,0.12)" },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { flex: 1, fontSize: 15, color: color.ink },
  action: { fontSize: 14, fontWeight: "600", color: color.ink },
});
