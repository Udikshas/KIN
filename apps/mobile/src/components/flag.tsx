import { useId } from "react";
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from "react-native-svg";

/**
 * Small round flags for the country code chip, drawn (not emoji) so they look
 * the same on every phone and sit with Kin's soft, rounded style. Simplified on
 * purpose: at 20px only the main shapes read.
 */
export function Flag({ id, size = 20 }: { id: string; size?: number }) {
  const clip = `flag-${useId().replace(/:/g, "")}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <ClipPath id={clip}>
          <Circle cx="12" cy="12" r="12" />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${clip})`}>{shapes[id] ?? <Rect width="24" height="24" fill="#d3d7de" />}</G>
      {/* Hairline ring so white parts don't melt into a white chip. */}
      <Circle cx="12" cy="12" r="11.6" fill="none" stroke="rgba(34,35,38,0.14)" strokeWidth="0.8" />
    </Svg>
  );
}

const shapes: Record<string, React.ReactNode> = {
  IN: (
    <>
      <Rect width="24" height="8" fill="#ff9933" />
      <Rect y="8" width="24" height="8" fill="#ffffff" />
      <Rect y="16" width="24" height="8" fill="#138808" />
      <Circle cx="12" cy="12" r="2.9" fill="none" stroke="#000080" strokeWidth="0.9" />
      <Circle cx="12" cy="12" r="0.8" fill="#000080" />
    </>
  ),
  SG: (
    <>
      <Rect width="24" height="12" fill="#ef3340" />
      <Rect y="12" width="24" height="12" fill="#ffffff" />
      <Circle cx="7.6" cy="6.2" r="3.4" fill="#ffffff" />
      <Circle cx="9" cy="6.2" r="3.2" fill="#ef3340" />
      <Circle cx="12" cy="4.6" r="0.7" fill="#ffffff" />
      <Circle cx="13.6" cy="6.2" r="0.7" fill="#ffffff" />
      <Circle cx="12" cy="7.8" r="0.7" fill="#ffffff" />
    </>
  ),
  AE: (
    <>
      <Rect width="24" height="8" fill="#00843d" />
      <Rect y="8" width="24" height="8" fill="#ffffff" />
      <Rect y="16" width="24" height="8" fill="#1f2025" />
      <Rect width="7" height="24" fill="#ef3340" />
    </>
  ),
  GB: (
    <>
      <Rect width="24" height="24" fill="#012169" />
      <Path d="M0 0l24 24M24 0L0 24" stroke="#ffffff" strokeWidth="4.5" />
      <Path d="M0 0l24 24M24 0L0 24" stroke="#c8102e" strokeWidth="1.5" />
      <Path d="M12 0v24M0 12h24" stroke="#ffffff" strokeWidth="6.5" />
      <Path d="M12 0v24M0 12h24" stroke="#c8102e" strokeWidth="3.5" />
    </>
  ),
  US: (
    <>
      <Rect width="24" height="24" fill="#ffffff" />
      {[0, 2, 4, 6, 8, 10, 12].map((i) => (
        <Rect key={i} y={i * (24 / 13)} width="24" height={24 / 13} fill="#b22234" />
      ))}
      <Rect width="11" height="13" fill="#3c3b6e" />
      {[
        [3, 3.5],
        [7, 3.5],
        [5, 6.5],
        [3, 9.5],
        [7, 9.5],
      ].map(([x, y]) => (
        <Circle key={`${x}-${y}`} cx={x} cy={y} r="0.8" fill="#ffffff" />
      ))}
    </>
  ),
  AU: (
    <>
      <Rect width="24" height="24" fill="#012169" />
      <Path d="M0 0l12 12M12 0L0 12" stroke="#ffffff" strokeWidth="2.6" />
      <Path d="M6 0v12M0 6h12" stroke="#ffffff" strokeWidth="3.6" />
      <Path d="M6 0v12M0 6h12" stroke="#c8102e" strokeWidth="1.8" />
      {[
        [6, 18, 1.6],
        [17.5, 7, 1],
        [20.5, 11.5, 1],
        [17.5, 18.5, 1],
        [14.5, 12.5, 1],
      ].map(([x, y, r]) => (
        <Circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#ffffff" />
      ))}
    </>
  ),
};
