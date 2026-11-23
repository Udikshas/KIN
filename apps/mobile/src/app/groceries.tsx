import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { confirm } from "@/components/kin-call";
import { GroceryOrder } from "@/components/grocery-order";
import { Button, Card, SectionLabel } from "@/components/kit";
import { gutter, Screen, SubHeader } from "@/components/screen";
import { amazonCartUrl, formatDay, USUAL_GROCERIES, type GroceryItem } from "@/lib/data";
import { useKin } from "@/lib/kin";
import { color, glass, radius } from "@/lib/theme";

// Monthly groceries for the parent's home (apps/api/app/groceries.py): each item comes due
// on its own cycle after it was last bought; only what's due is suggested.

const EVERY: { days: number; label: string }[] = [
  { days: 7, label: "Weekly" },
  { days: 14, label: "2 weeks" },
  { days: 21, label: "3 weeks" },
  { days: 30, label: "Monthly" },
  { days: 60, label: "2 months" },
];
const everyLabel = (d: number) => EVERY.find((e) => e.days === d)?.label.toLowerCase() ?? `every ${d} days`;

function when(g: GroceryItem) {
  if (g.overdue) return `Overdue since ${formatDay(g.dueOn)}`;
  if (g.due) return g.lastBoughtOn ? `Due ${formatDay(g.dueOn) === "Today" ? "today" : formatDay(g.dueOn)}` : "Due now";
  return `Next due ${formatDay(g.dueOn)}`;
}

export default function Groceries() {
  const { family, addGroceries, updateGrocery, removeGrocery, groceriesBought } = useKin();
  const parent = family.parent;
  const items = parent.groceries ?? [];
  const due = items.filter((g) => g.due);
  const later = items.filter((g) => !g.due);
  // One tap from here once every due item has its Amazon product saved (in Order): all into one cart.
  const amazonUrl = due.length && due.every((g) => g.amazonAsin) ? amazonCartUrl(due.map((g) => ({ asin: g.amazonAsin!, quantity: 1 }))) : null;
  const { order } = useLocalSearchParams<{ order?: string }>();
  const [ordering, setOrdering] = useState(order === "1");
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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

  function row(g: GroceryItem) {
    const open = editing === g.id;
    return (
      <Card key={g.id} style={{ gap: 10 }} onPress={() => setEditing(open ? null : g.id)}>
        <View style={styles.rowTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>
              {g.name}
              {g.qty ? <Text style={styles.qty}>  {g.qty}</Text> : null}
            </Text>
            <Text style={[styles.sub, g.overdue && { color: color.alert }, g.due && !g.overdue && { color: color.watch }]}>
              {when(g)} · {everyLabel(g.everyDays)}
            </Text>
          </View>
          {g.due ? (
            <Pressable onPress={() => run(() => groceriesBought([g.id]))} hitSlop={8} style={[glass, styles.small]}>
              <Text style={styles.smallText}>Bought</Text>
            </Pressable>
          ) : null}
        </View>
        {open ? (
          <View style={{ gap: 8 }}>
            <View style={styles.chips}>
              {EVERY.map((e) => (
                <Pressable
                  key={e.days}
                  onPress={() => run(() => updateGrocery(g.id, { everyDays: e.days }))}
                  style={[g.everyDays === e.days ? styles.chipOn : glass, styles.chip]}
                >
                  <Text style={[styles.chipText, g.everyDays === e.days && { color: "#fff" }]}>{e.label}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={() => run(() => removeGrocery(g.id))}>
              <Text style={styles.remove}>Remove {g.name}</Text>
            </Pressable>
          </View>
        ) : null}
      </Card>
    );
  }

  return (
    <Screen tabs={false}>
      <SubHeader kicker={`Regular shopping for ${parent.name}`} title="Groceries" />
      <View style={[gutter, { gap: 10, paddingHorizontal: 16 }]}>
        {items.length ? (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button variant={due.length ? "primary" : "soft"} onPress={() => setOrdering(true)}>
                {due.length ? `Order (${due.length} due)` : "Order"}
              </Button>
            </View>
            {due.length ? (
              <View style={{ flex: 1 }}>
                <Button
                  variant="soft"
                  disabled={busy}
                  onPress={() =>
                    confirm("Mark all due as bought?", due.map((g) => `${g.name}${g.qty ? ` (${g.qty})` : ""}`).join("\n"), "Mark bought", () =>
                      run(() => groceriesBought(due.map((g) => g.id))),
                    )
                  }
                >
                  {`Bought all (${due.length})`}
                </Button>
              </View>
            ) : null}
          </View>
        ) : (
          <Card style={{ gap: 10 }}>
            <Text style={styles.sub}>
              Keep {parent.name}&apos;s home stocked: add what they buy every month, and Kin reminds you a few days before each is due.
            </Text>
            <Button
              onPress={() => run(() => addGroceries(USUAL_GROCERIES.map((u) => ({ name: u.name, qty: u.qty, everyDays: u.everyDays }))))}
              disabled={busy}
            >
              Add the usual list
            </Button>
          </Card>
        )}

        {amazonUrl ? <Button onPress={() => Linking.openURL(amazonUrl)}>{`Add all ${due.length} to the Amazon cart`}</Button> : null}

        {due.length ? <SectionLabel>{`Due this week (${due.length})`}</SectionLabel> : null}
        {due.map(row)}
        {later.length ? <SectionLabel>Later</SectionLabel> : null}
        {later.map(row)}

        <Card style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput value={name} onChangeText={setName} placeholder="Add an item, e.g. Besan" placeholderTextColor={color.faint} style={[styles.input, { flex: 2, minWidth: 0 }]} />
            <TextInput value={qty} onChangeText={setQty} placeholder="1 kg" placeholderTextColor={color.faint} style={[styles.input, { flex: 1, minWidth: 0 }]} />
          </View>
          <Button
            variant="soft"
            disabled={!name.trim() || busy}
            onPress={async () => {
              if (await run(() => addGroceries([{ name: name.trim(), qty: qty.trim() || null, everyDays: 30 }]))) {
                setName("");
                setQty("");
              }
            }}
          >
            Add (monthly)
          </Button>
        </Card>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Text style={styles.note}>
          Tap an item to change how often it&apos;s bought or remove it. &ldquo;Bought&rdquo; starts its next cycle; Kin only suggests what&apos;s due.
        </Text>
      </View>
      <GroceryOrder visible={ordering} onClose={() => setOrdering(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { fontSize: 16, fontWeight: "600", color: color.ink },
  qty: { fontSize: 14, fontWeight: "500", color: color.body },
  sub: { marginTop: 2, fontSize: 13, lineHeight: 18, color: color.body },
  small: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  smallText: { fontSize: 14, fontWeight: "600", color: color.ink },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipOn: { backgroundColor: color.charcoal },
  chipText: { fontSize: 13, fontWeight: "600", color: color.ink },
  remove: { fontSize: 14, fontWeight: "600", color: color.alert },
  input: { ...glass, height: 48, borderRadius: radius.input, paddingHorizontal: 14, fontSize: 16, color: color.ink, backgroundColor: "rgba(255,255,255,0.85)" },
  error: { paddingHorizontal: 4, fontSize: 14, color: color.alert },
  note: { paddingHorizontal: 4, fontSize: 13, lineHeight: 18, color: color.body },
});
