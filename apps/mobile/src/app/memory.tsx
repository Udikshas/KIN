import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card, Icon, icon } from "@/components/kit";
import { gutter, Screen, SubHeader } from "@/components/screen";
import { useKin } from "@/lib/kin";
import { color } from "@/lib/theme";

export default function Memory() {
  const { family } = useKin();
  const n = family.topicsAvoid.length;
  return (
    <Screen tabs={false}>
      <SubHeader kicker="What Kin remembers" title="Memory" />
      <View style={[gutter, { gap: 10, paddingHorizontal: 16 }]}>
        {family.nextQuestion ? (
          <LinearGradient colors={["rgba(31,32,37,0.94)", "rgba(65,70,110,0.85)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.next}>
            <Text style={styles.nextLabel}>{family.source === "sample" ? "Tonight Kin will ask" : "On the next call"}</Text>
            <Text style={styles.nextText}>{family.source === "sample" ? `“${family.nextQuestion}”` : family.nextQuestion}</Text>
          </LinearGradient>
        ) : null}
        {family.memories.length === 0 ? (
          <Card>
            <Text style={styles.text}>Nothing yet. After each call Kin keeps a short note, and brings one thing up on the next call.</Text>
          </Card>
        ) : null}
        {family.memories.map((m, i) => (
          <Card key={`${i}-${m.text}`} style={styles.row}>
            <Text style={styles.tag}>{m.tag}</Text>
            <Text style={styles.text}>{m.text}</Text>
            <Text style={styles.when}>{m.when}</Text>
          </Card>
        ))}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/parent")}
          style={({ pressed }) => [styles.avoid, pressed && { opacity: 0.7 }]}
        >
          <Icon d={icon.lock} size={18} color={color.body} />
          <Text style={styles.avoidText}>
            {n ? `${n} ${n === 1 ? "topic" : "topics"} Kin never brings up` : "Add topics Kin should never bring up"}
          </Text>
          <Icon d={icon.chevron} size={14} color={color.faint} />
        </Pressable>
        <Text style={styles.note}>
          Kin only repeats what was said on a call or what your family wrote down. It carries the last five calls into the next one.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  next: { borderRadius: 28, padding: 16 },
  nextLabel: { fontSize: 13, fontWeight: "600", letterSpacing: 0.5, textTransform: "uppercase", color: "rgba(255,255,255,0.5)" },
  nextText: { marginTop: 6, fontSize: 17, lineHeight: 23, color: "#fff" },
  row: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  tag: { overflow: "hidden", marginTop: 2, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.7)", paddingHorizontal: 9, paddingVertical: 3, fontSize: 12, fontWeight: "600", color: color.ink },
  text: { flex: 1, fontSize: 15, lineHeight: 20, color: color.ink },
  when: { fontSize: 12, color: color.body },
  avoid: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 22, borderWidth: 1, borderStyle: "dashed", borderColor: color.line, padding: 14 },
  avoidText: { flex: 1, fontSize: 14, color: color.body },
  note: { paddingHorizontal: 4, fontSize: 13, lineHeight: 18, color: color.body },
});
