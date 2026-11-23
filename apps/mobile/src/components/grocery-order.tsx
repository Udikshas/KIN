import * as Clipboard from "expo-clipboard";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, SheetHeader } from "@/components/kit";
import { AmazonLink } from "@/components/reorder-all";
import { amazonCartUrl, formatDay } from "@/lib/data";
import { useKin } from "@/lib/kin";
import { color, glass, radius } from "@/lib/theme";

// One grocery order for the parent's home (apps/api/app/groceries.py): what's due is ticked.
// - Amazon: every ticked item into one cart in one tap (each item's Amazon product saved once);
// - one WhatsApp message to the local kirana with the whole list;
// - Blinkit / Zepto / BigBasket / Instamart can't be filled from outside, so a guided pass
//   adds each item to the same cart there;
// - or the list to share. "Bought them?" starts each item's next cycle.

export const GROCERY_SHOPS = [
  { name: "Blinkit", url: (q: string) => `https://blinkit.com/s/?q=${encodeURIComponent(q)}` },
  { name: "Zepto", url: (q: string) => `https://www.zeptonow.com/search?query=${encodeURIComponent(q)}` },
  { name: "BigBasket", url: (q: string) => `https://www.bigbasket.com/ps/?q=${encodeURIComponent(q)}` },
  { name: "Instamart", url: (q: string) => `https://www.swiggy.com/instamart/search?query=${encodeURIComponent(q)}` },
];

