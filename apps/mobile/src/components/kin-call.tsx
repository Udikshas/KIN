import { router } from "expo-router";
import { useState } from "react";
import { Alert, Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar, Card, Icon, icon, Orb } from "@/components/kit";
import { kinNumber } from "@/lib/data";
import { useKin, type CallTarget, type LiveCall } from "@/lib/kin";
import { color, glass, metric } from "@/lib/theme";

// "Ask Kin to call now": a real Sarvam call to the parent or a family member, so it is always confirmed first.

/** Native dialogs on phones; Alert does nothing on web, so the browser's confirm there. */
export function confirm(title: string, message: string, ok: string, onOk: () => void) {
  if (Platform.OS === "web") {
    if (globalThis.confirm?.(`${title}\n\n${message}`)) onOk();
    return;
  }
  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: ok, onPress: onOk },
  ]);
}

/** Opens the phone dialer. Simulators, tablets and desktops have none: say so instead of failing silently. */
export async function dial(phone: string) {
  const number = phone.replace(/\s/g, "");
  try {
    await Linking.openURL(`tel:${number}`);
  } catch {
    const msg = `This device can't make phone calls. Call ${phone} from your phone.`;
    if (Platform.OS === "web") globalThis.alert?.(msg);
    else Alert.alert("Can't call from here", msg);
  }
}

export function isLive(c: LiveCall | null) {
  return Boolean(c && (c.state === "placing" || c.state === "calling" || c.state === "connected"));
}

type Option = CallTarget & { key: string; sub: string; avatar?: string };

/**
 * Asks Kin to ring someone. With family members who have a phone, `ask` opens a
 * list (render `sheet` on the screen); with just the parent it goes straight to
 * the confirm. Sample users are offered sign-in instead.
 */
export function useAskKin() {
  const { mode, family, liveCall, callNow, signOut } = useKin();
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const { parent } = family;

  const options: Option[] = [
    { key: "parent", name: parent.name, avatar: parent.avatar, sub: "Daily check-in" },
    ...family.members
      .filter((m) => m.phone && m.id !== family.meId)
      .map((m) => ({ key: m.id, name: m.name, avatar: m.avatar, memberId: m.id, sub: [m.relation, m.city].filter(Boolean).join(" · ") })),
  ];

  const confirmCall = (t: CallTarget) =>
    confirm(
      `Kin will ring ${t.name} now`,
      `From ${kinNumber}, for about ${parent.callLengthMinutes} min. Make sure ${t.name} knows Kin is calling.`,
      "Call now",
      () => callNow(t),
    );

  // False (after explaining why) when Kin can't take a request right now.
  const ready = () => {
    if (isLive(liveCall)) return false;
    if (mode !== "signed-in") {
      confirm("Sign in first", "Kin can only call people you have set up. Sign in to add yours.", "Sign in", signOut);
      return false;
    }
    return true;
  };

  /** Ask Kin to ring one person, skipping the list. */
  const askFor = (t: CallTarget) => {
    if (ready()) confirmCall(t);
  };

  const ask = () => {
    if (!ready()) return;
    if (options.length === 1) confirmCall(options[0]);
    else setOpen(true);
  };

  const sheet = (
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
      <Pressable accessibilityLabel="Close the list" onPress={() => setOpen(false)} style={styles.scrim}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.sheetTitle}>Who should Kin call?</Text>
          <Text style={styles.sheetSub}>Kin rings them now from {kinNumber} for a short check-in.</Text>
          {options.map((o) => (
            <Pressable
              key={o.key}
              accessibilityRole="button"
              accessibilityLabel={`Kin calls ${o.name}`}
              onPress={() => {
                setOpen(false);
                confirmCall(o);
              }}
              style={({ pressed }) => [glass, styles.option, pressed && { opacity: 0.7 }]}
            >
              <Avatar name={o.avatar ?? o.name} size={38} />
              <View style={{ flex: 1 }}>
                <Text style={styles.optionName}>{o.name}</Text>
                {o.sub ? <Text style={styles.optionSub}>{o.sub}</Text> : null}
              </View>
              <Icon d={icon.chevron} size={16} color={color.faint} />
            </Pressable>
          ))}
          <Pressable onPress={() => setOpen(false)} style={styles.cancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );

  return { ask, askFor, sheet, many: options.length > 1 };
}

