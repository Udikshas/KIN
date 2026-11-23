import { Children, Fragment, useState, type ReactNode } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { color, glass } from "@/lib/theme";
import { countries, countryLabel, groupDigits, phoneDigits, type Country } from "@/lib/validate";

import { Toggle } from "./field";
import { Flag } from "./flag";
import { Avatar, avatarNames, GlassButton, Icon, icon } from "./kit";
import { goBack } from "./screen";

// iOS Settings-style building blocks for edit screens (profile, family member):
// a compact nav bar, an avatar hero, and grouped glass sections of rows.

const noOutline = Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null;

/** Back (or ✕ on a sheet) button, centred title, and an action (e.g. Save) on one line. */
export function NavBar({ title, right, sheet = false }: { title: string; right?: ReactNode; sheet?: boolean }) {
  return (
    <View style={styles.nav}>
      <View style={styles.navSide}>
        <GlassButton label={sheet ? "Close" : "Back"} onPress={goBack}>
          <Icon d={sheet ? icon.close : icon.back} />
        </GlassButton>
      </View>
      <Text numberOfLines={1} style={styles.navTitle}>
        {title}
      </Text>
      <View style={[styles.navSide, { alignItems: "flex-end" }]}>{right}</View>
    </View>
  );
}

/** "+919876543210" → "+91 98765 43210" (Indian mobiles); other numbers unchanged. */
export function formatPhone(phone: string) {
  const m = /^\+91(\d{5})(\d{5})$/.exec(phone.replace(/\s/g, ""));
  return m ? `+91 ${m[1]} ${m[2]}` : phone;
}

/** Small dark pill for the nav bar. */
export function NavAction({ children, onPress, disabled }: { children: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => [styles.navAction, disabled && { opacity: 0.4 }, pressed && { opacity: 0.7 }]}
    >
      <Text style={styles.navActionText}>{children}</Text>
    </Pressable>
  );
}

/** Large avatar with an edit badge, the name and one line under it. */
export function ProfileHero({ avatar, name, sub, onEdit }: { avatar?: string; name: string; sub?: string; onEdit: () => void }) {
  return (
    <View style={styles.hero}>
      <Pressable accessibilityRole="button" accessibilityLabel="Change picture" onPress={onEdit} style={({ pressed }) => pressed && { opacity: 0.8 }}>
        <View style={styles.heroRing}>
          <Avatar name={avatar ?? name} size={88} />
        </View>
        <View style={styles.badge}>
          <Icon d={icon.pencil} size={13} width={2.2} color="#fff" />
        </View>
      </Pressable>
      <Text numberOfLines={1} style={styles.heroName}>
        {name}
      </Text>
      {sub ? <Text style={styles.heroSub}>{sub}</Text> : null}
    </View>
  );
}

/** A titled glass card of rows, separated by hairlines, with an optional note under it. */
export function Section({
  title,
  footer,
  footerTone,
  children,
}: {
  title?: string;
  footer?: ReactNode;
  footerTone?: "alert";
  children: ReactNode;
}) {
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.section}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      <View style={[glass, styles.card]}>
        {rows.map((r, i) => (
          <Fragment key={i}>
            {i > 0 ? <View style={styles.hairline} /> : null}
            {r}
          </Fragment>
        ))}
      </View>
      {footer ? <Text style={[styles.footer, footerTone === "alert" && { color: color.alert }]}>{footer}</Text> : null}
    </View>
  );
}

export function InputRow({ label, style, ...props }: { label: string } & TextInputProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <TextInput placeholderTextColor={color.faint} style={[styles.input, noOutline, props.editable === false && { color: color.body }, style]} {...props} />
    </View>
  );
}

type PhoneProps = {
  label?: string;
  digits: string;
  country: Country;
  onChange: (digits: string) => void;
  /** Lets them pick the country code; without it the code is a fixed chip (parents: India only). */
  onCountry?: (c: Country) => void;
  invalid?: boolean;
  onBlur?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
};

