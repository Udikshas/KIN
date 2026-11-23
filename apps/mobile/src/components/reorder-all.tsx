import * as Clipboard from "expo-clipboard";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, SheetHeader } from "@/components/kit";
import { SHOPS, stockLine } from "@/components/stock-sheet";
import { amazonCartUrl } from "@/lib/data";
import { useKin } from "@/lib/kin";
import { color, glass, metric, radius } from "@/lib/theme";

// Several medicines in one order:
// - Amazon: the one shop whose links can fill a cart, so every ticked medicine with a
//   saved Amazon product goes into one cart in one tap (amazonCartUrl);
// - one WhatsApp message to the chemist with the whole list (one order);
// - Tata 1mg / PharmEasy / Apollo / Blinkit don't let other apps fill their cart, so a
//   guided pass adds each medicine to the same cart there (one checkout);
// - the list to share or paste. In-app ordering (MedPay) would come first later.

type Line = { name: string; strips: number; on: boolean; stockId?: string; detail?: string; low: boolean };

export function ReorderAll({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { family, saveParent, restockAll, saveProduct } = useKin();
  const parent = family.parent;
  const [lines, setLines] = useState<Line[]>([]);
  const [shop, setShop] = useState<number | null>(null);
  const [opened, setOpened] = useState<string[]>([]);
  const [chemist, setChemist] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    // Every medicine except finished courses; the ones running low ticked with what the API suggests
    // (about a month if ongoing, only what finishes a course). A course with enough at home stays unticked.
    const next = family.medicines.flatMap((m): Line[] => {
      const s = parent.stock?.find((x) => x.name.toLowerCase() === m.name.toLowerCase());
      if (s?.courseDone) return [];
      const strips = s ? Math.max(1, s.suggestedStrips) : 1;
      return [{ name: m.name, strips, on: Boolean(s?.low), stockId: s?.id, detail: s ? stockLine(s) : undefined, low: Boolean(s?.low) }];
    });
    next.sort((a, b) => Number(b.low) - Number(a.low));
    setLines(next);
    setShop(null);
    setOpened([]);
    setChemist(parent.chemistPhone ?? "");
    setNote("");
    // Rebuild only when the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return null;

  const chosen = lines.filter((l) => l.on);
  const update = (name: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.name === name ? { ...l, ...patch } : l)));
  const list = chosen.map((l, i) => `${i + 1}. ${l.name}: ${l.strips} ${l.strips === 1 ? "strip" : "strips"}`).join("\n");
  const message = `Namaste, please send these for ${parent.name}${parent.city ? ` (${parent.city})` : ""}:\n${list}\nThank you.`;
  const whatsapp = parent.chemistPhone ? `https://wa.me/${parent.chemistPhone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}` : null;
  const nextUp = shop === null ? null : chosen.find((l) => !opened.includes(l.name));
  const asinOf = (name: string) => parent.products?.find((x) => x.name.toLowerCase() === name.toLowerCase())?.amazonAsin;
  const onAmazon = chosen.filter((l) => asinOf(l.name));
  const notOnAmazon = chosen.filter((l) => !asinOf(l.name));
  const amazonUrl = onAmazon.length ? amazonCartUrl(onAmazon.map((l) => ({ asin: asinOf(l.name)!, quantity: l.strips }))) : null;

  function openNext() {
    if (shop === null || !nextUp) return;
    setOpened((o) => [...o, nextUp.name]);
    Linking.openURL(SHOPS[shop].url(nextUp.name));
  }

  // "Restock all": the ticked medicines' strips, in one go, once they're bought.
  const restockable = chosen.filter((l) => l.stockId);
  async function boughtAll() {
    setBusy(true);
    try {
      await restockAll(restockable.map((l) => ({ id: l.stockId!, packs: l.strips })));
      setNote(`Added to stock: ${restockable.map((l) => `${l.name} +${l.strips}`).join(", ")}.`);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not update stock.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <Pressable accessibilityLabel="Close" onPress={onClose} style={styles.scrim}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <SheetHeader title={`Reorder for ${parent.name}`} onClose={onClose} />
            <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
              <Text style={styles.sub}>
                Running low is ticked with what&apos;s needed: about a month, or only what finishes a course. Finished courses aren&apos;t listed.
              </Text>
              {restockable.length ? (
                <Button variant="soft" onPress={boughtAll} disabled={busy}>
                  {busy ? "Updating…" : `Bought them? Restock all ${restockable.length}`}
                </Button>
              ) : null}
              {note ? <Text style={[styles.hint, { color: color.ok }]}>{note}</Text> : null}

              {lines.map((l) => (
                <View key={l.name} style={[glass, styles.line]}>
                  <Pressable
                    onPress={() => update(l.name, { on: !l.on })}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: l.on }}
                    style={[styles.box, l.on && styles.boxOn]}
                  >
                    {l.on ? <Text style={styles.tick}>✓</Text> : null}
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{l.name}</Text>
                    {l.detail ? <Text style={[styles.detail, l.low && { color: color.alert }]}>{l.detail}</Text> : null}
                  </View>
                  <View style={styles.stepper}>
                    <Pressable onPress={() => update(l.name, { strips: Math.max(1, l.strips - 1) })} hitSlop={8} style={styles.step}>
                      <Text style={styles.stepText}>−</Text>
                    </Pressable>
                    <Text style={styles.count}>{l.strips}</Text>
                    <Pressable onPress={() => update(l.name, { strips: Math.min(20, l.strips + 1) })} hitSlop={8} style={styles.step}>
                      <Text style={styles.stepText}>+</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
              <Text style={styles.hint}>Numbers are strips.</Text>

              {chosen.length ? (
                <>
                  <Text style={styles.label}>All in one cart: Amazon</Text>
                  {amazonUrl ? (
                    <Button onPress={() => Linking.openURL(amazonUrl)}>
                      {onAmazon.length === chosen.length
                        ? `Add all ${chosen.length} to the Amazon cart`
                        : `Add ${onAmazon.length} of ${chosen.length} to the Amazon cart`}
                    </Button>
                  ) : null}
                  {notOnAmazon.map((l) => (
                    <AmazonLink key={l.name} name={l.name} onSave={(link) => saveProduct(l.name, link)} />
                  ))}

                  <Text style={styles.label}>One order to the chemist</Text>
                  {whatsapp ? (
                    <Button onPress={() => Linking.openURL(whatsapp)}>
                      {`Send all ${chosen.length} on WhatsApp`}
                    </Button>
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
                      <Button variant="soft" onPress={() => saveParent({ chemistPhone: chemist.trim() })} disabled={!chemist.trim()}>
                        Save the chemist
                      </Button>
                    </View>
                  )}

                  <Text style={styles.label}>One cart in a shop app</Text>
                  <View style={styles.chips}>
                    {SHOPS.map((s, i) => (
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
                        Each medicine opens in {SHOPS[shop].name}. Add it to the cart there, come back, and open the next. Then check out once.
                      </Text>
                      {chosen.map((l, i) => (
                        <Text key={l.name} style={[styles.guideLine, opened.includes(l.name) && { color: color.ok }]}>
                          {opened.includes(l.name) ? "✓" : `${i + 1}.`} {l.name} · {l.strips} {l.strips === 1 ? "strip" : "strips"}
                        </Text>
                      ))}
                      {nextUp ? (
                        <Button onPress={openNext}>
                          {`${chosen.indexOf(nextUp) + 1} of ${chosen.length}: open ${nextUp.name}`}
                        </Button>
                      ) : (
                        <Text style={[styles.sub, { color: color.ok, fontWeight: "600" }]}>
                          All {chosen.length} opened. Check out once in {SHOPS[shop].name}.
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

/** An item without its Amazon product yet: find it, paste its link once. Also used by groceries. */
export function AmazonLink({ name, onSave }: { name: string; onSave: (link: string) => Promise<void> }) {
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <View style={styles.amazon}>
      <Text style={styles.sub}>
        <Text style={{ fontWeight: "600", color: color.ink }}>{name}</Text> needs its Amazon link once.{" "}
        <Text style={styles.inlineLink} onPress={() => Linking.openURL(`https://www.amazon.in/s?k=${encodeURIComponent(name)}`)}>
          Find it on Amazon
        </Text>
        , tap Share, copy the link, and paste it here.
      </Text>
      <View style={styles.row}>
        <TextInput
          value={link}
          onChangeText={setLink}
          placeholder="amzn.in/d/… or amazon.in/…/dp/…"
          placeholderTextColor={color.faint}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.input, { flex: 1 }]}
        />
        <Pressable
          disabled={!link.trim() || busy}
          onPress={async () => {
            setBusy(true);
            setError("");
            try {
              await onSave(link.trim());
            } catch (e) {
              setError(e instanceof Error ? e.message : "Could not save the link.");
            } finally {
              setBusy(false);
            }
          }}
          style={[styles.save, (!link.trim() || busy) && { opacity: 0.4 }]}
        >
          <Text style={styles.saveText}>{busy ? "…" : "Save"}</Text>
        </Pressable>
      </View>
      {error ? <Text style={[styles.hint, { color: color.alert }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  amazon: { gap: 8, borderRadius: 18, padding: 12, backgroundColor: "rgba(235,240,248,0.85)" },
  inlineLink: { color: metric.blue, fontWeight: "600" },
  save: { height: 48, borderRadius: radius.input, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", backgroundColor: color.charcoal },
  saveText: { fontSize: 15, fontWeight: "600", color: "#fff" },
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  sheet: { maxHeight: "92%", backgroundColor: "#f4f7fb", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 22, paddingHorizontal: 16 },
  sub: { paddingHorizontal: 4, fontSize: 14, lineHeight: 20, color: color.body },
  label: { paddingHorizontal: 4, marginTop: 6, fontSize: 13, fontWeight: "600", color: color.body },
  hint: { paddingHorizontal: 4, fontSize: 12, color: color.faint },
  line: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 18, paddingVertical: 10, paddingHorizontal: 12 },
  box: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: "rgba(34,35,38,0.25)", alignItems: "center", justifyContent: "center" },
  boxOn: { backgroundColor: color.charcoal, borderColor: color.charcoal },
  tick: { color: "#fff", fontSize: 14, fontWeight: "700" },
  name: { fontSize: 15, fontWeight: "600", color: color.ink },
  detail: { marginTop: 1, fontSize: 12, color: color.body },
  stepper: { flexDirection: "row", alignItems: "center", gap: 6 },
  step: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(34,35,38,0.07)" },
  stepText: { fontSize: 18, fontWeight: "600", color: color.ink },
  count: { minWidth: 20, textAlign: "center", fontSize: 16, fontWeight: "700", color: color.ink },
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
