// Push notifications: this phone gets the family's evening card and alerts
// (sent by apps/api/app/push.py through the Expo Push API).
//
// Works on a real phone only: iOS in Expo Go or a build; Android needs a build
// (APK) with FCM credentials set up in EAS, since Expo Go on Android has no
// remote push from SDK 53. Web and simulators skip it.

import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { api } from "./api";

const TOKEN_KEY = "kin.pushToken";
export const pushSupported = Platform.OS !== "web";

if (pushSupported) {
  // Show the card even when the app is open.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
  });
}

/** Asks once for permission and registers this phone with the API. Quietly gives up if not possible. */
export async function registerForPush(): Promise<void> {
  if (!pushSupported || !Device.isDevice) return;
  try {
    if (Platform.OS === "android") {
      // Android 13+ only shows the permission prompt once a channel exists; the API sends to "default".
      await Notifications.setNotificationChannelAsync("default", {
        name: "Evening cards and alerts",
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== "granted") return;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    await api.savePushToken(token, Platform.OS === "ios" ? "ios" : "android");
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch (e) {
    console.log("push: not registered", e instanceof Error ? e.message : e);
  }
}

/** On sign-out: stop pushes to this phone (before the session is cleared). */
export async function unregisterPush(): Promise<void> {
  if (!pushSupported) return;
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!token) return;
    await api.deletePushToken(token);
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // Signing out still works; the API drops dead tokens when Expo reports them.
  }
}

/** Where a tapped notification should open: a call, the alert, or the call screen. */
export function routeFor(data: unknown): string | null {
  const d = (data ?? {}) as { callId?: number | string | null; screen?: string };
  if (d.callId) return `/calls/${d.callId}`;
  if (d.screen === "alert") return "/alert";
  if (d.screen === "call") return "/call";
  if (d.screen === "today") return "/"; // a "tell my family" message: shown on Today
  if (d.screen === "parent") return "/parent"; // the parent asked Kin to stop calling
  if (d.screen === "medicines") return "/medicines"; // a medicine reminder wasn't taken or answered
  if (d.screen === "groceries") return "/groceries"; // the weekly "groceries due" nudge
  return null;
}