/**
 * Country code chip + number. Holds local digits only and spaces them as you
 * type; pasting "+91 98765-43210" or "098765 43210" works too.
 */
export function PhoneInput({ label = "Phone", digits, country, onChange, onCountry, invalid, onBlur, placeholder, autoFocus, align = "right" }: PhoneProps & { align?: "left" | "right" }) {
  const [picking, setPicking] = useState(false);
  const shown = groupDigits(digits, country);
  const change = (text: string) => {
    const next = phoneDigits(text, country);
    // Backspace over a space only removes the space; take the digit before it too.
    onChange(next === digits && text.length < shown.length ? next.slice(0, -1) : next);
  };
  const chip = (
    <View style={styles.dialChip}>
      <Flag id={country.id} size={18} />
      <Text style={styles.dialCode}>{country.dial}</Text>
      {onCountry ? (
        <View style={{ transform: [{ rotate: "90deg" }] }}>
          <Icon d={icon.chevron} size={11} width={2.4} color={color.body} />
        </View>
      ) : null}
    </View>
  );
  return (
    <View style={[styles.phoneRight, align === "left" && { justifyContent: "flex-start" }]}>
      {onCountry ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Country code ${country.dial}, change`} hitSlop={6} onPress={() => setPicking(true)}>
          {chip}
        </Pressable>
      ) : (
        chip
      )}
      <TextInput
        value={shown}
        onChangeText={change}
        onBlur={onBlur}
        autoFocus={autoFocus}
        placeholder={placeholder ?? groupDigits(country.example, country)}
        placeholderTextColor={color.faint}
        keyboardType="number-pad"
        inputMode="numeric"
        textContentType="telephoneNumber"
        autoComplete="tel"
        maxLength={country.length + country.groups.length + 12}
        accessibilityLabel={`${label}, ${country.length} digits after ${country.dial}`}
        style={[styles.input, styles.phoneInput, align === "left" && { textAlign: "left" }, noOutline, invalid && { color: color.alert }]}
      />
      {onCountry ? (
        <PickerSheet
          visible={picking}
          title="Country code"
          options={countries.map(countryLabel)}
          value={countryLabel(country)}
          onChange={(l) => {
            const c = countries.find((x) => countryLabel(x) === l)!;
            onCountry(c);
            onChange(phoneDigits(digits, c));
          }}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </View>
  );
}

/** Settings-style row: label on the left, country code + number on the right. */
export function PhoneRow(props: PhoneProps) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, props.invalid && { color: color.alert }]}>{props.label ?? "Phone"}</Text>
      <PhoneInput {...props} />
    </View>
  );
}

/** Label + value; with onPress it shows a chevron and opens something (a picker). */
export function ValueRow({ label, value, onPress }: { label: string; value: string; onPress?: () => void }) {
  const inner = (
    <>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text numberOfLines={1} style={[styles.value, !onPress && { color: color.body }]}>
        {value}
      </Text>
      {onPress ? <Icon d={icon.chevron} size={14} color={color.faint} /> : null}
    </>
  );
  if (!onPress) return <View style={styles.row}>{inner}</View>;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      {inner}
    </Pressable>
  );
}

export function ToggleRow({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (v: boolean) => void }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { flex: 1 }]}>{label}</Text>
      <Toggle value={value} onValueChange={onValueChange} />
    </View>
  );
}

/** One item of an editable list (e.g. a topic Kin avoids), with a round ✕ to remove it. */
export function RemovableRow({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { flex: 1 }]}>{label}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${label}`} onPress={onRemove} hitSlop={10} style={styles.remove}>
        <Icon d={icon.close} size={12} color={color.body} />
      </Pressable>
    </View>
  );
}

