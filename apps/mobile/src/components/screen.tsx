import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useKin } from "@/lib/kin";
import { color, display, glass } from "@/lib/theme";

import { Avatar, GlassButton, Icon, icon, Mesh } from "./kit";
import { MemberSheet } from "./parent-switcher";

/** Back, or Today when there is nothing to go back to (web reload, deep link). */
export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

/** Height reserved for the floating tab bar so content scrolls clear of it. */
export const TAB_SPACE = 104;

/**
 * Mesh wallpaper + scrolling content, padded for the notch and tab bar. Pull down to reload (signed in).
 * `sheet`: the route opens as an iOS page sheet (presentation "modal"), which starts below the notch.
 */
export function Screen({ children, tabs = true, sheet = false }: { children: ReactNode; tabs?: boolean; sheet?: boolean }) {
  const insets = useSafeAreaInsets();
  const top = sheet && Platform.OS === "ios" ? 10 : Math.max(insets.top + 2, 12);
  const { mode, refreshing, refresh } = useKin();
  return (
    <View style={styles.fill}>
      <Mesh />
      <ScrollView
        contentContainerStyle={{ paddingTop: top, paddingBottom: (tabs ? TAB_SPACE : 24) + insets.bottom }}
        showsVerticalScrollIndicator={false}
        // Sheets (Modal) rendered inside a screen are React children of this ScrollView, so with the
        // default "never" it swallows their first tap while the keyboard is up (Cancel did nothing).
        keyboardShouldPersistTaps="handled"
        refreshControl={mode === "signed-in" ? <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={color.ink} /> : undefined}
      >
        {children}
      </ScrollView>
    </View>
  );
}

/** The glass "Amma" pill at the top left of every tab: the name opens their profile, the arrow switches who is shown. */
export function ParentPill() {
  const { family } = useKin();
  const [open, setOpen] = useState(false);
  return (
    <>
      <View style={[glass, styles.parentPill]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${family.parent.name}'s profile`}
          onPress={() => router.push("/parent")}
          style={({ pressed }) => [styles.pillMain, pressed && { opacity: 0.6 }]}
        >
          <Avatar name={family.parent.avatar ?? family.parent.name} size={36} />
          <Text style={styles.parentName}>{family.parent.name}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Showing ${family.parent.name}. Switch`}
          hitSlop={{ top: 8, bottom: 8, right: 8 }}
          onPress={() => setOpen(true)}
          style={({ pressed }) => [styles.pillSwitch, pressed && { opacity: 0.6 }]}
        >
          <View style={{ transform: [{ rotate: "90deg" }] }}>
            <Icon d={icon.chevron} size={12} width={2.6} color={color.body} />
          </View>
        </Pressable>
      </View>
      <MemberSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** iOS 26 style: glass toolbar on top, large title underneath. */
export function Header({ kicker, title, right }: { kicker?: string; title: string; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      <View style={styles.toolbar}>
        <ParentPill />
        <View style={styles.right}>
          {right ?? (
            <GlassButton label="Settings" onPress={() => router.push("/settings")}>
              <Icon d={icon.more} width={3} />
            </GlassButton>
          )}
        </View>
      </View>
      <View style={styles.titleBlock}>
        {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
        <Text style={[display, styles.title]}>{title}</Text>
      </View>
    </View>
  );
}

/** Header for pushed screens: glass back button with the title beside it, kicker underneath. */
export function SubHeader({ kicker, title, onClose }: { kicker?: string; title: string; onClose?: () => void }) {
  return (
    <View style={[styles.header, styles.subHeader]}>
      <GlassButton label="Back" onPress={onClose ?? goBack}>
        <Icon d={icon.back} />
      </GlassButton>
      {title || kicker ? (
        <View style={styles.subTitleBlock}>
          <Text style={styles.subTitle} numberOfLines={2}>
            {title}
          </Text>
          {kicker ? (
            <Text style={styles.subKicker} numberOfLines={1}>
              {kicker}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export const gutter = { paddingHorizontal: 14, gap: 8 } as const;

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.mist },
  header: { paddingHorizontal: 18 },
  toolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 },
  right: { flexDirection: "row", gap: 8 },
  parentPill: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 999, paddingVertical: 4, paddingLeft: 4 },
  pillMain: { flexDirection: "row", alignItems: "center", gap: 8 },
  pillSwitch: { alignSelf: "stretch", justifyContent: "center", paddingLeft: 4, paddingRight: 14 },
  parentName: { fontSize: 15, fontWeight: "600", color: color.ink },
  titleBlock: { paddingHorizontal: 4, paddingTop: 8, paddingBottom: 14 },
  kicker: { fontSize: 14, fontWeight: "500", color: color.body },
  title: { fontSize: 34, lineHeight: 38, marginTop: 2 },
  subHeader: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44, paddingBottom: 14 },
  subTitleBlock: { flex: 1 },
  subTitle: { fontSize: 22, lineHeight: 26, fontWeight: "600", letterSpacing: -0.5, color: color.ink },
  subKicker: { marginTop: 1, fontSize: 13, fontWeight: "500", color: color.body },
});
