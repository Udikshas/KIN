import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState } from "react";
import { Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Card, Icon, icon } from "@/components/kit";
import { formatDay, istDate, istTime, type FamilyMessage } from "@/lib/data";
import { useKeyboardOpen } from "@/lib/keyboard";
import { useKin } from "@/lib/kin";
import { color, glass, metric } from "@/lib/theme";

// "Tell my family" on Today: what the parent asked Kin to pass on, and notes Kin
// will pass on to them during the next call (apps/api/app/messages.py).

const SHOWN = 3;

export function when(iso: string) {
  const d = new Date(iso);
  return `${formatDay(istDate(d))} ${istTime(d)}`;
}

export function FamilyMessages() {
  const { family, sendMessage, markMessageDone } = useKin();
  const name = family.parent.name;
  const open = family.messages.filter((m) => m.direction === "from_parent" && !m.done).slice(0, SHOWN);
  const waiting = family.messages.filter((m) => m.direction === "to_parent" && !m.delivered).length;
  const [compose, setCompose] = useState<{ replyTo?: FamilyMessage } | null>(null);

  return (
    <>
      {open.map((m) => (
        <Card key={m.id} style={styles.card}>
          <View style={styles.head}>
            <View style={styles.quoteMark}>
              <Text style={styles.quoteText}>&ldquo;</Text>
            </View>
            <Text style={styles.kicker}>
              {name} says{m.toName ? ` · for ${m.toName}` : ""} · {when(m.createdAt)}
            </Text>
          </View>
          <Text style={styles.text}>{m.text}</Text>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={() => setCompose({ replyTo: m })} style={styles.action}>
              <Text style={styles.actionText}>Reply</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => markMessageDone(m.id)} style={styles.action}>
              <Text style={[styles.actionText, { color: color.body }]}>Done</Text>
            </Pressable>
          </View>
        </Card>
      ))}

      {/* One row: compose on the left, the message history as a chip on the right. */}
      <View style={[glass, styles.send]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setCompose({})}
          style={({ pressed }) => [styles.sendMain, pressed && { opacity: 0.7 }]}
        >
          <LinearGradient colors={["#c9bcff", "#8a72ff"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sendIcon}>
            <Icon d={icon.message} size={18} color="#fff" />
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={styles.sendText} numberOfLines={1}>Send {name} a message</Text>
            <Text style={styles.sendSub} numberOfLines={1}>
              {waiting ? `${waiting} ${waiting === 1 ? "note" : "notes"} waiting for the next call` : "Kin passes it on during the next call"}
            </Text>
          </View>
          {family.messages.length ? null : <Icon d={icon.chevron} size={16} color={color.faint} />}
        </Pressable>
        {family.messages.length ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`All messages, ${family.messages.length}`}
            onPress={() => router.push("/messages")}
            hitSlop={6}
            style={({ pressed }) => [styles.historyChip, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.historyText}>All</Text>
            <View style={styles.historyCount}>
              <Text style={styles.historyCountText}>{family.messages.length}</Text>
            </View>
          </Pressable>
        ) : null}
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
    </>
  );
}

export function Compose({ visible, name, replyTo, onClose, onSend }: {
  visible: boolean; name: string; replyTo?: FamilyMessage; onClose: () => void; onSend: (text: string) => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardOpen();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const close = () => {
    setText("");
    setError("");
    onClose();
  };
  const send = async () => {
    setBusy(true);
    setError("");
    try {
      await onSend(text.trim());
      setText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <Pressable accessibilityLabel="Close" onPress={close} style={styles.scrim}>
          {/* With the keyboard up only a small gap above it; without, clear the home bar. */}
          <Pressable onPress={Keyboard.dismiss} style={[styles.sheet, { paddingBottom: keyboard ? 12 : insets.bottom + 12 }]}>
            <View style={styles.grabber} />
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{replyTo ? `Reply to ${name}` : `Message for ${name}`}</Text>
              <Pressable onPress={close} hitSlop={10} accessibilityRole="button">
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </View>
            {replyTo ? <Text style={styles.sheetQuote}>&ldquo;{replyTo.text}&rdquo;</Text> : null}
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={replyTo ? "Yes Maa, I'll call on Sunday." : "I'm visiting next week."}
              placeholderTextColor={color.faint}
              multiline
              maxLength={300}
              autoFocus
              style={[glass, styles.input]}
            />
            <Text style={styles.sheetSub}>Kin tells {name} during the next call, in their language.</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button onPress={send} disabled={!text.trim() || busy}>
              {busy ? "Sending…" : "Send"}
            </Button>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8 },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  quoteMark: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: `${metric.lilac}33` },
  quoteText: { fontSize: 20, lineHeight: 26, fontWeight: "700", color: metric.lilac },
  kicker: { flex: 1, fontSize: 12, fontWeight: "600", letterSpacing: 0.4, textTransform: "uppercase", color: color.body },
  text: { fontSize: 17, lineHeight: 23, fontWeight: "500", color: color.ink },
  actions: { flexDirection: "row", gap: 20, marginTop: 2 },
  action: { paddingVertical: 4 },
  actionText: { fontSize: 15, fontWeight: "600", color: color.ink },
  send: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 999, paddingVertical: 6, paddingLeft: 6, paddingRight: 6 },
  sendMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, paddingRight: 8 },
  sendIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  sendText: { fontSize: 15, fontWeight: "600", color: color.ink },
  sendSub: { marginTop: 1, fontSize: 12, color: color.body },
  historyChip: {
    flexDirection: "row", alignItems: "center", gap: 6, height: 34, borderRadius: 17, paddingLeft: 12, paddingRight: 5,
    backgroundColor: `${metric.lilac}1f`,
  },
  historyText: { fontSize: 14, fontWeight: "600", color: metric.lilac },
  historyCount: { minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 6, alignItems: "center", justifyContent: "center", backgroundColor: metric.lilac },
  historyCountText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#f4f7fb", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 8, paddingHorizontal: 16, gap: 12 },
  grabber: { alignSelf: "center", width: 36, height: 5, borderRadius: 3, backgroundColor: "rgba(34,35,38,0.18)", marginBottom: 2 },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4, paddingTop: 4 },
  sheetTitle: { flexShrink: 1, fontSize: 20, fontWeight: "600", letterSpacing: -0.4, color: color.ink },
  sheetQuote: { paddingHorizontal: 4, fontSize: 15, lineHeight: 21, color: color.body, fontStyle: "italic" },
  sheetSub: { paddingHorizontal: 4, fontSize: 13, lineHeight: 18, color: color.body },
  input: { minHeight: 96, borderRadius: 18, padding: 14, fontSize: 16, lineHeight: 22, color: color.ink, backgroundColor: "rgba(255,255,255,0.9)", textAlignVertical: "top" },
  error: { paddingHorizontal: 4, fontSize: 14, color: color.alert },
  cancelText: { fontSize: 16, fontWeight: "600", color: color.body },
});
