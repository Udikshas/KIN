import Svg, { Circle, Path, Rect } from "react-native-svg";

export type TabName = "index" | "calls" | "trends" | "family";

/**
 * Tab bar icons drawn for Kin. Inactive: thin outline. Active: the same shape,
 * filled with a soft tint of the colour, a firmer stroke and its detail in solid
 * colour, so the selected tab reads at a glance without changing shape.
 */
export function TabIcon({ name, on, color, size = 24 }: { name: TabName; on: boolean; color: string; size?: number }) {
  const stroke = { stroke: color, strokeWidth: on ? 2 : 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const fill = on ? { fill: color, fillOpacity: 0.2 } : { fill: "none" };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === "index" ? (
        // Today: a day on the calendar, ticked off.
        <>
          <Rect x="3.5" y="5" width="17" height="15.5" rx="4" {...fill} {...stroke} />
          <Path d="M8 3v3.5M16 3v3.5M3.5 10h17" fill="none" {...stroke} />
          <Path d="m9 15 2 2 4-4" fill="none" {...stroke} strokeWidth={on ? 2.2 : 1.7} />
        </>
      ) : name === "calls" ? (
        // Calls: a phone handset.
        <Path
          d="M7.4 3.5c.6 0 1.1.4 1.3.9l1.3 3.2c.2.6.1 1.2-.4 1.6l-1.5 1.3a12 12 0 0 0 5.4 5.4l1.3-1.5c.4-.5 1-.6 1.6-.4l3.2 1.3c.5.2.9.7.9 1.3V19c0 .8-.7 1.5-1.5 1.5C10.6 20.5 3.5 13.4 3.5 5c0-.8.7-1.5 1.5-1.5Z"
          {...fill}
          {...stroke}
        />
      ) : name === "trends" ? (
        // Trends: three bars rising; the tallest is solid when active.
        <>
          <Rect x="3.5" y="13" width="4.5" height="7.5" rx="1.6" {...fill} {...stroke} />
          <Rect x="9.75" y="8.5" width="4.5" height="12" rx="1.6" {...fill} {...stroke} />
          <Rect x="16" y="4" width="4.5" height="16.5" rx="1.6" {...(on ? { fill: color } : { fill: "none" })} {...stroke} />
        </>
      ) : (
        // Family: two people side by side.
        <>
          <Circle cx="9" cy="8" r="3.3" {...fill} {...stroke} />
          <Path d="M3 19.5c0-3.3 2.7-5.8 6-5.8s6 2.5 6 5.8z" {...fill} {...stroke} />
          <Path d="M15.5 4.9a3.2 3.2 0 0 1 0 6.2M17.5 14c2 .7 3.5 2.8 3.5 5.5" fill="none" {...stroke} />
        </>
      )}
    </Svg>
  );
}