export function GroceryOrder({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { family, saveParent, groceriesBought, setGroceryAmazon } = useKin();
  const parent = family.parent;
  const items = parent.groceries ?? [];
  const [ticked, setTicked] = useState<string[]>([]);
  const [shop, setShop] = useState<number | null>(null);
  const [opened, setOpened] = useState<string[]>([]);
  const [kirana, setKirana] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTicked(items.filter((g) => g.due).map((g) => g.id)); // only what's due, never the whole list
    setShop(null);
    setOpened([]);
    setKirana(parent.kiranaPhone ?? "");
    setNote("");
    // Rebuild only when the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return null;

  const chosen = items.filter((g) => ticked.includes(g.id));
  const label = (g: (typeof items)[number]) => `${g.name}${g.qty ? ` (${g.qty})` : ""}`;
  const message = `Namaste, please send these for ${parent.name}${parent.city ? ` (${parent.city})` : ""}:\n${chosen
    .map((g, i) => `${i + 1}. ${label(g)}`)
    .join("\n")}\nThank you.`;
  const whatsapp = parent.kiranaPhone ? `https://wa.me/${parent.kiranaPhone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}` : null;
  const nextUp = shop === null ? null : chosen.find((g) => !opened.includes(g.id));
  const onAmazon = chosen.filter((g) => g.amazonAsin);
  const notOnAmazon = chosen.filter((g) => !g.amazonAsin);
  const amazonUrl = onAmazon.length ? amazonCartUrl(onAmazon.map((g) => ({ asin: g.amazonAsin!, quantity: 1 }))) : null;

  async function markBought() {
    setBusy(true);
    try {
      await groceriesBought(chosen.map((g) => g.id));
      setNote(`Marked bought: ${chosen.map((g) => g.name).join(", ")}. Each comes round again on its own schedule.`);
      setTicked([]);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <Pressable accessibilityLabel="Close" onPress={onClose} style={styles.scrim}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <SheetHeader title={`Groceries for ${parent.name}`} onClose={onClose} />
            <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
              <Text style={styles.sub}>What&apos;s due is ticked. Tick anything else you want in the same order.</Text>
              {chosen.length ? (
                <Button variant="soft" onPress={markBought} disabled={busy}>
                  {busy ? "Saving…" : `Bought them? Mark ${chosen.length} bought`}
                </Button>
              ) : null}
              {note ? <Text style={[styles.hint, { color: color.ok }]}>{note}</Text> : null}

              {items.map((g) => {
                const on = ticked.includes(g.id);
                return (
                  <Pressable
                    key={g.id}
                    onPress={() => setTicked((t) => (on ? t.filter((x) => x !== g.id) : [...t, g.id]))}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    style={[glass, styles.line]}
                  >
                    <View style={[styles.box, on && styles.boxOn]}>{on ? <Text style={styles.tick}>✓</Text> : null}</View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{label(g)}</Text>
                      <Text style={[styles.detail, g.overdue && { color: color.alert }]}>
                        {g.due ? (g.overdue ? "Overdue" : "Due") : `Next due ${formatDay(g.dueOn)}`}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}

              {chosen.length ? (
                <>
                  <Text style={styles.label}>All at once: Amazon cart</Text>
                  {amazonUrl ? (
                    <Button onPress={() => Linking.openURL(amazonUrl)}>
                      {onAmazon.length === chosen.length
                        ? `Add all ${chosen.length} to the Amazon cart`
                        : `Add ${onAmazon.length} of ${chosen.length} to the Amazon cart`}
                    </Button>
                  ) : null}
                  {notOnAmazon.map((g) => (
                    <AmazonLink key={g.id} name={label(g)} onSave={(link) => setGroceryAmazon(g.id, link)} />
                  ))}

                  <Text style={styles.label}>All at once: WhatsApp the kirana</Text>
                  {whatsapp ? (
                    <Button onPress={() => Linking.openURL(whatsapp)}>{`Send all ${chosen.length} on WhatsApp`}</Button>
                  ) : (
                    <View style={{ gap: 8 }}>
                      <TextInput
                        value={kirana}
                        onChangeText={setKirana}
                        placeholder="Kirana shop's WhatsApp number"
                        placeholderTextColor={color.faint}
                        keyboardType="phone-pad"
                        style={styles.input}
                      />
                      <Button variant="soft" onPress={() => saveParent({ kiranaPhone: kirana.trim() })} disabled={!kirana.trim()}>
                        Save the shop
                      </Button>
                    </View>
                  )}

                  <Text style={styles.label}>One by one into one cart (these apps don&apos;t allow adding all at once)</Text>
                  <View style={styles.chips}>
                    {GROCERY_SHOPS.map((s, i) => (
                      <Pressable
                        key={s.name}
                        onPress={() => {
                          setShop(i);
                          setOpened([]);
                        }}
                        style={[shop === i ? styles.chipOn : glass, styles.chip]}
                      >
                        <Text style={[styles.chipText, shop === i && { color: "#fff" }]}>{s.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                  {shop !== null ? (
                    <View style={styles.guide}>
                      <Text style={styles.sub}>
                        Each item opens in {GROCERY_SHOPS[shop].name}. Add it to the cart there, come back, open the next, then check out once.
                      </Text>
                      {chosen.map((g, i) => (
                        <Text key={g.id} style={[styles.guideLine, opened.includes(g.id) && { color: color.ok }]}>
                          {opened.includes(g.id) ? "✓" : `${i + 1}.`} {label(g)}
                        </Text>
                      ))}
                      {nextUp ? (
                        <Button
                          onPress={() => {
                            setOpened((o) => [...o, nextUp.id]);
                            Linking.openURL(GROCERY_SHOPS[shop].url(nextUp.name));
                          }}
                        >
                          {`${chosen.indexOf(nextUp) + 1} of ${chosen.length}: open ${nextUp.name}`}
                        </Button>
                      ) : (
                        <Text style={[styles.sub, { color: color.ok, fontWeight: "600" }]}>
                          All {chosen.length} opened. Check out once in {GROCERY_SHOPS[shop].name}.
                        </Text>
                      )}
                    </View>
                  ) : null}

                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Button variant="soft" onPress={() => Share.share({ message })}>
                        Share the list
                      </Button>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button
                        variant="soft"
                        onPress={async () => {
                          await Clipboard.setStringAsync(message);
                          setNote("List copied.");
                        }}
                      >
                        Copy the list
                      </Button>
                    </View>
                  </View>
                </>
              ) : null}

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
  sheet: { maxHeight: "92%", backgroundColor: "#f4f7fb", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 22, paddingHorizontal: 16 },
  sub: { paddingHorizontal: 4, fontSize: 14, lineHeight: 20, color: color.body },
  label: { paddingHorizontal: 4, marginTop: 6, fontSize: 13, fontWeight: "600", color: color.body },
  hint: { paddingHorizontal: 4, fontSize: 13, lineHeight: 18, color: color.faint },
  line: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 18, paddingVertical: 10, paddingHorizontal: 12 },
  box: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: "rgba(34,35,38,0.25)", alignItems: "center", justifyContent: "center" },
  boxOn: { backgroundColor: color.charcoal, borderColor: color.charcoal },
  tick: { color: "#fff", fontSize: 14, fontWeight: "700" },
  name: { fontSize: 15, fontWeight: "600", color: color.ink },
  detail: { marginTop: 1, fontSize: 12, color: color.body },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  chipOn: { backgroundColor: color.charcoal },
  chipText: { fontSize: 14, fontWeight: "600", color: color.ink },
  guide: { gap: 6, borderRadius: 18, padding: 12, backgroundColor: "rgba(235,240,248,0.85)" },
  guideLine: { paddingHorizontal: 4, fontSize: 14, color: color.ink },
  row: { flexDirection: "row", gap: 8, marginTop: 4 },
  input: { ...glass, height: 48, borderRadius: radius.input, paddingHorizontal: 14, fontSize: 16, color: color.ink, backgroundColor: "rgba(255,255,255,0.9)" },
  doneBar: { paddingTop: 12 },
});
