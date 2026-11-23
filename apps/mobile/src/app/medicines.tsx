import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Button, Card, Check, MedIcon, Ring } from "@/components/kit";
import { confirm } from "@/components/kin-call";
import { MedicineCalendar } from "@/components/medicine-calendar";
import { ReminderCalls } from "@/components/reminder-calls";
import { ReorderAll } from "@/components/reorder-all";
import { StockSheet, stockLine } from "@/components/stock-sheet";
import { gutter, Screen, SubHeader } from "@/components/screen";
import { amazonCartUrl, medColors, type Medicine } from "@/lib/data";
import { useKin } from "@/lib/kin";
import { color, glass, metric, radius } from "@/lib/theme";

export default function Medicines() {
  const { family, saveMedicines, restockAll } = useKin();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null); // the medicine whose stock sheet is open
  // Several medicines in one order; Today's "Reorder" opens here with ?reorder=1.
  const { reorder } = useLocalSearchParams<{ reorder?: string }>();
  const [reorderAll, setReorderAll] = useState(reorder === "1");
  const lowCount = (family.parent.stock ?? []).filter((s) => s.low).length;
  // "Restock all": every low medicine gets what it needs (a course only up to its end), after a confirm.
  const restockList = (family.parent.stock ?? []).filter((s) => s.low && s.suggestedStrips > 0);
  // One tap from here once every low medicine has its Amazon product saved (in Reorder): all into one cart.
  const asinOf = (name: string) => family.parent.products?.find((x) => x.name.toLowerCase() === name.toLowerCase())?.amazonAsin;
  const amazonReady = restockList.length > 0 && restockList.every((s) => asinOf(s.name));
  const amazonUrl = amazonReady ? amazonCartUrl(restockList.map((s) => ({ asin: asinOf(s.name)!, quantity: s.suggestedStrips }))) : null;
  function askRestockAll() {
    const lines = restockList.map((s) => `${s.name}: +${s.suggestedStrips} ${s.suggestedStrips === 1 ? "strip" : "strips"}`).join("\n");
    confirm("Restock all?", `Add what you bought:\n${lines}`, "Add to stock", () =>
      save2(() => restockAll(restockList.map((s) => ({ id: s.id, packs: s.suggestedStrips })))),
    );
  }
  async function save2(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }
  const stockOf = (name: string) => family.parent.stock?.find((s) => s.name.toLowerCase() === name.toLowerCase());

  // Adherence from the calls: days the parent said they took everything.
  const days = family.calls.filter((c) => c.status === "connected" && c.outputs.meds_taken && c.outputs.meds_taken !== "unclear").slice(0, 30);
  const allTaken = days.filter((c) => c.outputs.meds_taken === "all").length;

  async function save(next: Medicine[]) {
    setBusy(true);
    setError("");
    try {
      await saveMedicines(next);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    if (!name.trim()) return;
    const n = family.medicines.length;
    const ok = await save([...family.medicines, { name: name.trim(), hint: hint.trim() || "Kin asks about it on every call", color: medColors[n % medColors.length], takenToday: null }]);
    if (ok) {
      setName("");
      setHint("");
      setAdding(false);
    }
  }

  function remove(m: Medicine) {
    Alert.alert(`Remove ${m.name}?`, "Kin will stop asking about it.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => save(family.medicines.filter((x) => x !== m)) },
    ]);
  }

  return (
    <Screen tabs={false}>
      <SubHeader kicker="Kin checks on every call" title="Medicines" />
      <View style={[gutter, { gap: 10, paddingHorizontal: 16 }]}>
        {family.medicines.length ? (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button variant={lowCount ? "primary" : "soft"} onPress={() => setReorderAll(true)}>
                {lowCount ? `Reorder (${lowCount} low)` : "Reorder"}
              </Button>
            </View>
            {restockList.length ? (
              <View style={{ flex: 1 }}>
                <Button variant="soft" onPress={askRestockAll} disabled={busy}>
                  {`Restock all (${restockList.length})`}
                </Button>
              </View>
            ) : null}
          </View>
        ) : null}
        {amazonUrl ? (
          <Button onPress={() => Linking.openURL(amazonUrl)}>{`Add all ${restockList.length} to the Amazon cart`}</Button>
        ) : null}

        {family.parent.medicine?.knownDays ? (
          <MedicineCalendar history={family.parent.medicine} name={family.parent.name} />
        ) : days.length ? (
          <Card style={styles.row}>
            <Ring value={allTaken / days.length} color={metric.green} size={64} stroke={8}>
              {`${Math.round((allTaken / days.length) * 100)}%`}
            </Ring>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>
                {allTaken} of {days.length} {days.length === 1 ? "call" : "calls"}
              </Text>
              <Text style={styles.sub}>All doses confirmed on the call</Text>
            </View>
          </Card>
        ) : null}

        {family.medicines.length === 0 && !adding ? (
          <Card>
            <Text style={styles.sub}>No medicines yet. Add them so Kin asks about each one by name.</Text>
          </Card>
        ) : null}

        {family.medicines.map((m) => (
          <Card key={m.name} style={styles.row} onPress={() => setOpen(m.name)}>
            <MedIcon tint={m.color} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{m.name}</Text>
              <Text style={styles.sub}>{m.hint}</Text>
              {(() => {
                const s = stockOf(m.name);
                return (
                  <Text style={[styles.stock, (!s || s.courseDone) && { color: color.body, fontWeight: "500" }, s?.low && { color: color.alert }]}>
                    {s ? stockLine(s) : "Tap to count stock and reorder"}
                  </Text>
                );
              })()}
            </View>
            <Pressable onLongPress={() => remove(m)} accessibilityHint="Long-press to remove">
              {m.takenToday === null ? <View style={styles.unknown} /> : <Check done={m.takenToday} />}
            </Pressable>
          </Card>
        ))}

        {adding ? (
          <Card style={{ gap: 10 }}>
            <TextInput value={name} onChangeText={setName} placeholder="Name and dose, e.g. Telmisartan 40 mg" placeholderTextColor={color.faint} style={styles.input} autoFocus />
            <TextInput value={hint} onChangeText={setHint} placeholder="When, e.g. after dinner" placeholderTextColor={color.faint} style={styles.input} />
            <Button onPress={add} disabled={!name.trim() || busy}>
              {busy ? "Saving…" : "Add medicine"}
            </Button>
          </Card>
        ) : (
          <Button variant="soft" onPress={() => setAdding(true)}>
            Add a medicine
          </Button>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <ReminderCalls />

        <Text style={styles.note}>
          Kin asks about each medicine by name on every call. Long-press a medicine&apos;s tick to remove it.
          {family.source === "api" ? " A tick shows when the last call confirmed all medicines." : ""}
        </Text>
      </View>
      <ReorderAll visible={reorderAll} onClose={() => setReorderAll(false)} />
      <StockSheet medicine={open} onClose={() => setOpen(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { fontSize: 16, fontWeight: "600", color: color.ink },
  sub: { fontSize: 13, lineHeight: 18, color: color.body },
  unknown: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderStyle: "dashed", borderColor: "rgba(34,35,38,0.2)" },
  input: { ...glass, height: 48, borderRadius: radius.input, paddingHorizontal: 14, fontSize: 16, color: color.ink, backgroundColor: "rgba(255,255,255,0.85)" },
  error: { paddingHorizontal: 4, fontSize: 14, color: color.alert },
  stock: { marginTop: 3, fontSize: 13, fontWeight: "600", color: color.ok },
  note: { paddingHorizontal: 4, fontSize: 13, lineHeight: 18, color: color.body },
});
