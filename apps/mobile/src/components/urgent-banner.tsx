import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { formatDay, istDate, istTime } from "@/lib/data";
import { useKin } from "@/lib/kin";
import { color } from "@/lib/theme";

/**
 * An emergency Kin heard during a call (the agent's flag_urgent, apps/api/app/urgent.py):
 * red, with one-tap calls to the parent and the emergency contact, until someone marks it handled.
 * A scam warning (flag_scam: a caller asked for an OTP or money) is the same card in amber.
 */
export function UrgentBanner() {
  const { family, markUrgentHandled } = useKin();
  const { parent } = family;
  const urgent = parent.urgent;
  if (!urgent) return null;
  const dial = (phone: string) => Linking.openURL(`tel:${phone.replace(/\s/g, "")}`);
  const at = new Date(urgent.at);
  if (urgent.kind === "scam") {
    return (
      <View style={[styles.card, { backgroundColor: color.watch }]} accessibilityRole="alert">
        <Text style={styles.kicker}>
          Scam warning · {formatDay(istDate(at))} {istTime(at)}
        </Text>
        <Text style={styles.title}>{parent.name} may be talking to a scammer</Text>
        {urgent.reason ? <Text style={styles.reason}>{parent.name} told Kin: &ldquo;{urgent.reason}&rdquo;</Text> : null}
        <Text style={styles.note}>
          Kin told {parent.name} not to share any OTP, PIN or bank details and not to send money. Call to check nothing was shared.
          If money was sent, call 1930 (cyber crime helpline) at once.
        </Text>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={() => dial(parent.phone)} style={[styles.btn, styles.primary]}>
            <Text style={[styles.btnText, { color: color.watch }]}>Call {parent.name}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => dial("1930")} style={styles.btn}>
            <Text style={styles.btnText}>Call 1930</Text>
          </Pressable>
        </View>
        <Pressable accessibilityRole="button" onPress={() => markUrgentHandled(urgent.id)} style={styles.handled}>
          <Text style={styles.handledText}>All fine, nothing was shared</Text>
        </Pressable>
      </View>
    );
  }
  const contact = family.members.find((m) => m.is_emergency && m.phone && m.id !== family.meId);

  return (
    <View style={styles.card} accessibilityRole="alert">
      <Text style={styles.kicker}>
        Kin flagged an emergency · {formatDay(istDate(at))} {istTime(at)}
      </Text>
      <Text style={styles.title}>{parent.name} may need help</Text>
      {urgent.reason ? <Text style={styles.reason}>Kin heard: &ldquo;{urgent.reason}&rdquo;</Text> : null}
      <Text style={styles.note}>
        {contact ? `Kin tried to connect ${parent.name} to ${contact.name}.` : "No emergency contact is set."} If you can&apos;t reach them, call 108.
      </Text>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={() => dial(parent.phone)} style={[styles.btn, styles.primary]}>
          <Text style={[styles.btnText, { color: color.alert }]}>Call {parent.name}</Text>
        </Pressable>
        {contact?.phone ? (
          <Pressable accessibilityRole="button" onPress={() => dial(contact.phone!)} style={styles.btn}>
            <Text style={styles.btnText}>Call {contact.name}</Text>
          </Pressable>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => dial("108")} style={styles.btn}>
            <Text style={styles.btnText}>Call 108</Text>
          </Pressable>
        )}
      </View>
      <Pressable accessibilityRole="button" onPress={() => markUrgentHandled(urgent.id)} style={styles.handled}>
        <Text style={styles.handledText}>It&apos;s handled</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 28, padding: 18, gap: 6, backgroundColor: color.alert },
  kicker: { fontSize: 12, fontWeight: "600", letterSpacing: 0.4, textTransform: "uppercase", color: "rgba(255,255,255,0.8)" },
  title: { fontSize: 24, lineHeight: 28, fontWeight: "600", letterSpacing: -0.6, color: "#fff" },
  reason: { fontSize: 16, lineHeight: 22, color: "#fff" },
  note: { fontSize: 14, lineHeight: 19, color: "rgba(255,255,255,0.85)" },
  actions: { flexDirection: "row", gap: 8, marginTop: 8 },
  btn: { flex: 1, alignItems: "center", borderRadius: 999, paddingVertical: 12, backgroundColor: "rgba(255,255,255,0.18)" },
  primary: { backgroundColor: "#fff" },
  btnText: { fontSize: 15, fontWeight: "600", color: "#fff" },
  handled: { alignSelf: "center", paddingVertical: 8, marginTop: 2 },
  handledText: { fontSize: 14, fontWeight: "600", color: "rgba(255,255,255,0.85)" },
});
