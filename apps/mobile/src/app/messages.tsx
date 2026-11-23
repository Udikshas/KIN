import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Compose, when } from "@/components/family-messages";
import { Card } from "@/components/kit";
import { Screen, SubHeader } from "@/components/screen";
import type { FamilyMessage } from "@/lib/data";
import { useKin } from "@/lib/kin";
import { color, metric } from "@/lib/theme";

// Every "tell my family" message, both ways, newest first (the API keeps the last 50).
// Today shows only the parent's open messages; this is the whole conversation.

function status(m: FamilyMessage, name: string) {
  if (m.direction === "from_parent") return m.done ? `Done${m.doneBy ? ` · ${m.doneBy}` : ""}` : "Open";
  return m.delivered ? `Kin told ${name}` : "Kin will pass it on next call";
}

export default function Messages() {
  const { family, sendMessage, markMessageDone } = useKin();
  const name = family.parent.name;
  const [compose, setCompose] = useState<{ replyTo?: FamilyMessage } | null>(null);
  const [filter, setFilter] = useState<"all" | "from_parent" | "to_parent">("all");
  const shown = family.messages.filter((m) => filter === "all" || m.direction === filter);

  return (
    <Screen tabs={false}>
      <SubHeader kicker={`${name} and the family`} title="Messages" />
      <View style={{ paddingHorizontal: 16, gap: 10 }}>
        <View style={styles.filters}>
          {(
            [
              ["all", "All"],
              ["from_parent", `From ${name}`],
              ["to_parent", `To ${name}`],
            ] as const
          ).map(([key, label]) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === key }}
              onPress={() => setFilter(key)}
              style={[styles.filter, filter === key && styles.filterOn]}
            >
              <Text style={[styles.filterText, filter === key && { color: "#fff" }]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {shown.length === 0 ? (
          <Card>
            <Text style={styles.empty}>
              {filter === "to_parent"
                ? `Nothing sent to ${name} yet.`
                : `When ${name} asks Kin to tell the family something, it shows up here.`}
            </Text>
          </Card>
        ) : null}

        {shown.map((m) => {
          const fromParent = m.direction === "from_parent";
          const open = fromParent && !m.done;
          return (
            <Card key={m.id} style={[styles.card, !fromParent && styles.mine]}>
              <Text style={styles.kicker}>
                {fromParent ? `${name}${m.toName ? ` → ${m.toName}` : ""}` : `${m.fromName ?? "Family"} → ${name}`} · {when(m.createdAt)}
              </Text>
              <Text style={styles.text}>{m.text}</Text>
              <View style={styles.foot}>
                <Text style={[styles.status, open && { color: metric.lilac }]}>{status(m, name)}</Text>
                {open ? (
                  <View style={styles.actions}>
                    <Pressable accessibilityRole="button" onPress={() => setCompose({ replyTo: m })}>
                      <Text style={styles.action}>Reply</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" onPress={() => markMessageDone(m.id)}>
                      <Text style={[styles.action, { color: color.body }]}>Done</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            </Card>
          );
        })}

        <Pressable accessibilityRole="button" onPress={() => setCompose({})} style={styles.send}>
          <Text style={styles.sendText}>Send {name} a message</Text>
        </Pressable>
      </View>

      <Compose
        visible={compose !== null}
        name={name}
        replyTo={compose?.replyTo}
        onClose={() => setCompose(null)}
        onSend={async (text) => {
          await sendMessage(text, compose?.replyTo?.id);
          setCompose(null);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: "row", gap: 8 },
  filter: { borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: "rgba(255,255,255,0.7)" },
  filterOn: { backgroundColor: color.charcoal },
  filterText: { fontSize: 14, fontWeight: "600", color: color.ink },
  empty: { fontSize: 15, lineHeight: 21, color: color.body },
  card: { gap: 6 },
  mine: { backgroundColor: "rgba(235,240,248,0.85)" },
  kicker: { fontSize: 12, fontWeight: "600", letterSpacing: 0.4, textTransform: "uppercase", color: color.body },
  text: { fontSize: 17, lineHeight: 23, fontWeight: "500", color: color.ink },
  foot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
  status: { fontSize: 13, fontWeight: "600", color: color.faint },
  actions: { flexDirection: "row", gap: 18 },
  action: { fontSize: 15, fontWeight: "600", color: color.ink },
  send: { alignItems: "center", borderRadius: 999, paddingVertical: 14, marginTop: 4, backgroundColor: color.charcoal },
  sendText: { fontSize: 16, fontWeight: "600", color: "#fff" },
});
