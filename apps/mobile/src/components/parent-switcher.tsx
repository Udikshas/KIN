import { router } from "expo-router";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { confirm } from "@/components/kin-call";
import { Avatar, Icon, icon, SheetHeader } from "@/components/kit";
import { useKin } from "@/lib/kin";
import { color, glass, metric } from "@/lib/theme";

function useAddMember() {
  const { mode, signOut } = useKin();
  return () =>
    mode === "signed-in"
      ? router.push("/add-parent")
      : confirm("Sign in first", "Kin can only call people you have set up. Sign in to add someone.", "Sign in", signOut);
}

/**
 * Quick switch from any tab: opened from the name pill at the top left.
 * One tap on a person shows them everywhere and closes the sheet.
 */
export function MemberSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { family, switchParent } = useKin();
  const add = useAddMember();
  const go = (fn: () => void) => () => {
    onClose();
    fn();
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close" onPress={onClose} style={styles.scrim}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.grabber} />
          <SheetHeader title="Show" onClose={onClose} />
          <View style={[glass, styles.list]}>
            {family.parents.map((p, i) => {
              const on = p.phone === family.parent.phone;
              return (
                <Pressable
                  key={p.phone}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`Show ${p.name}`}
                  onPress={go(() => !on && switchParent(p.phone))}
                  style={({ pressed }) => [styles.item, i > 0 && styles.itemLine, pressed && styles.itemPressed]}
                >
                  <View>
                    <Avatar name={p.avatar ?? p.name} size={40} />
                    {p.alert && p.alert !== "green" ? (
                      <View style={[styles.alertDot, { backgroundColor: p.alert === "red" ? color.alert : metric.gold }]} />
                    ) : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{p.name}</Text>
                    {p.alert && p.alert !== "green" ? (
                      <Text style={styles.itemSub}>{p.alert === "red" ? "Needs attention" : "Something to watch"}</Text>
                    ) : null}
                  </View>
                  {on ? (
                    <View style={styles.tick}>
                      <Icon d={icon.check} size={14} width={2.6} color="#fff" />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          <View style={[glass, styles.list]}>
            <Pressable accessibilityRole="button" onPress={go(add)} style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}>
              <View style={styles.addIcon}>
                <Icon d={icon.plus} size={16} width={2.2} color={color.ink} />
              </View>
              <Text style={[styles.itemName, { flex: 1 }]}>Add a parent</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={go(() => router.push("/parent"))}
              style={({ pressed }) => [styles.item, styles.itemLine, pressed && styles.itemPressed]}
            >
              <View style={styles.addIcon}>
                <Icon d={icon.pencil} size={16} width={2} color={color.ink} />
              </View>
              <Text style={[styles.itemName, { flex: 1 }]}>Edit {family.parent.name}&apos;s profile</Text>
              <Icon d={icon.chevron} size={14} color={color.faint} />
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  addIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(34,35,38,0.06)" },
  name: { fontSize: 15, fontWeight: "600", color: color.ink },
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  sheet: { backgroundColor: color.mist, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 8, paddingHorizontal: 16, gap: 12 },
  grabber: { alignSelf: "center", width: 36, height: 5, borderRadius: 3, backgroundColor: "rgba(34,35,38,0.18)" },
  list: { borderRadius: 22, overflow: "hidden" },
  item: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, paddingHorizontal: 14, paddingVertical: 10 },
  itemLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(34,35,38,0.12)" },
  itemPressed: { backgroundColor: "rgba(34,35,38,0.05)" },
  itemName: { fontSize: 17, fontWeight: "600", color: color.ink },
  itemSub: { marginTop: 1, fontSize: 13, color: color.body },
  tick: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: color.charcoal },
  alertDot: { position: "absolute", top: -1, right: -1, width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: "#fff" },
});
