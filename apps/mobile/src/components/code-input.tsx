import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ComponentRef } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { color } from "@/lib/theme";

export type CodeInputHandle = { focus: () => void; shake: () => void };

/**
 * One box per digit. A single transparent TextInput sits on top of the boxes, so
 * typing, backspace, paste and the iOS / Android "code from Mail" suggestion all
 * work like a normal field; the boxes only draw what it holds.
 */
export const CodeInput = forwardRef<
  CodeInputHandle,
  { value: string; onChange: (v: string) => void; onFilled?: (v: string) => void; length?: number; error?: boolean; disabled?: boolean }
>(function CodeInput({ value, onChange, onFilled, length = 6, error = false, disabled = false }, ref) {
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const shakeX = useRef(new Animated.Value(0)).current;
  const caret = useRef(new Animated.Value(1)).current;
  const [focused, setFocused] = useState(false);

  useImperativeHandle(ref, () => ({
    focus: () => input.current?.focus(),
    shake: () =>
      Animated.sequence(
        [10, -10, 7, -7, 3, 0].map((x) => Animated.timing(shakeX, { toValue: x, duration: 50, useNativeDriver: Platform.OS !== "web" })),
      ).start(),
  }));

  // Blinking caret in the box being typed into.
  useEffect(() => {
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(caret, { toValue: 0, duration: 500, delay: 300, useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(caret, { toValue: 1, duration: 500, useNativeDriver: Platform.OS !== "web" }),
      ]),
    );
    blink.start();
    return () => blink.stop();
  }, [caret]);

  function change(text: string) {
    const digits = text.replace(/\D/g, "").slice(0, length);
    onChange(digits);
    if (digits.length === length) onFilled?.(digits);
  }

  const active = Math.min(value.length, length - 1);
  return (
    <Animated.View style={{ transform: [{ translateX: shakeX }] }}>
      <Pressable onPress={() => input.current?.focus()} accessibilityLabel="Sign-in code" style={styles.row}>
        {Array.from({ length }, (_, i) => {
          const digit = value[i];
          const isActive = focused && i === active && !disabled;
          return (
            <View
              key={i}
              style={[styles.box, digit ? styles.boxFilled : null, isActive && styles.boxActive, error && styles.boxError]}
            >
              {digit ? (
                <Text style={styles.digit}>{digit}</Text>
              ) : isActive ? (
                <Animated.View style={[styles.caret, { opacity: caret }]} />
              ) : null}
            </View>
          );
        })}
        <TextInput
          ref={input}
          value={value}
          onChangeText={change}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          editable={!disabled}
          keyboardType="number-pad"
          inputMode="numeric"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={length}
          caretHidden
          contextMenuHidden={false}
          selectionColor="transparent"
          autoFocus
          style={styles.hidden}
        />
      </Pressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  box: {
    flex: 1,
    maxWidth: 54,
    aspectRatio: 0.84,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.7)",
    borderWidth: 1.5,
    borderColor: "rgba(34,35,38,0.08)",
  },
  boxFilled: { backgroundColor: "#fff", borderColor: "rgba(34,35,38,0.14)" },
  boxActive: { backgroundColor: "#fff", borderColor: color.ink },
  boxError: { borderColor: color.alert, backgroundColor: "#fff5f5" },
  digit: { fontSize: 26, fontWeight: "600", color: color.ink, fontVariant: ["tabular-nums"] },
  caret: { width: 2, height: 26, borderRadius: 1, backgroundColor: color.ink },
  // Covers the boxes so a tap or long-press (paste) lands on the real field; its own text never shows.
  hidden: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    color: "transparent",
    backgroundColor: "transparent",
    fontSize: 1,
    outlineWidth: 0,
    opacity: Platform.OS === "web" ? 0 : 0.011,
  },
});
