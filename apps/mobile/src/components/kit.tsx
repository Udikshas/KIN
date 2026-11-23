import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useId, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Defs, G, LinearGradient as SvgGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";

import { color, glass, metric, radius } from "@/lib/theme";

// Native port of apps/web/src/components/app/kit.tsx: the iOS 26 "Liquid Glass"
// idiom with a soft mesh wallpaper, glass cards, rings and a floating tab bar.

const avatars = {
  amma: require("@/assets/avatars/amma.svg"),
  nani: require("@/assets/avatars/nani.svg"),
  dadi: require("@/assets/avatars/dadi.svg"),
  kamala: require("@/assets/avatars/kamala.svg"),
  aunty: require("@/assets/avatars/aunty.svg"),
  papa: require("@/assets/avatars/papa.svg"),
  dadaji: require("@/assets/avatars/dadaji.svg"),
  joseph: require("@/assets/avatars/joseph.svg"),
  turban: require("@/assets/avatars/turban.svg"),
  neha: require("@/assets/avatars/neha.svg"),
  priya: require("@/assets/avatars/priya.svg"),
  rahul: require("@/assets/avatars/rahul.svg"),
  lotus: require("@/assets/avatars/lotus.svg"),
  chai: require("@/assets/avatars/chai.svg"),
  sun: require("@/assets/avatars/sun.svg"),
};
export type AvatarName = keyof typeof avatars;
/** Pictures a family can pick for a parent or member (stored as the key). */
export const avatarNames = Object.keys(avatars) as AvatarName[];

export function Avatar({ name, size = 40 }: { name?: string; size?: number }) {
  const src = name && name in avatars ? avatars[name as AvatarName] : null;
  if (!src) {
    return (
      <View style={[styles.initials, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={{ fontSize: size * 0.4, fontWeight: "600", color: color.ink }}>{(name ?? "?").slice(0, 1).toUpperCase()}</Text>
      </View>
    );
  }
  return <Image source={src} style={{ width: size, height: size, borderRadius: size / 2 }} />;
}

export function AppIcon({ size = 36, round = false }: { size?: number; round?: boolean }) {
  return (
    <Image
      source={require("@/assets/images/app-icon.svg")}
      style={{ width: size, height: size, borderRadius: round ? size / 2 : size / 4 }}
    />
  );
}

/** Light mesh wallpaper behind every screen (web `mesh-light`). */
export function Mesh() {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
      <Defs>
        <SvgGradient id="base" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#e3ebf8" />
          <Stop offset="0.55" stopColor="#f1f4fa" />
          <Stop offset="1" stopColor="#f6f3f1" />
        </SvgGradient>
        {[
          ["m1", "#cbbdff"],
          ["m2", "#ffd2c2"],
          ["m3", "#bfe2ff"],
          ["m4", "#fff0b5"],
        ].map(([id, c]) => (
          <RadialGradient key={id} id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={c} stopOpacity="1" />
            <Stop offset="1" stopColor={c} stopOpacity="0" />
          </RadialGradient>
        ))}
      </Defs>
      <Rect width="100" height="100" fill="url(#base)" />
      <Rect x="30" y="-28" width="124" height="68" fill="url(#m1)" />
      <Rect x="-63" y="6" width="116" height="60" fill="url(#m2)" />
      <Rect x="45" y="40" width="120" height="60" fill="url(#m3)" />
      <Rect x="-50" y="72" width="110" height="52" fill="url(#m4)" />
    </Svg>
  );
}

/** Concentric progress rings, Apple-Fitness style. Values are 0–1. */
export function Rings({
  size = 120,
  stroke = 12,
  gap = 3,
  rings,
}: {
  size?: number;
  stroke?: number;
  gap?: number;
  rings: { value: number; color: string; to?: string }[];
}) {
  const c = size / 2;
  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
      <Defs>
        {rings.map((r, i) => (
          <SvgGradient key={i} id={`rg-${i}-${r.color.slice(1)}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={r.to ?? r.color} />
            <Stop offset="1" stopColor={r.color} />
          </SvgGradient>
        ))}
      </Defs>
      {rings.map((r, i) => {
        const rad = c - stroke / 2 - i * (stroke + gap);
        const len = 2 * Math.PI * rad;
        const v = Math.max(0, Math.min(1, r.value));
        return (
          <G key={i}>
            <Circle cx={c} cy={c} r={rad} fill="none" stroke={r.color} strokeOpacity={0.14} strokeWidth={stroke} />
            {v > 0 ? (
              <Circle
                cx={c}
                cy={c}
                r={rad}
                fill="none"
                stroke={`url(#rg-${i}-${r.color.slice(1)})`}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={`${len * v} ${len}`}
              />
            ) : null}
          </G>
        );
      })}
    </Svg>
  );
}

