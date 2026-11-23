import { router } from "expo-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from "react-native-svg";

import { formatPhone } from "@/components/form";
import { dial, isLive, liveText, useAskKin } from "@/components/kin-call";
import { Avatar, Icon, icon, Orb } from "@/components/kit";
import { goBack } from "@/components/screen";
import { kinNumber } from "@/lib/data";
import { useKin } from "@/lib/kin";
import { color, glassDark, metric } from "@/lib/theme";

/** Someone you can ring from here: the parent, or a family member with a phone. */
type Person = { key: string; name: string; avatar?: string; phone: string; memberId?: string; sub: string };

/**
 * Dark call screen. Pick who (parent or a family member), then ring them yourself,
 * ask Kin to call them, or set up a three-way call. The app never carries audio:
 * your calls go through the phone's dialer, Kin's through its own line, so a
 * conference is the phone's own Add call → Merge, which the "Together" sheet walks through.
 */
export default function CallSheet() {
  const insets = useSafeAreaInsets();
  const { family, liveCall, dismissLiveCall } = useKin();
  const { parent } = family;
  const { askFor, sheet } = useAskKin();
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 14000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  const people: Person[] = [
    {
      key: "parent",
      name: parent.name,
      avatar: parent.avatar,
      phone: parent.phone,
      sub: parent.dailyCalls ? `Kin calls every day at ${parent.callTime}` : "Kin calls when you ask",
    },
    ...family.members
      .filter((m) => m.phone && m.id !== family.meId)
      .map((m) => ({
        key: m.id,
        name: m.name,
        avatar: m.avatar,
        phone: m.phone!,
        memberId: m.id,
        sub: [m.relation, m.city].filter(Boolean).join(" · "),
      })),
  ];
  const [key, setKey] = useState("parent");
  const who = people.find((p) => p.key === key) ?? people[0];
  const [together, setTogether] = useState(false);
  // Kin joins a merged call through its on-start hook, which knows the caller by
  // their number: it can help only with the parent on the line and your number saved.
  // The sample family has no "you" row, so it shows the full flow.
  const myPhone = family.source === "sample" || family.members.find((m) => m.id === family.meId)?.phone;
  const kinJoins = who.key === "parent" && Boolean(myPhone);

  const busy = isLive(liveCall);
  const liveHere = liveCall && liveCall.name === who.name ? liveCall : null;
  const last = who.key === "parent" ? family.calls.find((c) => c.status === "connected") : undefined;

  return (
    <View style={[styles.fill, { paddingTop: insets.top + 4, paddingBottom: insets.bottom + 28 }]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMin slice">
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={metric.lilac} stopOpacity={0.55} />
            <Stop offset="1" stopColor={metric.lilac} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx="50" cy="30" r="60" fill="url(#glow)" />
      </Svg>

      <View style={styles.top}>
        <Text style={styles.topTitle}>Calls</Text>
        <Pressable accessibilityLabel="Close" onPress={goBack} style={[glassDark, styles.close]}>
          <Icon d={icon.close} color="#fff" size={18} />
        </Pressable>
      </View>

      {people.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.switcherScroll} contentContainerStyle={styles.switcher}>
          {people.map((p) => {
            const on = p.key === who.key;
            return (
              <Pressable
                key={p.key}
                accessibilityRole="button"
                accessibilityLabel={p.name}
                accessibilityState={{ selected: on }}
                onPress={() => setKey(p.key)}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Avatar name={p.avatar ?? p.name} size={28} />
                <Text numberOfLines={1} style={[styles.chipText, on && { color: color.charcoal }]}>
                  {p.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <View style={styles.hero}>
        <Animated.View style={[styles.orbGlow, { transform: [{ rotate }] }]}>
          <Orb size={132} />
        </Animated.View>
      </View>

      <Text style={styles.name}>{who.name}</Text>
      <Text style={styles.kicker}>{who.sub}</Text>
      <Text style={styles.phone}>{formatPhone(who.phone)}</Text>

      {liveHere ? (
        <LiveBubble
          title={liveText(liveHere).title}
          sub={liveText(liveHere).sub}
          live={isLive(liveHere)}
          action={
            liveHere.state === "done" && liveHere.status === "connected" && liveHere.callId
              ? {
                  label: "Read the full call",
                  go: () => {
                    const id = liveHere.callId;
                    dismissLiveCall();
                    router.replace(`/calls/${id}`);
                  },
                }
              : !isLive(liveHere)
                ? { label: "OK", go: dismissLiveCall }
                : undefined
          }
        />
      ) : busy && liveCall ? (
        <View style={[glassDark, styles.bubble]}>
          <Text style={styles.who}>Kin is busy</Text>
          <Text style={styles.bubbleText}>{liveText(liveCall).title}</Text>
          <Text style={styles.notedText}>Kin makes one call at a time. You can still ring {who.name} yourself.</Text>
        </View>
      ) : last ? (
        <Pressable onPress={() => router.replace(`/calls/${last.id}`)} style={[glassDark, styles.bubble]}>
          <Text style={styles.who}>Kin&apos;s last call · {last.time}</Text>
          <Text numberOfLines={3} style={styles.bubbleText}>
            {last.summary}
          </Text>
          <View style={styles.noted}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: metric.gold }} />
            <Text style={styles.notedText}>Read the full call</Text>
          </View>
        </Pressable>
      ) : (
        <View style={[glassDark, styles.bubble]}>
          <Text style={styles.bubbleText}>Ring {who.name} yourself, or ask Kin for a short check-in.</Text>
          <Text style={styles.notedText}>To talk all together, tap Together.</Text>
        </View>
      )}

      <View style={styles.buttons}>
        <CallButton label={`Call ${who.name}`} accent onPress={() => dial(who.phone)} />
        <CallButton label="Ask Kin" kin dim={busy} onPress={() => askFor({ name: who.name, memberId: who.memberId })} />
        <CallButton label="Together" glyph={icon.family} onPress={() => setTogether(true)} />
      </View>

      {together ? (
        <Pressable accessibilityLabel="Close" onPress={() => setTogether(false)} style={styles.scrim}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 18 }]}>
            <Text style={styles.sheetTitle}>Talk together</Text>
            <Text style={styles.sheetSub}>Your phone joins everyone into one call.</Text>

            <Step n={1} text={`Call ${who.name}`}>
              <SheetButton label={`Call ${who.name}`} onPress={() => dial(who.phone)} />
            </Step>
            <Step n={2} text="Tap Add call, then call">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {kinJoins ? <SheetButton label="Kin" orb onPress={() => dial(kinNumber)} /> : null}
                {people
                  .filter((p) => p.key !== who.key)
                  .map((p) => (
                    <SheetButton key={p.key} label={p.name} avatar={p.avatar ?? p.name} onPress={() => dial(p.phone)} />
                  ))}
              </ScrollView>
            </Step>
            <Step n={3} text="Tap Merge. You're all on one call." />

            <Text style={styles.sheetNote}>
              {who.key !== "parent"
                ? `To add Kin, pick ${parent.name} first.`
                : myPhone
                  ? `Kin joins as ${parent.name}'s helper.`
                  : `To add Kin, save your number in Family first.`}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setTogether(false)}
              style={({ pressed }) => [styles.doneBtn, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      ) : null}
      {sheet}
    </View>
  );
}

function Step({ n, text, children }: { n: number; text: string; children?: ReactNode }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNum}>
        <Text style={styles.stepNumText}>{n}</Text>
      </View>
      <View style={{ flex: 1, gap: 8 }}>
        <Text style={styles.stepText}>{text}</Text>
        {children}
      </View>
    </View>
  );
}

