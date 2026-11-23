import { useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { Choice } from "@/components/field";
import { confirm } from "@/components/kin-call";
import { Button, Card, Pill, SectionLabel, type Tone } from "@/components/kit";
import { to12h, to24h, type Reminder } from "@/lib/data";
import { useKin } from "@/lib/kin";
import { color, glass, metric, radius } from "@/lib/theme";

// Medicine reminder calls (apps/api/app/reminders.py): a 1-minute call at tablet time.
// If the parent says they haven't taken them, or doesn't answer twice, the family is told.

const MAX = 4;
const TIMES = ["8:00 am", "9:00 am", "1:00 pm", "2:00 pm", "8:00 pm", "9:30 pm"];

const status: Record<NonNullable<Reminder["today"]>["state"], { tone: Tone; text: string }> = {
  scheduled: { tone: "plain", text: "Calling soon" },
  calling: { tone: "plain", text: "Calling now" },
  retrying: { tone: "watch", text: "No answer, trying again" },
  taken: { tone: "ok", text: "Taken today" },
  not_taken: { tone: "alert", text: "Not taken today" },
  unclear: { tone: "watch", text: "Not sure today" },
  no_answer: { tone: "watch", text: "No answer today" },
  skipped: { tone: "plain", text: "Evening call asked instead" },
  failed: { tone: "watch", text: "Call didn't go through" },
};

export function ReminderCalls() {
  const { family, saveReminder, removeReminder } = useKin();
  const { parent } = family;
  const reminders = parent.reminders ?? [];
  const [adding, setAdding] = useState(false);
  const [time, setTime] = useState(TIMES[4]);
  const [picked, setPicked] = useState<string[]>([]);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const names = family.medicines.map((m) => m.name);
  const medicines = names.length ? picked.join(", ") : typed.trim();

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    const ok = await run(() => saveReminder({ time: to24h(time), medicines }));
    if (ok) {
      setAdding(false);
      setPicked([]);
      setTyped("");
    }
  }

  function ask() {
    // Same consent rule as daily calls: the parent should know Kin will ring.
    if (parent.consentAt) return add();
    confirm(
      `Does ${parent.name} know?`,
      `Kin will ring ${parent.name} at ${time} to ask about ${medicines}. Tell them first that Kin, an AI assistant, will call. If they ever say no, Kin stops.`,
      `${parent.name} knows`,
      add,
    );
  }

  function remove(r: Reminder) {
    const go = () => void run(() => removeReminder(r.id));
    if (Platform.OS === "web") return go();
    Alert.alert(`Remove the ${to12h(r.time)} reminder?`, "Kin will stop calling at this time.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: go },
    ]);
  }

  return (
    <View style={{ gap: 10, marginTop: 8 }}>
      <SectionLabel>Reminder calls</SectionLabel>
      {reminders.length === 0 && !adding ? (
        <Card>
          <Text style={styles.sub}>
            Kin can ring {parent.name} at tablet time for a one-minute reminder. If they haven&apos;t taken them, or don&apos;t answer twice, you get a notification.
          </Text>
        </Card>
      ) : null}

      {reminders.map((r) => {
        const s = r.enabled && r.today ? status[r.today.state] : null;
        return (
          <Card key={r.id} style={[styles.row, !r.enabled && { opacity: 0.55 }]}>
            <View style={styles.clock}>
              <Text style={styles.clockText}>{to12h(r.time).replace(" ", "\n")}</Text>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.title} numberOfLines={2}>
                {r.medicines}
              </Text>
              {s ? <Pill tone={s.tone}>{s.text}</Pill> : <Text style={styles.sub}>{r.enabled ? `Every day at ${to12h(r.time)}` : "Off"}</Text>}
              <Pressable onPress={() => remove(r)} accessibilityRole="button" hitSlop={8}>
                <Text style={styles.remove}>Remove</Text>
              </Pressable>
            </View>
            <Switch
              value={r.enabled}
              onValueChange={(on) => void run(() => saveReminder({ id: r.id, enabled: on }))}
              trackColor={{ true: metric.green }}
              accessibilityLabel={`Reminder at ${to12h(r.time)}`}
            />
          </Card>
        );
      })}

      {adding ? (
        <Card style={{ gap: 12 }}>
          <Choice label="Call at (India time)" options={TIMES} value={time} onChange={setTime} />
          {names.length ? (
            <View style={{ gap: 8 }}>
              <Text style={styles.label}>Which medicines</Text>
              <View style={styles.chips}>
                {names.map((n) => {
                  const on = picked.includes(n);
                  return (
                    <Pressable
                      key={n}
                      onPress={() => setPicked((p) => (on ? p.filter((x) => x !== n) : [...p, n]))}
                      accessibilityState={{ selected: on }}
                      style={[on ? styles.chipOn : glass, styles.chip]}
                    >
                      <Text style={[styles.chipText, on && { color: "#fff" }]}>{n}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : (
            <TextInput value={typed} onChangeText={setTyped} placeholder="Which medicines, e.g. BP tablet" placeholderTextColor={color.faint} style={styles.input} />
          )}
          <Text style={styles.sub}>A one-minute call, about ₹4. Kin asks once and tries again 15 minutes later if there&apos;s no answer.</Text>
          <Button onPress={ask} disabled={!medicines || busy}>
            {busy ? "Saving…" : "Add reminder call"}
          </Button>
          <Pressable onPress={() => setAdding(false)} style={{ alignItems: "center", paddingVertical: 4 }}>
            <Text style={styles.remove}>Cancel</Text>
          </Pressable>
        </Card>
      ) : reminders.length < MAX ? (
        <Button variant="soft" onPress={() => setAdding(true)}>
          Add a reminder call
        </Button>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  clock: { width: 58, height: 58, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: `${metric.green}22` },
  clockText: { fontSize: 14, lineHeight: 17, fontWeight: "700", textAlign: "center", color: color.ink },
  title: { fontSize: 16, fontWeight: "600", color: color.ink },
  sub: { fontSize: 13, lineHeight: 18, color: color.body },
  label: { fontSize: 13, fontWeight: "600", color: color.body },
  remove: { fontSize: 13, fontWeight: "600", color: color.body },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  chipOn: { backgroundColor: color.charcoal },
  chipText: { fontSize: 14, fontWeight: "600", color: color.ink },
  input: { ...glass, height: 48, borderRadius: radius.input, paddingHorizontal: 14, fontSize: 16, color: color.ink, backgroundColor: "rgba(255,255,255,0.85)" },
  error: { paddingHorizontal: 4, fontSize: 14, color: color.alert },
});
