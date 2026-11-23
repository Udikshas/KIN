import * as Notifications from "expo-notifications";
import { router, Stack, type Href } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { Button, Mesh } from "@/components/kit";
import { Splash } from "@/components/splash";
import { KinProvider, useKin } from "@/lib/kin";
import { pushSupported, routeFor } from "@/lib/push";
import { color } from "@/lib/theme";

SplashScreen.preventAutoHideAsync();

function Routes() {
  const { mode, familyState, error, refresh, signOut } = useKin();
  const waiting = mode === "loading" || (mode === "signed-in" && familyState === "loading");

  if (mode === "loading") return null;
  if (waiting) {
    return (
      <View style={styles.center}>
        <Mesh />
        <ActivityIndicator color={color.ink} />
      </View>
    );
  }
  if (mode === "signed-in" && familyState === "error") {
    return (
      <View style={styles.center}>
        <Mesh />
        <Text style={styles.message}>{error}</Text>
        <View style={{ alignSelf: "stretch", gap: 10, paddingHorizontal: 24 }}>
          <Button onPress={refresh}>Try again</Button>
          <Button variant="soft" onPress={signOut}>
            Sign out
          </Button>
        </View>
      </View>
    );
  }

  const inside = mode === "sample" || (mode === "signed-in" && familyState === "ready");
  const setup = mode === "signed-in" && familyState === "none";

  return (
    <>
      {pushSupported && inside ? <PushTaps /> : null}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.mist } }}>
        <Stack.Protected guard={mode === "signed-out"}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
        <Stack.Protected guard={setup}>
          <Stack.Screen name="setup" />
        </Stack.Protected>
        <Stack.Protected guard={inside}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="call" options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }} />
          <Stack.Screen name="alert" options={{ presentation: "modal" }} />
          <Stack.Screen name="calls/[id]" />
          <Stack.Screen name="memory" />
          <Stack.Screen name="medicines" />
          <Stack.Screen name="introduce" />
          <Stack.Screen name="parent" />
          <Stack.Screen name="member" options={{ presentation: "modal" }} />
          <Stack.Screen name="add-parent" options={{ presentation: "modal" }} />
          <Stack.Screen name="settings" />
          <Stack.Screen name="groceries" />
          <Stack.Screen name="messages" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

/** A tapped push (also the one that opened the app) goes to its call, the alert or the call screen. */
function PushTaps() {
  const response = Notifications.useLastNotificationResponse();
  const { family, switchParent } = useKin();
  const shownPhone = family.parent.phone;
  const handled = useRef<string | null>(null); // switching parent re-runs this; never open one tap twice
  useEffect(() => {
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    if (handled.current === response.notification.request.identifier) return;
    handled.current = response.notification.request.identifier;
    const data = response.notification.request.content.data;
    const to = routeFor(data);
    Notifications.clearLastNotificationResponseAsync();
    if (!to) return;
    // A push about another parent (Papa while Maa is shown) opens their screens.
    const phone = typeof data?.phone === "string" ? data.phone : null;
    (phone && phone !== shownPhone ? switchParent(phone) : Promise.resolve()).finally(() => router.push(to as Href));
  }, [response, shownPhone, switchParent]);
  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <KinProvider>
        <StatusBar style="dark" />
        <Routes />
        <SplashOverlay />
      </KinProvider>
    </SafeAreaProvider>
  );
}

/** The animated splash stays over the app until the first real screen (not the spinner) is there. */
function SplashOverlay() {
  const { mode, familyState } = useKin();
  return <Splash ready={mode !== "loading" && !(mode === "signed-in" && familyState === "loading")} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 20 },
  message: { paddingHorizontal: 32, textAlign: "center", fontSize: 16, lineHeight: 22, color: color.ink },
});
