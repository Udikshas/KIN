import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, SheetHeader } from "@/components/kit";
import { formatDay, type StockItem } from "@/lib/data";
import { useKin } from "@/lib/kin";
import { color, glass, metric, radius } from "@/lib/theme";

// One medicine's stock and how to get more (apps/api/app/stock.py). Ordering happens
// outside Kin for now: the chemist on WhatsApp with the order written out, or a
// pharmacy app's search. In-app ordering (MedPay) will slot in at the top.

const PER_DAY = [0.5, 1, 2, 3];
const PACKS = [10, 15, 30];
const COURSE = [null, 3, 5, 7, 10, 14] as const; // days prescribed from today; null = ongoing

/** Pharmacy apps' search pages for a medicine name. */
export const SHOPS = [
  { name: "Tata 1mg", url: (q: string) => `https://www.1mg.com/search/all?name=${encodeURIComponent(q)}` },
  { name: "PharmEasy", url: (q: string) => `https://pharmeasy.in/search/all?name=${encodeURIComponent(q)}` },
  { name: "Apollo 24|7", url: (q: string) => `https://www.apollopharmacy.in/search-medicines/${encodeURIComponent(q)}` },
  { name: "Blinkit", url: (q: string) => `https://blinkit.com/s/?q=${encodeURIComponent(q)}` },
];

export function stockLine(s: StockItem) {
  const ends = s.courseEndsOn ? formatDay(s.courseEndsOn) : "";
  if (s.courseDone) return `Course finished${ends ? ` (${ends})` : ""}`;
  const tablets = `${s.left} ${s.left === 1 ? "tablet" : "tablets"} left`;
  if (s.enoughForCourse) return `${tablets} · enough to finish the course${ends ? ` (${ends === "Today" ? "today" : ends})` : ""}`;
  if (s.left <= 0) return s.courseEndsOn ? `Run out · course ends ${ends}` : "Run out";
  const when = s.runsOutOn ? formatDay(s.runsOutOn) : "";
  return `${tablets}${when ? ` · runs out ${when === "Today" ? "today" : when}` : ""}${s.courseEndsOn ? ` · course ends ${ends}` : ""}`;
}

/** What to buy, in words: only what finishes a course; about a month if ongoing. */
export function buyLine(s: StockItem) {
  if (s.courseDone) return "The course is over: nothing to buy.";
  if (!s.suggestedStrips) return s.courseEndsOn ? "Enough at home to finish the course: nothing to buy." : "Enough for the next month.";
  const strips = `${s.suggestedStrips} ${s.suggestedStrips === 1 ? "strip" : "strips"}`;
  return s.courseEndsOn ? `To finish the course: ${strips}.` : `For about a month: ${strips}.`;
}