function SheetButton({ label, onPress, avatar, orb }: { label: string; onPress: () => void; avatar?: string; orb?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Call ${label}`} onPress={onPress} style={({ pressed }) => [styles.sheetBtn, pressed && { opacity: 0.7 }]}>
      {orb ? <Orb size={24} /> : avatar ? <Avatar name={avatar} size={24} /> : <Icon d={icon.phone} size={16} color={color.charcoal} />}
      <Text style={styles.sheetBtnText}>{label}</Text>
    </Pressable>
  );
}

function LiveBubble({ title, sub, live, action }: { title: string; sub: string; live: boolean; action?: { label: string; go: () => void } }) {
  return (
    <Pressable onPress={action?.go} disabled={!action} style={[glassDark, styles.bubble]}>
      <Text style={styles.who}>{live ? "Kin is on it" : "Kin's call"}</Text>
      <Text style={styles.bubbleText}>{title}</Text>
      <Text style={styles.notedText}>{sub}</Text>
      {action ? (
        <View style={styles.noted}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: metric.gold }} />
          <Text style={styles.notedText}>{action.label}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function CallButton({ label, accent, kin, dim, glyph, onPress }: {
  label: string; accent?: boolean; kin?: boolean; dim?: boolean; glyph?: string; onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={dim}
      style={({ pressed }) => [styles.btnWrap, (pressed || dim) && { opacity: dim ? 0.45 : 0.7 }]}>
      {kin ? (
        <View style={styles.btn}>
          <Orb size={62} />
        </View>
      ) : (
        <View style={[styles.btn, accent ? { backgroundColor: "#fff" } : glassDark]}>
          <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={accent ? color.charcoal : "#fff"} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d={glyph ?? icon.phone} />
          </Svg>
        </View>
      )}
      <Text numberOfLines={2} style={styles.btnLabel}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.charcoal, alignItems: "center", overflow: "hidden" },
  top: { alignSelf: "stretch", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, minHeight: 44 },
  topTitle: { fontSize: 17, fontWeight: "600", color: "#fff" },
  close: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },

  switcherScroll: { flexGrow: 0, alignSelf: "stretch", marginTop: 12 },
  switcher: { gap: 8, paddingHorizontal: 18 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingVertical: 5,
    paddingLeft: 5,
    paddingRight: 14,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  chipOn: { backgroundColor: "#fff", borderColor: "#fff" },
  chipText: { maxWidth: 110, fontSize: 14, fontWeight: "600", color: "#fff" },

  hero: { marginTop: 26, width: 132, height: 132, alignItems: "center", justifyContent: "center" },
  orbGlow: { position: "absolute", width: 132, height: 132, borderRadius: 66, shadowColor: metric.blue, shadowOpacity: 0.6, shadowRadius: 30 },
  name: { marginTop: 16, fontSize: 30, fontWeight: "600", letterSpacing: -0.9, color: "#fff" },
  kicker: { marginTop: 2, fontSize: 15, color: "rgba(255,255,255,0.65)" },
  phone: { marginTop: 2, fontSize: 13, color: "rgba(255,255,255,0.45)", fontVariant: ["tabular-nums"] },

  bubble: { marginTop: 22, marginHorizontal: 18, alignSelf: "stretch", borderRadius: 20, borderBottomLeftRadius: 6, paddingHorizontal: 14, paddingVertical: 10, gap: 2 },
  who: { fontSize: 11, fontWeight: "600", letterSpacing: 0.5, textTransform: "uppercase", color: "rgba(255,255,255,0.5)" },
  bubbleText: { fontSize: 16, lineHeight: 22, color: "#fff" },
  noted: { marginTop: 6, flexDirection: "row", alignItems: "center", gap: 8 },
  notedText: { fontSize: 13, lineHeight: 18, color: "rgba(255,255,255,0.75)" },

  buttons: { position: "absolute", bottom: 40, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 22 },
  btnWrap: { alignItems: "center", gap: 8, width: 80 },
  btn: { width: 62, height: 62, borderRadius: 31, alignItems: "center", justifyContent: "center" },
  btnLabel: { fontSize: 12, color: "rgba(255,255,255,0.75)", textAlign: "center" },

  scrim: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#2a2b31", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 22, paddingHorizontal: 18, gap: 14 },
  sheetTitle: { fontSize: 20, fontWeight: "600", letterSpacing: -0.4, color: "#fff" },
  sheetSub: { marginTop: -8, fontSize: 14, lineHeight: 19, color: "rgba(255,255,255,0.65)" },
  step: { flexDirection: "row", gap: 12 },
  stepNum: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.14)" },
  stepNumText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  stepText: { paddingTop: 3, fontSize: 15, lineHeight: 20, color: "#fff" },
  sheetBtn: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", borderRadius: 999, paddingVertical: 6, paddingLeft: 6, paddingRight: 14, backgroundColor: "#fff" },
  sheetBtnText: { fontSize: 14, fontWeight: "600", color: color.charcoal },
  sheetNote: { fontSize: 13, lineHeight: 18, color: "rgba(255,255,255,0.55)" },
  doneBtn: { marginTop: 4, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  doneText: { fontSize: 17, fontWeight: "600", color: color.charcoal },
});
