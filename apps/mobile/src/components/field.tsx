import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View, type TextInputProps } from "react-native";

import { color, glass, metric, radius } from "@/lib/theme";

export function Field({ label, style, ...props }: { label: string } & TextInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={color.faint} style={[styles.input, style]} {...props} />
    </View>
  );
}

/** A row of pill choices (language, call length, relation). */
export function Choice<T extends string | number>({
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
  render?: (o: T) => ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.choices}>
        {options.map((o) => {
          const on = o === value;
          return (
            <Pressable key={String(o)} onPress={() => onChange(o)} accessibilityState={{ selected: on }} style={[on ? styles.on : glass, styles.choice]}>
              <Text style={[styles.choiceText, on && { color: "#fff" }]}>{render(o)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const OFF_TRACK = "#d3d7de";

/**
 * iOS-style on/off switch: green when on, grey when off, white thumb.
 * Native Switch on iOS/Android; on web, react-native-web draws a Material
 * switch (thin track, overhanging thumb), so draw the iOS one ourselves.
 */
export function Toggle({ value, onValueChange }: { value: boolean; onValueChange: (v: boolean) => void }) {
  const x = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(x, { toValue: value ? 1 : 0, duration: 180, useNativeDriver: false }).start();
  }, [value, x]);

  if (Platform.OS !== "web") {
    return (
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: OFF_TRACK, true: metric.green }}
        thumbColor="#fff"
        ios_backgroundColor={OFF_TRACK}
      />
    );
  }
  return (
    <Pressable onPress={() => onValueChange(!value)} accessibilityRole="switch" accessibilityState={{ checked: value }}>
      <Animated.View style={[styles.track, { backgroundColor: x.interpolate({ inputRange: [0, 1], outputRange: [OFF_TRACK, metric.green] }) }]}>
        <Animated.View style={[styles.thumb, { transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, 17] }) }] }]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { paddingHorizontal: 4, fontSize: 13, fontWeight: "600", color: color.body },
  input: { ...glass, height: 50, borderRadius: radius.input, paddingHorizontal: 14, fontSize: 16, color: color.ink, backgroundColor: "rgba(255,255,255,0.85)" },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  on: { backgroundColor: color.ink },
  choiceText: { fontSize: 14, fontWeight: "600", color: color.ink },
  track: { width: 42, height: 25, borderRadius: 13, padding: 2 },
  thumb: { width: 21, height: 21, borderRadius: 11, backgroundColor: "#fff", boxShadow: "0 2px 4px rgba(0,0,0,0.18), 0 0 1px rgba(0,0,0,0.12)" },
});
