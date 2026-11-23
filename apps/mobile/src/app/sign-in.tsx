import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CodeInput, type CodeInputHandle } from "@/components/code-input";
import { AppIcon, Button, Icon, icon, Mesh } from "@/components/kit";
import { useKeyboardOpen } from "@/lib/keyboard";
import { useKin } from "@/lib/kin";
import { resendCode, sendCode, verifyCode, type CodeRequest } from "@/lib/session";
import { color, display, glass, radius } from "@/lib/theme";
import { cleanEmail, emailError } from "@/lib/validate";

const RESEND_WAIT = 30; // seconds before another code can be sent
const CODE_LENGTH = 6; // SuperTokens passwordless codes

export default function SignIn() {
  const insets = useSafeAreaInsets();
  const { signedIn, trySample } = useKin();
  const keyboard = useKeyboardOpen();
  const codeRef = useRef<CodeInputHandle>(null);
  const [email, setEmail] = useState("");
  const [emailFocused, setEmailFocused] = useState(false);
  const [code, setCode] = useState("");
  const [req, setReq] = useState<CodeRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const emailOk = !emailError(email, true);

  async function onSend() {
    const e = cleanEmail(email);
    const bad = emailError(e, true);
    if (bad) return setError(bad);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      setReq(await sendCode(e));
      setWait(RESEND_WAIT);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the code.");
    } finally {
      setBusy(false);
    }
  }

  async function onResend() {
    if (!req || wait > 0) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await resendCode(req);
      setCode("");
      setNotice("New code sent. Use the latest email.");
      codeRef.current?.focus();
      setWait(RESEND_WAIT);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the code.");
      setReq(null);
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  async function onVerify(entered = code) {
    if (!req || busy) return;
    if (entered.length < CODE_LENGTH) return setError("Enter the 6-digit code from the email.");
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const e = cleanEmail(email);
      await verifyCode(req, entered, e);
      signedIn(e);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
      setCode("");
      if (err instanceof Error && /start again/.test(err.message)) setReq(null);
      else {
        codeRef.current?.shake();
        codeRef.current?.focus();
      }
    } finally {
      setBusy(false);
    }
  }

  const changeEmail = () => {
    setReq(null);
    setCode("");
    setError("");
    setNotice("");
  };

  return (
    <View style={styles.fill}>
      <Mesh />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.fill}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + (keyboard ? 12 : 40), paddingBottom: insets.bottom + (keyboard ? 12 : 20) }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.brand, keyboard && styles.brandSmall]}>
            <AppIcon size={keyboard ? 40 : 60} />
            <Text style={[display, keyboard ? styles.titleSmall : styles.title]}>Kin</Text>
            {keyboard ? null : (
              <Text style={styles.lead}>A daily call that keeps your parent safe. Kin phones them every day in their own language and tells you what changed.</Text>
            )}
          </View>

          <View style={[glass, styles.panel]}>
            {req ? (
              <>
                <Pressable onPress={changeEmail} hitSlop={8} style={styles.back} accessibilityRole="button">
                  <View style={{ transform: [{ scaleX: -1 }] }}>
                    <Icon d={icon.chevron} size={14} width={2.4} color={color.body} />
                  </View>
                  <Text style={styles.backText}>Change email</Text>
                </Pressable>
                <View style={styles.heading}>
                  <Text style={styles.panelTitle}>Check your email</Text>
                  <Text style={styles.panelSub}>
                    Enter the 6-digit code we sent to <Text style={styles.strong}>{cleanEmail(email)}</Text>
                  </Text>
                </View>
                <CodeInput
                  ref={codeRef}
                  value={code}
                  length={CODE_LENGTH}
                  error={Boolean(error)}
                  disabled={busy}
                  onChange={(v) => {
                    setCode(v);
                    if (error) setError("");
                  }}
                  onFilled={onVerify}
                />
                <Text style={[styles.status, error ? styles.error : null]}>{error || notice || " "}</Text>
                <Button onPress={() => onVerify()} disabled={busy || code.length < CODE_LENGTH}>
                  {busy ? "Checking…" : "Sign in"}
                </Button>
                <Pressable onPress={onResend} disabled={busy || wait > 0} style={styles.resend} accessibilityRole="button">
                  <Text style={styles.resendText}>
                    Didn&apos;t get it?{" "}
                    <Text style={wait > 0 || busy ? styles.resendOff : styles.resendOn}>
                      {wait > 0 ? `Send again in 0:${String(wait).padStart(2, "0")}` : "Send a new code"}
                    </Text>
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <View style={styles.heading}>
                  <Text style={styles.panelTitle}>Sign in or sign up</Text>
                  <Text style={styles.panelSub}>We&apos;ll email you a 6-digit code. No password needed.</Text>
                </View>
                <View style={[styles.field, emailFocused && styles.fieldFocused, error ? styles.fieldError : null]}>
                  <Icon d={icon.mail} size={19} color={emailFocused ? color.ink : color.faint} />
                  <TextInput
                    value={email}
                    onChangeText={(v) => {
                      setEmail(v.replace(/\s/g, ""));
                      if (error) setError("");
                    }}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => {
                      setEmailFocused(false);
                      if (email) setError(emailError(email, true));
                    }}
                    placeholder="you@example.com"
                    placeholderTextColor={color.faint}
                    keyboardType="email-address"
                    inputMode="email"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    textContentType="emailAddress"
                    maxLength={254}
                    returnKeyType="send"
                    enterKeyHint="send"
                    onSubmitEditing={onSend}
                    style={styles.fieldInput}
                  />
                </View>
                {error ? <Text style={[styles.status, styles.error]}>{error}</Text> : null}
                <Button onPress={onSend} disabled={busy || !emailOk}>
                  {busy ? "Sending…" : "Email me a code"}
                </Button>
                <View style={styles.or}>
                  <View style={styles.orLine} />
                  <Text style={styles.orText}>or</Text>
                  <View style={styles.orLine} />
                </View>
                <Button variant="soft" onPress={trySample}>
                  Look around with a sample family
                </Button>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "space-between", paddingHorizontal: 16, gap: 24 },
  brand: { paddingHorizontal: 12, gap: 12 },
  brandSmall: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontSize: 48, lineHeight: 52, marginTop: 6 },
  titleSmall: { fontSize: 26, lineHeight: 30 },
  lead: { fontSize: 18, lineHeight: 25, color: color.body },
  panel: { borderRadius: radius.card, padding: 20, gap: 14 },
  heading: { gap: 4 },
  panelTitle: { fontSize: 22, lineHeight: 27, fontWeight: "600", letterSpacing: -0.5, color: color.ink },
  panelSub: { fontSize: 15, lineHeight: 21, color: color.body },
  strong: { fontWeight: "600", color: color.ink },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 54,
    paddingHorizontal: 16,
    borderRadius: radius.input,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderWidth: 1.5,
    borderColor: "rgba(34,35,38,0.08)",
  },
  fieldFocused: { backgroundColor: "#fff", borderColor: color.ink },
  fieldError: { borderColor: color.alert },
  // outlineWidth: the field draws its own focus border (web would add a second one).
  fieldInput: { flex: 1, height: "100%", fontSize: 17, color: color.ink, outlineWidth: 0 },
  status: { minHeight: 18, marginTop: -4, fontSize: 14, lineHeight: 18, color: color.body, textAlign: "center" },
  error: { color: color.alert },
  back: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" },
  backText: { fontSize: 14, fontWeight: "600", color: color.body },
  resend: { alignSelf: "center", paddingVertical: 4 },
  resendText: { fontSize: 14, color: color.body },
  resendOn: { fontWeight: "600", color: color.ink },
  resendOff: { color: color.faint },
  or: { flexDirection: "row", alignItems: "center", gap: 10 },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: "rgba(34,35,38,0.18)" },
  orText: { fontSize: 13, color: color.faint },
});
