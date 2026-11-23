import { router } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { dial } from "@/components/kin-call";
import { Button, Card, Icon, icon, SectionLabel } from "@/components/kit";
import { confirm } from "@/components/kin-call";
import { gutter, Screen, SubHeader } from "@/components/screen";
import { kinNumber } from "@/lib/data";
import { useKin } from "@/lib/kin";
import { api } from "@/lib/api";
import { registerForPush } from "@/lib/push";
import { API_URL } from "@/lib/session";
import { color } from "@/lib/theme";

export default function Settings() {
  const { mode, email, family, signOut, deleteAccount } = useKin();
  const sample = mode === "sample";
  const owner = family.members.find((m) => m.id === family.meId)?.role === "Owner";
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [test, setTest] = useState<{ busy: boolean; note: string }>({ busy: false, note: "" });

  async function sendTest() {
    setTest({ busy: true, note: "" });
    try {
      await registerForPush(); // make sure this phone's token is on the server
      const r = await api.pushTest("amber");
      setTest({ busy: false, note: r.sent ? "Sent. It should arrive in a few seconds." : "The server couldn't deliver it. Check notifications in iOS Settings." });
    } catch (e) {
      setTest({ busy: false, note: e instanceof Error ? e.message : "Couldn't send." });
    }
  }

  function askDelete() {
    const name = family.parent.name;
    confirm(
      owner ? "Delete the family?" : "Leave the family?",
      owner
        ? `This deletes ${family.name} for everyone: ${name}'s profile, every call summary, message and alert, and every member. Kin stops calling ${name}. This can't be undone.`
        : `You leave ${family.name} and your account is deleted. ${name}'s calls and the rest of the family stay as they are.`,
      owner ? "Delete everything" : "Leave and delete",
      async () => {
        setDeleting(true);
        setError("");
        try {
          await deleteAccount();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not delete. Try again.");
          setDeleting(false);
        }
      },
    );
  }

  return (
    <Screen tabs={false}>
      <SubHeader kicker={family.name} title="Settings" />
      <View style={[gutter, { gap: 10, paddingHorizontal: 16 }]}>
        <Card style={{ gap: 4 }}>
          <SectionLabel>Account</SectionLabel>
          <Text style={styles.title}>{sample ? "Sample family" : email}</Text>
          <Text style={styles.sub}>
            {sample
              ? "Nothing you change here is saved. Sign in to set Kin up for your parent."
              : `${family.name}. Pull down on any screen to load the latest calls.`}
          </Text>
        </Card>

        <Card onPress={() => router.push("/parent")} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Call settings</Text>
            <Text style={styles.sub}>
              {family.parent.dailyCalls ? `Daily at ${family.parent.callTime}` : "Daily calls off"} · {family.parent.language} · {family.parent.callLengthMinutes} min
            </Text>
          </View>
          <Icon d={icon.chevron} size={16} color={color.faint} />
        </Card>

        {!sample ? (
          <Card style={{ gap: 4 }}>
            <SectionLabel>Notifications</SectionLabel>
            <Text style={styles.sub}>Evening cards and alerts arrive as notifications. Send yourself a sample to check they work.</Text>
            <View style={{ marginTop: 8 }}>
              <Button variant="soft" onPress={sendTest} disabled={test.busy}>
                {test.busy ? "Sending…" : "Send a test notification"}
              </Button>
            </View>
            {test.note ? <Text style={[styles.sub, { marginTop: 6 }]}>{test.note}</Text> : null}
          </Card>
        ) : null}

        <Card style={{ gap: 4 }}>
          <SectionLabel>Emergencies</SectionLabel>
          <Text style={styles.sub}>Kin is not an emergency service. In India call 108, in Singapore call 995.</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <View style={{ flex: 1 }}>
              <Button variant="soft" onPress={() => dial("108")}>
                Call 108
              </Button>
            </View>
            <View style={{ flex: 1 }}>
              <Button variant="soft" onPress={() => dial("995")}>
                Call 995
              </Button>
            </View>
          </View>
        </Card>

        <Card style={{ gap: 4 }}>
          <SectionLabel>About</SectionLabel>
          <Text style={styles.sub}>Kin&apos;s number: {kinNumber}</Text>
          <Text style={styles.sub}>Server: {API_URL.replace(/^https?:\/\//, "")}</Text>
          <Text style={styles.sub}>Built by team Rocket</Text>
        </Card>

        <Button variant={sample ? "primary" : "soft"} onPress={signOut}>
          {sample ? "Sign in" : "Sign out"}
        </Button>
        {!sample ? (
          <Pressable accessibilityRole="button" onPress={askDelete} disabled={deleting} style={styles.delete}>
            <Text style={styles.deleteText}>
              {deleting ? "Deleting…" : owner ? "Delete my account and family data" : "Leave the family and delete my account"}
            </Text>
          </Pressable>
        ) : null}
        {error ? <Text style={[styles.sub, { color: color.alert, textAlign: "center" }]}>{error}</Text> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { fontSize: 16, fontWeight: "600", color: color.ink },
  sub: { fontSize: 14, lineHeight: 19, color: color.body },
  delete: { alignItems: "center", paddingVertical: 12 },
  deleteText: { fontSize: 15, fontWeight: "600", color: color.alert },
});
