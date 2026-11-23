import { loadFont } from "@remotion/google-fonts/Inter";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// Ringing lockup: the mark appears, its arcs ring twice like a phone,
// then the tile slides left as "Kin" is revealed beside it.

export const SPLASH_FPS = 60;
export const SPLASH_FRAMES = 150; // 2.5 s; the last ~0.8 s holds the finished lockup

const { fontFamily } = loadFont("normal", { weights: ["600"], subsets: ["latin"] });

// Brand tokens (apps/web/src/app/globals.css).
const CLOUD = "#ebf0f8";
const CHARCOAL = "#1f2025";
const INK = "#222326";

const slide = Easing.bezier(0.65, 0, 0.35, 1);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// Each arc lights up, both dip once together, then come back: two rings.
const arc = (frame: number, on: number, dip: number, back: number) =>
  interpolate(frame, [on, on + 6, dip, dip + 6, back], [0, 1, 1, 0.2, 1], clamp);

export const KinSplash = () => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

  const tile = Math.round(width * 0.2);
  const gap = Math.round(tile * 0.18);
  const fontSize = Math.round(tile * 0.54);

  const tileIn = spring({ frame, fps, config: { damping: 18, stiffness: 140 } });
  const dotIn = spring({ frame: frame - 10, fps, config: { damping: 11, stiffness: 180 } });
  const arc1 = arc(frame, 16, 40, 54);
  const arc2 = arc(frame, 24, 42, 60);

  // 0 = tile centred on its own, 1 = full lockup centred.
  const lockup = interpolate(frame, [66, 100], [0, 1], { ...clamp, easing: slide });
  const word = interpolate(frame, [72, 104], [0, 1], { ...clamp, easing: slide });

  return (
    <AbsoluteFill style={{ backgroundColor: CLOUD, alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap,
          // Half the row minus half the tile puts the tile in the centre.
          transform: `translateX(calc((50% - ${tile / 2}px) * ${1 - lockup}))`,
        }}
      >
        <div
          style={{
            width: tile,
            height: tile,
            borderRadius: tile * 0.286,
            backgroundColor: CHARCOAL,
            opacity: tileIn,
            transform: `scale(${interpolate(tileIn, [0, 1], [0.86, 1])})`,
            flexShrink: 0,
          }}
        >
          <svg viewBox="0 0 64 64" width={tile} height={tile} fill="none">
            <circle
              cx="22"
              cy="32"
              r="6"
              fill="#fff"
              style={{ transformOrigin: "22px 32px", transform: `scale(${Math.max(0, dotIn)})` }}
            />
            <path
              d="M33 21.5a14 14 0 0 1 0 21"
              stroke="#fff"
              strokeWidth="4.5"
              strokeLinecap="round"
              opacity={arc1}
            />
            <path
              d="M41.5 15a22.5 22.5 0 0 1 0 34"
              stroke="#fff"
              strokeOpacity=".55"
              strokeWidth="4.5"
              strokeLinecap="round"
              opacity={arc2}
            />
          </svg>
        </div>
        <div
          style={{
            fontFamily,
            fontWeight: 600,
            fontSize,
            lineHeight: 1,
            letterSpacing: "-0.035em",
            color: INK,
            // Small right padding so the clip never cuts the "n".
            paddingRight: fontSize * 0.06,
            opacity: interpolate(word, [0, 0.2], [0, 1], clamp),
            clipPath: `inset(-10% ${(1 - word) * 100}% -10% 0)`,
            transform: `translateX(${(1 - word) * -tile * 0.12}px)`,
          }}
        >
          Kin
        </div>
      </div>
    </AbsoluteFill>
  );
};