/** A text field that adds what was typed to a list: Return or the Add button. */
export function AddRow({ placeholder, onAdd, maxLength }: { placeholder: string; onAdd: (text: string) => void; maxLength?: number }) {
  const [text, setText] = useState("");
  const add = () => {
    if (!text.trim()) return;
    onAdd(text.trim());
    setText("");
  };
  return (
    <View style={styles.row}>
      <Icon d={icon.plus} size={16} color={color.faint} />
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor={color.faint}
        maxLength={maxLength}
        returnKeyType="done"
        submitBehavior="submit"
        onSubmitEditing={add}
        style={[styles.input, noOutline, { textAlign: "left" }]}
      />
      {text.trim() ? (
        <Pressable accessibilityRole="button" onPress={add} hitSlop={8}>
          <Text style={styles.addText}>Add</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** A full-width tappable line, e.g. "Call Rahul" or a red "Remove". */
export function ActionRow({ label, onPress, tone = "ink", disabled }: { label: string; onPress: () => void; tone?: "ink" | "alert"; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed, disabled && { opacity: 0.5 }]}
    >
      <Text style={[styles.rowLabel, { color: tone === "alert" ? color.alert : color.ink }]}>{label}</Text>
    </Pressable>
  );
}

/** Label on the left, a compact segmented control on the right. */
export function SegmentRow<T extends string | number>({
  label,
  options,
  value,
  onChange,
  render = (o) => String(o),
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  render?: (o: T) => string;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { flex: 1 }]}>{label}</Text>
      <View style={styles.segment}>
        {options.map((o) => {
          const on = o === value;
          return (
            <Pressable key={String(o)} onPress={() => onChange(o)} accessibilityState={{ selected: on }} style={[styles.seg, on && styles.segOn]}>
              <Text style={[styles.segText, on && { color: color.ink }]}>{render(o)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Bottom sheet with a title; tap outside to close. */
export function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close" onPress={onClose} style={styles.scrim}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.grabber} />
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
              <Text style={styles.done}>Done</Text>
            </Pressable>
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Pick one option from a list, iOS-style with a check mark. Closes on pick. */
export function PickerSheet<T extends string>({
  visible,
  title,
  options,
  value,
  onChange,
  onClose,
  group,
}: {
  visible: boolean;
  title: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  onClose: () => void;
  /** Splits the list into titled cards (options must already be in group order). */
  group?: (o: T) => string;
}) {
  const groups: { title?: string; options: T[] }[] = [];
  for (const o of options) {
    const g = group?.(o);
    const last = groups[groups.length - 1];
    if (last && last.title === g) last.options.push(o);
    else groups.push({ title: g, options: [o] });
  }
  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {groups.map((g) => (
          <View key={g.title ?? "all"} style={{ gap: 6 }}>
            {g.title ? <Text style={styles.pickerGroup}>{g.title}</Text> : null}
            <View style={[glass, styles.card]}>
              {g.options.map((o, i) => (
            <Fragment key={o}>
              {i > 0 ? <View style={styles.hairline} /> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: o === value }}
                onPress={() => {
                  onChange(o);
                  onClose();
                }}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <Text style={[styles.rowLabel, { flex: 1 }]}>{o}</Text>
                {o === value ? <Icon d={icon.check} size={18} width={2.4} color={color.ink} /> : null}
              </Pressable>
            </Fragment>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </Sheet>
  );
}

/** Grid of pictures; "Initials" clears the choice. Closes on pick. */
export function AvatarSheet({
  visible,
  name,
  value,
  onChange,
  onClose,
}: {
  visible: boolean;
  name: string;
  value?: string;
  onChange: (v: string | undefined) => void;
  onClose: () => void;
}) {
  const pick = (v: string | undefined) => {
    onChange(v);
    onClose();
  };
  const cell = (key: string, selected: boolean, label: string, onPress: () => void, avatarName: string) => (
    <View key={key} style={styles.gridItem}>
      <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress} style={[styles.cell, selected && styles.cellOn]}>
        <Avatar name={avatarName} size={56} />
      </Pressable>
    </View>
  );
  return (
    <Sheet visible={visible} title="Choose a picture" onClose={onClose}>
      <View style={styles.grid}>
        {cell("initials", !value, "Initials", () => pick(undefined), name || "?")}
        {avatarNames.map((a) => cell(a, a === value, `Picture: ${a}`, () => pick(a), a))}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, minHeight: 44 },
  pickerGroup: { paddingHorizontal: 16, paddingTop: 8, fontSize: 13, fontWeight: "600", letterSpacing: 0.4, textTransform: "uppercase", color: color.body },
  navSide: { width: 76 },
  navTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "600", color: color.ink },
  navAction: { height: 36, borderRadius: 18, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", backgroundColor: color.charcoal },
  navActionText: { fontSize: 15, fontWeight: "600", color: "#fff" },

  hero: { alignItems: "center", paddingTop: 14, paddingBottom: 22, paddingHorizontal: 24 },
  heroRing: { padding: 4, borderRadius: 52, backgroundColor: "rgba(255,255,255,0.7)", borderWidth: 1, borderColor: "rgba(255,255,255,0.9)" },
  badge: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.charcoal,
    borderWidth: 2,
    borderColor: "#fff",
  },
  heroName: { marginTop: 12, fontSize: 24, fontWeight: "600", letterSpacing: -0.6, color: color.ink },
  heroSub: { marginTop: 2, fontSize: 14, color: color.body },

  section: { paddingHorizontal: 16, marginBottom: 20 },
  sectionTitle: { paddingHorizontal: 16, paddingBottom: 6, fontSize: 13, fontWeight: "600", color: color.body },
  card: { borderRadius: 22, overflow: "hidden" },
  footer: { paddingHorizontal: 16, paddingTop: 6, fontSize: 13, lineHeight: 18, color: color.body },
  hairline: { height: StyleSheet.hairlineWidth, marginLeft: 16, backgroundColor: "rgba(34,35,38,0.12)" },

  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 50, paddingHorizontal: 16, paddingVertical: 8 },
  rowPressed: { backgroundColor: "rgba(34,35,38,0.05)" },
  rowLabel: { fontSize: 16, color: color.ink },
  remove: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(34,35,38,0.08)" },
  addText: { fontSize: 16, fontWeight: "600", color: color.ink },
  input: { flex: 1, textAlign: "right", fontSize: 16, color: color.ink, paddingVertical: 4 },
  value: { flex: 1, textAlign: "right", fontSize: 16, color: color.ink },
  phoneRight: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8 },
  phoneInput: { flexGrow: 1, flexShrink: 1, minWidth: 0, fontVariant: ["tabular-nums"] },
  dialChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 30,
    paddingLeft: 6,
    paddingRight: 10,
    borderRadius: 15,
    backgroundColor: "#fff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(34,35,38,0.14)",
  },
  dialCode: { fontSize: 15, fontWeight: "600", color: color.ink, fontVariant: ["tabular-nums"] },

  segment: { flexDirection: "row", padding: 2, borderRadius: 10, backgroundColor: "rgba(118,118,128,0.12)" },
  seg: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  segOn: { backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segText: { fontSize: 13, fontWeight: "600", color: color.body },

  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  sheet: { backgroundColor: color.mist, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 8, paddingHorizontal: 16, gap: 12 },
  grabber: { alignSelf: "center", width: 36, height: 5, borderRadius: 3, backgroundColor: "rgba(34,35,38,0.18)" },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4, paddingTop: 4 },
  sheetTitle: { fontSize: 18, fontWeight: "600", letterSpacing: -0.3, color: color.ink },
  done: { fontSize: 16, fontWeight: "600", color: color.ink },
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: 12, paddingBottom: 4 },
  gridItem: { width: "25%", alignItems: "center" },
  cell: { padding: 3, borderRadius: 999, borderWidth: 2.5, borderColor: "transparent" },
  cellOn: { borderColor: color.ink },
});
