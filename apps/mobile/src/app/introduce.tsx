import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { dial } from "@/components/kin-call";
import { AppIcon, Avatar, Button, Check } from "@/components/kit";
import { gutter, Screen, SubHeader } from "@/components/screen";
import { kinNumber } from "@/lib/data";
import { useKin } from "@/lib/kin";
import { color, glass, metric } from "@/lib/theme";

/** The introduction call: child calls the parent, adds Kin's number, merges. See CLAUDE.md "Introduction call". */
export default function Introduce() {
  const { family } = useKin();
  const { parent } = family;
  const owner = family.members.find((m) => m.role === "Owner");
  const [copied, setCopied] = useState(false);
  const consented = !!parent.consentAt;

  const steps = [
    { title: `Call ${parent.name}`, sub: "Like any other evening" },
    { title: "Tap Add call", sub: `Dial Kin: ${kinNumber}` },
    { title: "Tap Merge", sub: `Kin says hello and asks for ${parent.name}'s OK` },
  ];

  return (
    <Screen tabs={false}>
      <SubHeader kicker="Takes about two minutes" title="Introduce Kin" />
      <View style={[gutter, { gap: 10, paddingHorizontal: 16 }]}>
        {steps.map((s, i) => (
          <View key={s.title} style={[glass, styles.step]}>
            {consented ? (
              <Check />
            ) : (
              <View style={styles.num}>
                <Text style={styles.numText}>{i + 1}</Text>
              </View>
            )}
            <View>
              <Text style={styles.title}>{s.title}</Text>
              <Text style={styles.sub}>{s.sub}</Text>
            </View>
          </View>
        ))}

        {consented ? (
          <View style={[glass, styles.step]}>
            <View style={styles.faces}>
              {owner?.avatar ? <Avatar name={owner.avatar} size={36} /> : null}
              <View style={{ marginLeft: -10 }}>
                <Avatar name={parent.avatar ?? parent.name} size={36} />
              </View>
              <View style={{ marginLeft: -10 }}>
                <AppIcon size={36} round />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Consent recorded</Text>
              <Text style={styles.sub}>In {parent.name}&apos;s own words, on {new Date(parent.consentAt + "T12:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</Text>
            </View>
            <Check />
          </View>
        ) : null}

        <View style={{ gap: 10, marginTop: 6 }}>
          <Button onPress={() => dial(parent.phone)}>{`Call ${parent.name}`}</Button>
          <Button
            variant="soft"
            onPress={async () => {
              await Clipboard.setStringAsync(kinNumber.replace(/\s/g, ""));
              setCopied(true);
            }}
          >
            {copied ? "Kin's number copied" : "Copy Kin's number"}
          </Button>
        </View>
        <Text style={styles.note}>
          Kin only calls after {parent.name} says yes on this call. Call from the number saved for {owner?.name ?? "you"} in Family, so Kin knows who is introducing it.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 26, padding: 14 },
  num: { width: 26, height: 26, borderRadius: 13, backgroundColor: metric.blue, alignItems: "center", justifyContent: "center" },
  numText: { fontSize: 12, fontWeight: "600", color: "#fff" },
  title: { fontSize: 16, fontWeight: "600", color: color.ink },
  sub: { fontSize: 13, color: color.body },
  faces: { flexDirection: "row" },
  note: { paddingHorizontal: 4, fontSize: 13, lineHeight: 18, color: color.body },
});