export function Ring({
  value,
  color: c,
  size = 54,
  stroke = 6,
  fontSize = 13,
  children,
}: {
  value: number;
  color: string;
  size?: number;
  stroke?: number;
  fontSize?: number;
  children?: ReactNode;
}) {
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View style={StyleSheet.absoluteFill}>
        <Rings size={size} stroke={stroke} rings={[{ value, color: c }]} />
      </View>
      <Text style={{ fontSize, fontWeight: "600", letterSpacing: -0.4, color: color.ink }}>{children}</Text>
    </View>
  );
}

export type Tone = "ok" | "watch" | "alert" | "plain";
export const toneColor: Record<Tone, string> = { ok: color.ok, watch: color.watch, alert: color.alert, plain: color.ink };

export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  const c = toneColor[tone];
  return (
    <View style={[glass, styles.pill]}>
      {tone !== "plain" ? <View style={[styles.dot, { backgroundColor: c, shadowColor: c }]} /> : null}
      <Text style={{ fontSize: 13, fontWeight: "600", color: c }}>{children}</Text>
    </View>
  );
}

export const icon = {
  bell: "M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 21h4",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  back: "M15 5l-7 7 7 7",
  close: "M6 6l12 12M18 6 6 18",
  plus: "M12 5v14M5 12h14",
  share: "M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6",
  chevron: "M9 5l7 7-7 7",
  check: "m5 12.5 4.5 4.5L19 7",
  transcript: "M5 4.5h14a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5h-7.5L7 21v-3.5H5A1.5 1.5 0 0 1 3.5 16V6A1.5 1.5 0 0 1 5 4.5ZM8 9h8M8 13h5",
  pencil: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  bulb: "M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3ZM9.5 19.5h5",
  lock: "M5 12a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2zM8 10V7a4 4 0 0 1 8 0v3",
  message: "M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 3.5V16A2.5 2.5 0 0 1 4 13.5zM8.5 8.5h7M8.5 11.5h4.5",
  mail: "M3 6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5zM3.5 6l8.5 7 8.5-7",
  pill: "M10.5 3.5a5 5 0 0 1 7 7l-7 7a5 5 0 0 1-7-7zM7 7l7 7",
  phoneRing:
    "M6.6 5.5h2.8l1.4 4-2 1.3a11 11 0 0 0 6.4 6.4l1.3-2 4 1.4v2.8c0 1-.8 1.8-1.8 1.8C10.8 21.2 4.8 15.2 4.8 7.3c0-1 .8-1.8 1.8-1.8ZM15 3a6 6 0 0 1 6 6M15 6.5A2.5 2.5 0 0 1 17.5 9",
  phone:
    "M6.6 3.5h2.8l1.4 4-2 1.3a11 11 0 0 0 6.4 6.4l1.3-2 4 1.4v2.8c0 1-.8 1.8-1.8 1.8C10.8 19.2 4.8 13.2 4.8 5.3c0-1 .8-1.8 1.8-1.8Z",
  today: "M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z",
  calls: "M4 6h16M4 12h16M4 18h10",
  trends: "M4 18 9 12l4 3 7-9",
  family:
    "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9c0-3.3 2.7-6 6-6s6 2.7 6 6M16.5 10.5a3 3 0 1 0 0-6M18 14c2 .6 3.5 2.6 3.5 5",
  signout: "M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10",
};

export function Icon({ d, size = 20, width = 2, color: c = color.ink }: { d: string; size?: number; width?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round">
      <Path d={d} />
    </Svg>
  );
}

export function GlassButton({ children, onPress, label }: { children: ReactNode; onPress?: () => void; label: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6} style={({ pressed }) => [glass, styles.glassButton, pressed && styles.pressed]}>
      {children}
    </Pressable>
  );
}

/** A bottom sheet's title with a round ✕ that closes it; sits above the sheet's scrolling content. */
export function SheetHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <View style={styles.sheetHead}>
      <Text style={styles.sheetTitle} numberOfLines={2}>{title}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={onClose}
        hitSlop={10}
        style={({ pressed }) => [styles.sheetClose, pressed && styles.pressed]}
      >
        <Icon d={icon.close} size={14} color={color.ink} />
      </Pressable>
    </View>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [glass, styles.card, style, pressed && styles.pressed]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[glass, styles.card, style]}>{children}</View>;
}

export function Check({ done = true }: { done?: boolean }) {
  if (!done) return <View style={styles.checkEmpty} />;
  return (
    <LinearGradient colors={["#4ade1a", color.ok]} style={styles.check}>
      <Svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round">
        <Path d="m2.5 6.3 2.3 2.2 4.7-5" />
      </Svg>
    </LinearGradient>
  );
}

