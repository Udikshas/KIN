import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";

import { color } from "@/lib/theme";

/**
 * Animated splash ("ringing lockup", designed in apps/motion). The native splash shows the same
 * tile at the same size and spot (app.json: splash-icon.png, imageWidth 96), so swapping to this
 * overlay is invisible. The arcs ring once while the tile breathes, the tile glides left as "Kin"
 * wipes in just behind it, and the overlay fades once the app underneath is ready. It never delays loading: the app renders
 * beneath it the whole time. Transforms and opacity only, all on the UI thread; no video, no assets.
 */

const TILE = 96; // = imageWidth in app.json
const GAP = 17;
const RING_DOWN = 300;
const RING_UP = 420;
const RING_AT = 60;
const SLIDE_AT = RING_AT + RING_DOWN + RING_UP - 140; // overlaps the last ring so the motion never stops
const SLIDE_MS = 540;
const WORD_LAG = 70; // the word trails the tile a touch: follow-through, not one rigid block
const DONE_MS = SLIDE_AT + WORD_LAG + SLIDE_MS + 30; // lockup settled: ~1.3 s, ~1.5 s with the fade
const FADE_MS = 240;
const MAX_WAIT_MS = 6000; // still loading after this: show the app's own spinner instead

const wave = Easing.inOut(Easing.sin); // ring: no hard corners at the turnarounds
const glide = Easing.bezier(0.22, 1, 0.36, 1); // slide: quick start, long soft settle
const exit = Easing.out(Easing.cubic);

// One slow ring: the arcs dim and swell back; the tile breathes in time with them.
// The ring is the whole point of the splash, but it still respects Reduce Motion (skipped below).
const ring = (delay: number, low: number) =>
  withDelay(
    delay,
    withSequence(
      withTiming(low, { duration: RING_DOWN, easing: wave }),
      withTiming(1, { duration: RING_UP, easing: wave }),
    ),
  );

export function Splash({ ready }: { ready: boolean }) {
  const reduceMotion = useReducedMotion();
  const [animDone, setAnimDone] = useState(false);
  const [gone, setGone] = useState(false);
  const started = useRef(false);

  const arc1 = useSharedValue(1);
  const arc2 = useSharedValue(1);
  const pulse = useSharedValue(1);
  const lockup = useSharedValue(0);
  const reveal = useSharedValue(0);
  const wordWidth = useSharedValue(0);
  const fade = useSharedValue(1);

  // The overlay is on screen: hide the native splash under it and start.
  const start = () => {
    if (started.current) return;
    started.current = true;
    SplashScreen.hideAsync();
    if (reduceMotion) {
      lockup.value = 1;
      reveal.value = 1;
      setAnimDone(true);
      return;
    }
    arc1.value = ring(RING_AT, 0.3);
    arc2.value = ring(RING_AT + 140, 0.3);
    pulse.value = ring(RING_AT, 0.965);
    const slide = { duration: SLIDE_MS, easing: glide, reduceMotion: ReduceMotion.Never };
    lockup.value = withDelay(SLIDE_AT, withTiming(1, slide));
    reveal.value = withDelay(SLIDE_AT + WORD_LAG, withTiming(1, slide));
    setTimeout(() => setAnimDone(true), DONE_MS);
  };

  const leave = animDone && ready;
  useEffect(() => {
    if (!leave) return;
    fade.value = withTiming(0, { duration: FADE_MS, easing: exit });
    const t = setTimeout(() => setGone(true), FADE_MS);
    return () => clearTimeout(t);
  }, [leave, fade]);

  // Never wait for data longer than the cap, even if `ready` never comes.
  useEffect(() => {
    const t = setTimeout(() => {
      fade.value = withTiming(0, { duration: FADE_MS, easing: exit });
      setTimeout(() => setGone(true), FADE_MS);
    }, MAX_WAIT_MS);
    return () => clearTimeout(t);
  }, [fade]);

  // On the way out the lockup drifts a little closer as it fades, like it's handing over.
  const root = useAnimatedStyle(() => ({ opacity: fade.value, transform: [{ scale: 1 + (1 - fade.value) * 0.03 }] }));
  // The tile sits in the centre and the word hangs off its right edge, so the tile never moves
  // until the slide: then the pair shifts left by half of (gap + word) to centre the lockup.
  const row = useAnimatedStyle(() => ({
    transform: [{ translateX: (-(GAP + wordWidth.value) / 2) * lockup.value }],
  }));
  // Wipe: the clip window slides right while the text inside stays put (transforms only, no layout).
  const clip = useAnimatedStyle(() => ({
    opacity: wordWidth.value ? Math.min(1, reveal.value * 2.5) : 0,
    transform: [{ translateX: -wordWidth.value * (1 - reveal.value) }],
  }));
  const word = useAnimatedStyle(() => ({
    transform: [{ translateX: (wordWidth.value - 16) * (1 - reveal.value) }],
  }));
  const tile = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const a1 = useAnimatedStyle(() => ({ opacity: arc1.value }));
  const a2 = useAnimatedStyle(() => ({ opacity: arc2.value }));

  if (gone) return null;

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, root]}
      onLayout={start}
      pointerEvents={leave ? "none" : "auto"}
      accessible
      accessibilityLabel="Kin"
    >
      <Animated.View style={[styles.row, row]}>
        <Animated.View style={[styles.tile, tile]}>
          <Mark part="dot" />
          <Animated.View style={[StyleSheet.absoluteFill, a1]}>
            <Mark part="arc1" />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, a2]}>
            <Mark part="arc2" />
          </Animated.View>
        </Animated.View>
        <Animated.View style={[styles.clip, clip]}>
          <Animated.View style={word} onLayout={(e) => (wordWidth.value = e.nativeEvent.layout.width)}>
            <Text style={styles.word} allowFontScaling={false}>
              Kin
            </Text>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

/** One layer of the Kin mark (apps/web/public/brand/kin-mark.svg), so each arc can ring on its own. */
function Mark({ part }: { part: "dot" | "arc1" | "arc2" }) {
  return (
    <Svg viewBox="0 0 64 64" width={TILE} height={TILE} fill="none" style={StyleSheet.absoluteFill}>
      {part === "dot" ? <Circle cx="22" cy="32" r="6" fill="#fff" /> : null}
      {part === "arc1" ? <Path d="M33 21.5a14 14 0 0 1 0 21" stroke="#fff" strokeWidth={4.5} strokeLinecap="round" /> : null}
      {part === "arc2" ? (
        <Path d="M41.5 15a22.5 22.5 0 0 1 0 34" stroke="#fff" strokeOpacity={0.55} strokeWidth={4.5} strokeLinecap="round" />
      ) : null}
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: color.cloud, alignItems: "center", justifyContent: "center", zIndex: 100 },
  row: { width: TILE, height: TILE },
  tile: { width: TILE, height: TILE, borderRadius: (TILE * 18) / 64, backgroundColor: color.charcoal, overflow: "hidden" },
  clip: { position: "absolute", left: TILE + GAP, top: 0, bottom: 0, justifyContent: "center", overflow: "hidden" },
  word: { fontSize: 52, lineHeight: 60, fontWeight: "600", letterSpacing: -1.8, color: color.ink, paddingRight: 3 },
});
