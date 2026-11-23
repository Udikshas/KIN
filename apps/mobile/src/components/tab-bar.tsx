import { BlurView } from "expo-blur";
import { router } from "expo-router";
import type { BottomTabBarProps } from "expo-router/tabs";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, PanResponder, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { color, glass, metric } from "@/lib/theme";

import { Icon, icon } from "./kit";
import { TabIcon } from "./tab-icons";

const tabs = [
  { name: "index", label: "Today" },
  { name: "calls", label: "Calls" },
  { name: "trends", label: "Trends" },
  { name: "family", label: "Family" },
] as const;

const INACTIVE = "rgba(34,35,38,0.62)";
const GUTTER = 14; // bar's distance from the screen edge
const PAD = 5; // capsule padding around the tabs
const TRACK_LEFT = GUTTER + PAD; // where the first tab starts on screen

/**
 * Floating glass capsule with the primary action (call) split off, as in iOS 26.
 * The selection bubble slides between tabs, and can be dragged along the bar:
 * let go over a tab to open it.
 */
export function TabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const activeName = state.routes[state.index]?.name;
  const activeIndex = Math.max(0, tabs.findIndex((t) => t.name === activeName));
  const [width, setWidth] = useState(0); // inner width of the capsule
  const [hover, setHover] = useState<number | null>(null); // tab under the finger while dragging
  const tabW = width / tabs.length;
  const x = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(1)).current;
  const drag = useRef({ start: 0 });

  const spring = (v: Animated.Value, toValue: number) =>
    Animated.spring(v, { toValue, useNativeDriver: Platform.OS !== "web", damping: 18, stiffness: 220, mass: 0.7 }).start();

  const placed = useRef(false);
  useEffect(() => {
    if (!tabW) return;
    // First layout: start under the current tab; after that, slide.
    if (placed.current) spring(x, activeIndex * tabW);
    else x.setValue(activeIndex * tabW);
    placed.current = true;
  }, [activeIndex, tabW]); // eslint-disable-line react-hooks/exhaustive-deps

  function open(i: number) {
    const t = tabs[i];
    const route = state.routes.find((r) => r.name === t.name);
    if (!route) return;
    const e = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
    if (t.name !== activeName && !e.defaultPrevented) navigateToTab(route.key);
  }

  const clampIndex = (px: number) => Math.min(tabs.length - 1, Math.max(0, Math.round(px / tabW)));
  const pan = useMemo(
    () =>
      PanResponder.create({
        // Taps stay with the tab buttons; a sideways drag takes over.
        onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (_, g) => {
          // Start from the tab under the finger, as iOS does.
          drag.current = { start: clampIndex(g.x0 - TRACK_LEFT - tabW / 2) * tabW };
          spring(lift, 1.12);
        },
        onPanResponderMove: (_, g) => {
          const px = Math.min((tabs.length - 1) * tabW, Math.max(0, drag.current.start + g.dx));
          x.setValue(px);
          setHover(clampIndex(px));
        },
        onPanResponderRelease: (_, g) => {
          const i = clampIndex(drag.current.start + g.dx);
          setHover(null);
          spring(lift, 1);
          spring(x, i * tabW);
          open(i);
        },
        onPanResponderTerminate: () => {
          setHover(null);
          spring(lift, 1);
          spring(x, activeIndex * tabW);
        },
      }),
    [activeIndex, tabW, activeName], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const lit = hover ?? activeIndex;
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]} pointerEvents="box-none">
      <View style={styles.row}>
        <Glass style={styles.capsule}>
          <View style={styles.track} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} {...pan.panHandlers}>
            {tabW ? (
              <Animated.View
                pointerEvents="none"
                style={[styles.bubble, { width: tabW, transform: [{ translateX: x }, { scale: lift }] }]}
              />
            ) : null}
            {tabs.map((t, i) => {
              const on = i === lit;
              return (
                <Pressable
                  key={t.name}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: i === activeIndex }}
                  accessibilityLabel={t.label}
                  onPress={() => open(i)}
                  style={styles.tab}
                >
                  <TabIcon name={t.name} on={on} color={on ? metric.blue : INACTIVE} />
                  <Text style={[styles.label, { color: on ? metric.blue : INACTIVE }, on && styles.labelOn]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Glass>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Call now"
          onPress={() => router.push("/call")}
          style={({ pressed }) => [styles.phoneShadow, pressed && { transform: [{ scale: 0.94 }] }]}
        >
          <LinearGradient colors={["#3d3f4a", color.charcoal]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={styles.phone}>
            <Icon d={icon.phoneRing} size={25} width={2} color="#fff" />
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

function Glass({ style, children }: { style: object; children: React.ReactNode }) {
  // Real blur on iOS; Android/web get the translucent glass fill.
  if (Platform.OS === "ios") {
    return (
      <View style={[glass, style, { overflow: "hidden", backgroundColor: "rgba(255,255,255,0.35)" }]}>
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
        {children}
      </View>
    );
  }
  return <View style={[glass, style, { backgroundColor: "rgba(255,255,255,0.82)" }]}>{children}</View>;
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: GUTTER },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  capsule: { flex: 1, borderRadius: 999, padding: PAD },
  track: { flexDirection: "row", userSelect: "none" },
  bubble: { position: "absolute", top: 0, left: 0, height: 54, borderRadius: 999, backgroundColor: "rgba(34,35,38,0.07)" },
  tab: { flex: 1, height: 54, borderRadius: 999, alignItems: "center", justifyContent: "center", gap: 2 },
  label: { fontSize: 10.5, fontWeight: "500" },
  labelOn: { fontWeight: "700" },
  phoneShadow: {
    borderRadius: 32,
    shadowColor: "#1f2025",
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  phone: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
});
