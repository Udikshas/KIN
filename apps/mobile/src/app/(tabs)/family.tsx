import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { dial } from "@/components/kin-call";
import { Avatar, Card, Icon, icon, MedIcon, SectionLabel } from "@/components/kit";
import { formatPhone } from "@/components/form";
import { gutter, Header, Screen } from "@/components/screen";
import { kinNumber } from "@/lib/data";
import { useKin } from "@/lib/kin";
import { color, metric } from "@/lib/theme";

export default function Family() {
  const { family, switchParent } = useKin();
  const { parent } = family;
  // The parents Kin calls sit at the top, like the people: a tap opens that parent's profile.
  const openParent = async (phone: string) => {
    if (phone !== parent.phone) await switchParent(phone);
    router.push("/parent");
  };
  const emergency = family.members.find((m) => m.is_emergency);
  return (
    <Screen>
      <Header
        kicker={`${parent.name}'s circle`}
        title="Family"
      />
      <View style={gutter}>
        <Card style={{ gap: 14, marginTop: 4 }}>
          {family.parents.map((x) => (
            <Pressable
              key={x.phone}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${x.name}'s profile`}
              onPress={() => openParent(x.phone)}
              style={({ pressed }) => [styles.member, pressed && { opacity: 0.6 }]}
            >
              <Avatar name={x.avatar ?? x.name} size={42} />
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{x.name}</Text>
                <Text style={styles.sub}>
                  {[formatPhone(x.phone), x.phone === parent.phone ? parent.city : ""].filter(Boolean).join(" · ")}
                </Text>
              </View>
              <Text style={styles.tag}>Kin calls</Text>
              <Icon d={icon.chevron} size={16} color={color.faint} />
            </Pressable>
          ))}
          {family.members.map((m) => (
            <Pressable
              key={m.id}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${m.name}`}
              onPress={() => router.push({ pathname: "/member", params: { id: m.id } })}
              style={({ pressed }) => [styles.member, pressed && { opacity: 0.6 }]}
            >
              <Avatar name={m.avatar ?? m.name} size={42} />
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{m.name}{m.id === family.meId ? " (you)" : ""}</Text>
                <Text style={styles.sub}>{[m.relation, m.city].filter(Boolean).join(" · ")}</Text>
              </View>
              {m.role ? <Text style={styles.tag}>{m.role}</Text> : m.email && !m.linked ? <Text style={[styles.tag, styles.invited]}>Invited</Text> : null}
              <Icon d={icon.chevron} size={16} color={color.faint} />
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add a family member"
            onPress={() => router.push("/member")}
            style={({ pressed }) => [styles.addMember, pressed && { opacity: 0.6 }]}
          >
            <Icon d={icon.plus} size={16} width={2.2} color={color.body} />
            <Text style={styles.addText}>Member</Text>
          </Pressable>
        </Card>

        <Card onPress={() => router.push("/medicines")} style={styles.rowCard}>
          <MedIcon tint={metric.blue} size={40} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Medicines</Text>
            <Text style={styles.sub}>{family.medicines.length} checked on every call</Text>
          </View>
          <Icon d={icon.chevron} size={16} color={color.faint} />
        </Card>

        <Card onPress={() => router.push("/groceries")} style={styles.rowCard}>
          <View style={[styles.square, { backgroundColor: `${metric.green}22` }]}>
            <Text style={{ fontSize: 20 }}>🛒</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Groceries</Text>
            <Text style={styles.sub}>
              {(() => {
                const g = family.parent.groceries ?? [];
                const due = g.filter((x) => x.due).length;
                return g.length ? (due ? `${due} due this week · ${g.length} on the list` : `${g.length} on the list, nothing due`) : "Monthly shopping for the home";
              })()}
            </Text>
          </View>
          <Icon d={icon.chevron} size={16} color={color.faint} />
        </Card>

        <Card onPress={() => router.push("/introduce")} style={styles.rowCard}>
          <View style={[styles.square, { backgroundColor: `${metric.lilac}22` }]}>
            <Icon d={icon.phone} size={20} color={metric.lilac} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Introduce Kin</Text>
            <Text style={styles.sub}>
              {parent.consentAt ? `${parent.name} said yes on a call` : "Merge Kin into a call with " + parent.name}
            </Text>
          </View>
          <Icon d={icon.chevron} size={16} color={color.faint} />
        </Card>

        <Card style={styles.rowCard} onPress={emergency?.phone ? () => dial(emergency.phone!) : undefined}>
          <View style={[styles.circle, { backgroundColor: color.alertSoft }]}>
            <Text style={styles.sos}>108</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Emergency</Text>
            <Text style={styles.sub}>
              {emergency ? `Kin connects ${parent.name} to ${emergency.name} on a red alert` : "Choose who Kin connects on a red alert"}
            </Text>
          </View>
        </Card>

        <View style={{ paddingHorizontal: 6, paddingTop: 6, gap: 4 }}>
          <SectionLabel>Kin&apos;s number</SectionLabel>
          <Text style={styles.sub}>
            Save {kinNumber} in {parent.name}&apos;s phone as &ldquo;Kin&rdquo;. They can call it any time.
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  addMember: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 999, borderWidth: 1.5, borderStyle: "dashed", borderColor: "rgba(34,35,38,0.2)", paddingVertical: 10 },
  addText: { fontSize: 15, fontWeight: "600", color: color.body },
  member: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { fontSize: 16, fontWeight: "600", color: color.ink },
  sub: { fontSize: 13, lineHeight: 18, color: color.body },
  tag: { overflow: "hidden", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.7)", paddingHorizontal: 10, paddingVertical: 4, fontSize: 12, fontWeight: "600", color: color.ink },
  rowCard: { flexDirection: "row", alignItems: "center", gap: 12 },
  square: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  circle: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  invited: { backgroundColor: "transparent", borderWidth: 1, borderColor: color.line, color: color.body },
  sos: { fontSize: 15, fontWeight: "700", color: color.alert },
});
