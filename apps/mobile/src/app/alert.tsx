import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChoreList, useChores } from "@/components/chores";
import { dial } from "@/components/kin-call";
import { Button, Card, Icon, icon, Mesh, Pill, SectionLabel } from "@/components/kit";
import { SubHeader } from "@/components/screen";
import { UrgentBanner } from "@/components/urgent-banner";
import { signalTone } from "@/lib/data";
import { useKin } from "@/lib/kin";
import { color, metric } from "@/lib/theme";

export default function Alert() {
  const insets = useSafeAreaInsets();
  const { family } = useKin();
  const a = family.alert;
  const chores = useChores().length > 0;
  const doctor = family.members.find((m) => m.role === "Teleconsult");

  return (
    // The wallpaper fills the whole sheet; only the content inside is padded (an SVG in a padded parent stops short).
    <View style={styles.fill}>
      <Mesh />
      <ScrollView
        style={{ flex: 1 }}
        // A page sheet on iOS (presentation "modal"): it already starts below the notch.
        contentContainerStyle={{ flexGrow: 1, paddingTop: Platform.OS === "ios" ? 10 : Math.max(insets.top + 2, 12), paddingBottom: a ? 16 : insets.bottom + 16 }}
        showsVerticalScrollIndicator={false}
      >
        <SubHeader title="Alerts" kicker={`About ${family.parent.name}`} />
        {family.parent.urgent ? (
          <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
            <UrgentBanner />
          </View>
        ) : null}
        {chores ? (
          <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
            <ChoreList onBefore={() => router.back()} />
          </View>
        ) : null}
        {a ? (
          <>
            <View style={styles.top}>
              <Pill tone={signalTone[a.level]}>{a.level === "red" ? "Red alert" : "Amber alert"}</Pill>
              <Text style={styles.title}>{a.title}</Text>
              <Text style={styles.basis}>{a.basis}</Text>
            </View>
            <View style={styles.cards}>
              <Card style={{ gap: 12 }}>
                {a.evidence.map((e) => (
                  <View key={e.label} style={styles.row}>
                    <View style={[styles.bar, { backgroundColor: e.color }]} />
                    <Text style={styles.label}>{e.label}</Text>
                    <Text style={styles.value}>{e.value}</Text>
                  </View>
                ))}
              </Card>
              <Card>
                <SectionLabel>{family.source === "sample" ? "Ask her" : "You could ask"}</SectionLabel>
                <Text style={styles.ask}>&ldquo;{a.ask}&rdquo;</Text>
              </Card>
            </View>
          </>
        ) : (
          <AllClear name={family.parent.name} hasCalls={family.calls.some((c) => c.status === "connected")} />
        )}
      </ScrollView>
      {a ? (
        <View style={[styles.actions, { paddingBottom: insets.bottom + 12 }]}>
          <Button onPress={() => dial(family.parent.phone)}>{`Call ${family.parent.name} now`}</Button>
          {a.callId ? (
            <Button variant="soft" onPress={() => router.replace(`/calls/${a.callId}`)}>
              See the call
            </Button>
          ) : null}
          {doctor ? (
            <Button variant="soft" onPress={() => router.replace("/family")}>
              {`Contact ${doctor.name}`}
            </Button>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** What Kin raises an alert for, so an empty page still explains itself. */
const watches = [
  { color: metric.lilac, label: "Sleep", text: "Much less than usual" },
  { color: metric.gold, label: "Pain", text: "Mentioned on several days" },
  { color: metric.blue, label: "Mood", text: "Low for a few calls" },
  { color: metric.green, label: "Medicine", text: "Doses missed" },
  { color: color.alert, label: "No answer", text: "3 days without a call" },
];

function AllClear({ name, hasCalls }: { name: string; hasCalls: boolean }) {
  return (
    <View style={styles.empty}>
      <View style={styles.hero}>
        {/* A tick once Kin has heard from them; before that a quiet bell, since nothing is known yet. */}
        <View style={[styles.halo, !hasCalls && { backgroundColor: "rgba(157,134,255,0.14)" }]}>
          <LinearGradient
            colors={hasCalls ? ["#6ee43a", color.ok] : ["#c9bcff", "#8a72ff"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.badge, !hasCalls && { shadowColor: "#8a72ff" }]}
          >
            {hasCalls ? (
              <Svg width={34} height={34} viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                <Path d="m2.8 6.3 2.1 2 4.3-4.6" />
              </Svg>
            ) : (
              <Icon d={icon.bell} size={32} width={1.9} color="#fff" />
            )}
          </LinearGradient>
        </View>
        <Text style={styles.emptyTitle}>{hasCalls ? "You're all caught up" : "No alerts yet"}</Text>
        <Text style={styles.emptyText}>
          {hasCalls
            ? `Nothing needs your attention. Kin compares every call with ${name}'s own last 30 days and tells you when something changes.`
            : `Alerts start once Kin has spoken with ${name} a few times and knows what is usual for them.`}
        </Text>
      </View>

      <Card style={{ gap: 2 }}>
        <SectionLabel>Kin tells you about</SectionLabel>
        {watches.map((w, i) => (
          <View key={w.label} style={[styles.watch, i > 0 && styles.watchLine]}>
            <View style={[styles.dot, { backgroundColor: w.color }]} />
            <Text style={styles.watchLabel}>{w.label}</Text>
            <Text style={styles.watchText}>{w.text}</Text>
          </View>
        ))}
      </Card>

      <Pressable onPress={() => router.replace("/trends")} style={({ pressed }) => [styles.link, pressed && { opacity: 0.6 }]}>
        <Text style={styles.linkText}>See {name}&apos;s trends</Text>
        <Icon d={icon.chevron} size={14} width={2.4} color={color.ink} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.mist },
  top: { paddingHorizontal: 22, paddingTop: 6, gap: 10 },
  title: { fontSize: 28, lineHeight: 31, fontWeight: "600", letterSpacing: -0.9, color: color.ink },
  basis: { fontSize: 15, lineHeight: 20, color: color.body },
  cards: { marginTop: 18, paddingHorizontal: 16, gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  bar: { width: 4, height: 22, borderRadius: 2 },
  label: { fontSize: 15, color: color.body },
  value: { marginLeft: "auto", fontSize: 15, fontWeight: "600", color: color.ink },
  ask: { marginTop: 6, fontSize: 16, lineHeight: 22, color: color.ink },
  actions: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  empty: { flex: 1, paddingHorizontal: 16, gap: 18 },
  hero: { flex: 1, minHeight: 280, alignItems: "center", justifyContent: "center", paddingHorizontal: 12, gap: 10 },
  halo: { width: 112, height: 112, borderRadius: 56, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(49,206,1,0.12)", marginBottom: 8 },
  badge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: color.ok,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  emptyTitle: { fontSize: 24, lineHeight: 29, fontWeight: "600", letterSpacing: -0.6, color: color.ink, textAlign: "center" },
  emptyText: { maxWidth: 320, fontSize: 15, lineHeight: 21, color: color.body, textAlign: "center" },
  watch: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9 },
  watchLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(34,35,38,0.12)" },
  dot: { width: 8, height: 8, borderRadius: 4 },
  watchLabel: { width: 84, fontSize: 15, fontWeight: "600", color: color.ink },
  watchText: { flex: 1, fontSize: 14, color: color.body },
  link: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 6 },
  linkText: { fontSize: 15, fontWeight: "600", color: color.ink },
});