/** A medicine: a glossy two-tone capsule on a tile tinted with its colour. */
export function MedIcon({ tint, size = 44 }: { tint: string; size?: number }) {
  const id = useId().replace(/:/g, "");
  return (
    <LinearGradient
      colors={[`${tint}38`, `${tint}14`]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.medTile, { width: size, height: size, borderRadius: size * 0.32, borderColor: `${tint}40` }]}
    >
      <Svg width={size * 0.72} height={size * 0.72} viewBox="0 0 32 32">
        <Defs>
          <SvgGradient id={`${id}c`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={tint} stopOpacity="0.8" />
            <Stop offset="1" stopColor={tint} />
          </SvgGradient>
          <SvgGradient id={`${id}w`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#ffffff" />
            <Stop offset="1" stopColor="#e4e8f0" />
          </SvgGradient>
        </Defs>
        <G transform="rotate(-45 16 16)">
          <Rect x="2" y="12" width="28" height="11" rx="5.5" fill="rgba(34,35,38,0.12)" />
          <Path d="M16 10.5H7.5a5.5 5.5 0 0 0 0 11H16z" fill={`url(#${id}c)`} />
          <Path d="M16 10.5h8.5a5.5 5.5 0 0 1 0 11H16z" fill={`url(#${id}w)`} />
          <Rect x="2" y="10.5" width="28" height="11" rx="5.5" fill="none" stroke={tint} strokeOpacity="0.4" strokeWidth="0.8" />
          <Path d="M6.5 13.4h6.5" stroke="#fff" strokeOpacity="0.75" strokeWidth="1.6" strokeLinecap="round" />
          <Path d="M19 13.4h6.5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
        </G>
      </Svg>
    </LinearGradient>
  );
}

/** The Kin voice orb (small, static), as on the Today card. */
export function Orb({ size = 48 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id="ob" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#c9bcff" />
          <Stop offset="1" stopColor="#8d7bff" />
        </RadialGradient>
        <RadialGradient id="oc" cx="72%" cy="35%" r="55%">
          <Stop offset="0" stopColor={metric.coral} />
          <Stop offset="1" stopColor={metric.coral} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="ol" cx="35%" cy="78%" r="60%">
          <Stop offset="0" stopColor={metric.blue} />
          <Stop offset="1" stopColor={metric.blue} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="oh" cx="30%" cy="28%" r="35%">
          <Stop offset="0" stopColor="#fff" stopOpacity="0.8" />
          <Stop offset="1" stopColor="#fff" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx="50" cy="50" r="50" fill="url(#ob)" />
      <Circle cx="50" cy="50" r="50" fill="url(#oc)" />
      <Circle cx="50" cy="50" r="50" fill="url(#ol)" />
      <Circle cx="50" cy="50" r="50" fill="url(#oh)" />
    </Svg>
  );
}

/** Pill button: charcoal (primary) or glass (soft). */
export function Button({
  children,
  onPress,
  variant = "primary",
  disabled,
}: {
  children: string;
  onPress?: () => void;
  variant?: "primary" | "soft";
  disabled?: boolean;
}) {
  const primary = variant === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [{ opacity: disabled ? 0.5 : 1 }, pressed && styles.pressed]}
    >
      {primary ? (
        <LinearGradient colors={["#3a3c45", color.charcoal]} style={styles.button}>
          <Text style={[styles.buttonText, { color: "#fff" }]}>{children}</Text>
        </LinearGradient>
      ) : (
        <View style={[glass, styles.button]}>
          <Text style={[styles.buttonText, { color: color.ink }]}>{children}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export const textStyles = StyleSheet.create({
  title: { fontSize: 16, fontWeight: "600", color: color.ink },
  sub: { fontSize: 13, color: color.body },
  body: { fontSize: 15, lineHeight: 20, color: color.ink },
});

const styles = StyleSheet.create({
  initials: { backgroundColor: color.cloud, alignItems: "center", justifyContent: "center" },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5, alignSelf: "flex-start" },
  dot: { width: 7, height: 7, borderRadius: 4, shadowOpacity: 0.8, shadowRadius: 3, shadowOffset: { width: 0, height: 0 } },
  glassButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  sheetHead: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 4, paddingBottom: 12 },
  sheetTitle: { flex: 1, fontSize: 22, fontWeight: "600", letterSpacing: -0.4, color: color.ink },
  sheetClose: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(34,35,38,0.08)" },
  card: { borderRadius: radius.card, padding: 16 },
  pressed: { opacity: 0.7 },
  check: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  medTile: { alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth },
  checkEmpty: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: "rgba(34,35,38,0.15)", backgroundColor: "rgba(255,255,255,0.4)" },
  button: { height: 54, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  buttonText: { fontSize: 17, fontWeight: "600" },
  label: { fontSize: 12, fontWeight: "600", letterSpacing: 0.6, color: color.body, textTransform: "uppercase" },
});