/** What the live call is doing, in a line or two. */
export function liveText(c: LiveCall): { title: string; sub: string } {
  const { name } = c;
  switch (c.state) {
    case "placing":
      return { title: "Placing the call…", sub: `Kin is asking the phone line to ring ${name}.` };
    case "calling":
      return { title: `Kin is calling ${name}…`, sub: `Their phone rings from ${kinNumber}.` };
    case "connected":
      return { title: `Kin is talking with ${name}`, sub: "The evening card appears here when the call ends." };
    case "done":
      if (c.status === "connected") return { title: `Kin spoke with ${name}`, sub: "Open the call to read how they are." };
      return {
        title: c.status === "busy" ? `${name}'s line was busy` : `${name} didn't answer`,
        sub: "Try again a little later.",
      };
    case "timeout":
      return { title: "No result yet", sub: "Kin has not heard back about this call. Pull down to refresh in a minute." };
    case "failed":
      return { title: "Kin couldn't call", sub: c.message };
  }
}

/** Today: a button to ask for a call, which turns into the call's live status. */
export function KinCallCard() {
  const { family, liveCall, dismissLiveCall } = useKin();
  const { ask, sheet, many } = useAskKin();

  if (!liveCall) {
    return (
      <>
        <Pressable
          accessibilityRole="button"
          onPress={ask}
          style={({ pressed }) => [glass, styles.ask, pressed && { opacity: 0.7 }]}
        >
          <View style={styles.askIcon}>
            <Icon d={icon.phone} size={17} color="#fff" />
          </View>
          <Text style={styles.askText}>{many ? "Ask Kin to call someone now" : `Ask Kin to call ${family.parent.name} now`}</Text>
          <Icon d={icon.chevron} size={16} color={color.faint} />
        </Pressable>
        {sheet}
      </>
    );
  }

  const text = liveText(liveCall);
  const live = isLive(liveCall);
  const openCall = liveCall.state === "done" && liveCall.status === "connected" && liveCall.callId ? liveCall.callId : null;
  return (
    <Card style={styles.live}>
      <Orb size={44} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.titleRow}>
          {live ? <View style={styles.dot} /> : null}
          <Text style={styles.title}>{text.title}</Text>
        </View>
        <Text style={styles.sub}>{text.sub}</Text>
        {!live ? (
          <View style={styles.actions}>
            {openCall ? (
              <Pressable
                onPress={() => {
                  dismissLiveCall();
                  router.push(`/calls/${openCall}`);
                }}
              >
                <Text style={styles.action}>See the call</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={dismissLiveCall}>
              <Text style={[styles.action, openCall && { color: color.body }]}>{openCall ? "Close" : "OK"}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  ask: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 999, paddingVertical: 6, paddingLeft: 6, paddingRight: 14 },
  askIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: color.charcoal },
  askText: { flex: 1, fontSize: 15, fontWeight: "600", color: color.ink },
  live: { flexDirection: "row", alignItems: "center", gap: 12 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: metric.green },
  title: { fontSize: 15, fontWeight: "600", color: color.ink },
  sub: { fontSize: 13, lineHeight: 18, color: color.body },
  actions: { flexDirection: "row", gap: 18, marginTop: 6 },
  action: { fontSize: 14, fontWeight: "600", color: color.ink },
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#f4f7fb", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 22, paddingHorizontal: 16, gap: 10 },
  sheetTitle: { paddingHorizontal: 4, fontSize: 20, fontWeight: "600", letterSpacing: -0.4, color: color.ink },
  sheetSub: { paddingHorizontal: 4, paddingBottom: 4, fontSize: 14, lineHeight: 19, color: color.body },
  option: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 10 },
  optionName: { fontSize: 16, fontWeight: "600", color: color.ink },
  optionSub: { marginTop: 1, fontSize: 13, color: color.body },
  cancel: { alignItems: "center", paddingVertical: 12 },
  cancelText: { fontSize: 16, fontWeight: "600", color: color.body },
});