export function StockSheet({ medicine, onClose }: { medicine: string | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { family, setStock, restock, saveParent } = useKin();
  const parent = family.parent;
  const item = medicine ? parent.stock?.find((s) => s.name.toLowerCase() === medicine.toLowerCase()) : undefined;
  const [perDay, setPerDay] = useState(1);
  const [pack, setPack] = useState(10);
  const [courseDays, setCourseDays] = useState<number | null>(null);
  const [count, setCount] = useState("");
  const [counting, setCounting] = useState(false);
  const [chemist, setChemist] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!medicine) return;
    setPerDay(item?.perDay ?? 1);
    setPack(item?.packSize ?? 10);
    setCourseDays(null);
    setCount("");
    setCounting(!item);
    setChemist(parent.chemistPhone ?? "");
    setError("");
    // Reset only when a different medicine opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medicine]);

  if (!medicine) return null;

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

  const tablets = Number(count);
  const strips = Math.max(1, Math.ceil(((item?.perDay ?? perDay) * 30) / (item?.packSize ?? pack))); // about a month
  const order = `Namaste, please send ${strips} ${strips === 1 ? "strip" : "strips"} of ${medicine} for ${parent.name}${parent.city ? ` (${parent.city})` : ""}. Thank you.`;
  const whatsapp = parent.chemistPhone ? `https://wa.me/${parent.chemistPhone.replace(/\D/g, "")}?text=${encodeURIComponent(order)}` : null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <Pressable accessibilityLabel="Close" onPress={onClose} style={styles.scrim}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <SheetHeader title={medicine ?? ""} onClose={onClose} />
            <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
              <Text style={[styles.status, item?.low && { color: color.alert }]}>
                {item ? stockLine(item) : "Not counted yet. Count what's at home and Kin warns you before it runs out."}
              </Text>

              {item && !counting ? (
                <>
                  <Text style={styles.note}>{buyLine(item)}</Text>
                  <Text style={styles.label}>Bought more?</Text>
                  <View style={styles.chips}>
                    {[1, 2, 3].map((n) => (
                      <Pressable key={n} disabled={busy} onPress={() => run(() => restock(item.id, n))} style={[glass, styles.chip]}>
                        <Text style={styles.chipText}>
                          +{n} {n === 1 ? "strip" : "strips"} ({n * item.packSize})
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Pressable onPress={() => setCounting(true)}>
                    <Text style={styles.link}>Count again</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.label}>Tablets a day</Text>
                  <View style={styles.chips}>
                    {PER_DAY.map((n) => (
                      <Pressable key={n} onPress={() => setPerDay(n)} style={[perDay === n ? styles.chipOn : glass, styles.chip]}>
                        <Text style={[styles.chipText, perDay === n && { color: "#fff" }]}>{n === 0.5 ? "½" : n}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={styles.label}>Prescribed for</Text>
                  <View style={styles.chips}>
                    {COURSE.map((n) => (
                      <Pressable key={String(n)} onPress={() => setCourseDays(n)} style={[courseDays === n ? styles.chipOn : glass, styles.chip]}>
                        <Text style={[styles.chipText, courseDays === n && { color: "#fff" }]}>{n === null ? "Ongoing" : `${n} days`}</Text>
                      </Pressable>
                    ))}
                  </View>
                  {courseDays ? (
                    <Text style={styles.note}>
                      Counting today. Kin only reminds you to buy what finishes these {courseDays} days, and stops after.
                    </Text>
                  ) : null}
                  <Text style={styles.label}>Tablets in a strip</Text>
                  <View style={styles.chips}>
                    {PACKS.map((n) => (
                      <Pressable key={n} onPress={() => setPack(n)} style={[pack === n ? styles.chipOn : glass, styles.chip]}>
                        <Text style={[styles.chipText, pack === n && { color: "#fff" }]}>{n}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <TextInput
                    value={count}
                    onChangeText={(t) => setCount(t.replace(/[^\d]/g, ""))}
                    placeholder={`Tablets at home now, e.g. ${pack * 2}`}
                    placeholderTextColor={color.faint}
                    keyboardType="number-pad"
                    style={styles.input}
                  />
                  <Button
                    onPress={async () => {
                      if (await run(() => setStock({ name: medicine, perDay, packSize: pack, tablets, courseDays }))) setCounting(false);
                    }}
                    disabled={count === "" || busy}
                  >
                    {busy ? "Saving…" : "Save count"}
                  </Button>
                </>
              )}

              <Text style={[styles.label, { marginTop: 6 }]}>Reorder</Text>
              {whatsapp ? (
                <Button onPress={() => Linking.openURL(whatsapp)}>Message the chemist on WhatsApp</Button>
              ) : (
                <View style={{ gap: 8 }}>
                  <TextInput
                    value={chemist}
                    onChangeText={setChemist}
                    placeholder="Chemist's WhatsApp number"
                    placeholderTextColor={color.faint}
                    keyboardType="phone-pad"
                    style={styles.input}
                  />
                  <Button variant="soft" onPress={() => run(() => saveParent({ chemistPhone: chemist.trim() }))} disabled={!chemist.trim() || busy}>
                    Save the chemist
                  </Button>
                </View>
              )}
              {whatsapp ? <Text style={styles.note}>&ldquo;{order}&rdquo;</Text> : null}
              <View style={styles.chips}>
                {SHOPS.map((s) => (
                  <Pressable key={s.name} onPress={() => Linking.openURL(s.url(medicine))} style={[glass, styles.chip]}>
                    <Text style={styles.chipText}>{s.name}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.note}>These open the shop&apos;s own app or site; you order and pay there. Tap &ldquo;Bought more&rdquo; when it arrives.</Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </ScrollView>
            {/* Always in view, under whatever scrolls. */}
            <View style={styles.doneBar}>
              <Button onPress={onClose}>Done</Button>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  sheet: { maxHeight: "88%", backgroundColor: "#f4f7fb", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 22, paddingHorizontal: 16 },
  status: { paddingHorizontal: 4, fontSize: 15, lineHeight: 21, color: color.body },
  label: { paddingHorizontal: 4, fontSize: 13, fontWeight: "600", color: color.body },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  chipOn: { backgroundColor: color.charcoal },
  chipText: { fontSize: 14, fontWeight: "600", color: color.ink },
  input: { ...glass, height: 48, borderRadius: radius.input, paddingHorizontal: 14, fontSize: 16, color: color.ink, backgroundColor: "rgba(255,255,255,0.9)" },
  link: { paddingHorizontal: 4, fontSize: 15, fontWeight: "600", color: metric.blue },
  note: { paddingHorizontal: 4, fontSize: 13, lineHeight: 18, color: color.body },
  error: { paddingHorizontal: 4, fontSize: 14, color: color.alert },
  doneBar: { paddingTop: 12 },
});
