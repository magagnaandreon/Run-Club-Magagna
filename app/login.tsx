import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";

import { C, F, NUM } from "@/components/run-ui";
import { heroKm, RouteMapHero } from "@/components/route-map-hero";
import { useIsDesktop } from "@/hooks/use-layout";
import { oauthErrorMessage, startGoogleLogin } from "@/constants/oauth";
import { completeSignIn } from "@/lib/_core/api";
import { trpc } from "@/lib/trpc";

export default function LoginScreen() {
  const router = useRouter();
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState(() => reason === "rejected"
    ? "Este cadastro não foi aprovado. Fale com seu treinador para saber como continuar."
    : reason === "not-athlete"
      ? "Esta conta não é um aluno aprovado nem está configurada como conta do treinador. Fale com seu treinador."
      : reason === "session"
        ? "Não foi possível confirmar sua sessão. Entre novamente."
        : "");
  const [googleBusy, setGoogleBusy] = useState(false);
  const signIn = trpc.account.signIn.useMutation();
  const desktop = useIsDesktop();
  const insets = useSafeAreaInsets();
  const [distance, setDistance] = useState(0);

  const submit = async () => {
    setNotice("");
    try {
      const result = await signIn.mutateAsync({ email, password });
      if (result.status === "pending") {
        router.replace({ pathname: "/pending", params: { email } });
        return;
      }
      if (result.status === "rejected") {
        setNotice("Este cadastro não foi aprovado. Fale com seu treinador para saber como continuar.");
        return;
      }
      if (!(await completeSignIn(result.sessionToken))) throw new Error("Não foi possível confirmar sua sessão.");
      router.replace("/(tabs)");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível entrar agora.");
    }
  };

  const googleLogin = async () => {
    setNotice("");
    setGoogleBusy(true);
    try {
      // On web this navigates away; the result arrives at /oauth/callback.
      const result = await startGoogleLogin();
      if (!result) return;
      if (result.kind === "token") {
        if (!(await completeSignIn(result.token))) throw new Error("Não foi possível confirmar sua sessão.");
        router.replace("/(tabs)");
      } else if (result.kind === "status") {
        if (result.status === "pending") router.replace({ pathname: "/pending", params: { email: result.email } });
        else setNotice("Este cadastro não foi aprovado. Fale com seu treinador para saber como continuar.");
      } else {
        setNotice(oauthErrorMessage(result.error));
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : oauthErrorMessage("google_failed"));
    } finally {
      setGoogleBusy(false);
    }
  };

  const busy = signIn.isPending;
  const km = heroKm(distance);
  const seconds = Math.floor(km * 312);
  const stats = (
    <View style={styles.stats}>
      <HeroStat value={km.toFixed(2).replace(".", ",")} label="km" />
      <HeroStat value={`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`} label="tempo" />
      <HeroStat value="5:12" label="/km" />
    </View>
  );

  const form = (
    <View style={[styles.form, desktop && styles.formDesktop]}>
      {desktop ? <Text style={styles.formTitle}>Entre para ver seu próximo treino</Text> : null}
      <Text style={styles.label}>E-mail</Text>
      <TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="voce@email.com" placeholderTextColor={C.muted} style={styles.input} accessibilityLabel="E-mail" />
      <Text style={[styles.label, styles.passwordLabel]}>Senha</Text>
      <TextInput autoCapitalize="none" autoComplete="password" secureTextEntry value={password} onChangeText={setPassword} onSubmitEditing={() => { if (email && password && !busy) submit(); }} placeholder="Sua senha" placeholderTextColor={C.muted} style={styles.input} accessibilityLabel="Senha" />
      {notice ? <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Entrar" disabled={busy || !email || !password} onPress={submit} style={({ pressed }) => [styles.primary, (busy || !email || !password) && styles.disabled, pressed && styles.pressed]}>
        <Text style={styles.primaryText}>{busy ? "Entrando…" : "Largar"}</Text>
      </Pressable>

      <Pressable onPress={() => router.push("/signup")} style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}>
        <Text style={styles.linkText}>Ainda não tem conta? <Text style={styles.linkStrong}>Cadastre-se</Text></Text>
      </Pressable>

      <View style={styles.divider}><View style={styles.dividerLine} /><Text style={styles.dividerText}>ou</Text><View style={styles.dividerLine} /></View>
      <Pressable disabled={googleBusy} onPress={googleLogin} accessibilityRole="button" style={({ pressed }) => [styles.coachButton, googleBusy && styles.disabled, pressed && styles.pressed]}>
        {googleBusy ? <ActivityIndicator color={C.ink} /> : (
          <View style={styles.googleRow}><Text style={styles.googleMark}>G</Text><Text style={styles.coachButtonText}>Continuar com Google</Text></View>
        )}
      </Pressable>
      <Pressable onPress={() => router.push({ pathname: "/signup", params: { coach: "1" } })} style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}>
        <Text style={styles.linkText}>É o treinador? <Text style={styles.linkStrong}>Primeiro acesso</Text></Text>
      </Pressable>
    </View>
  );

  if (desktop) {
    return (
      <View style={styles.desktop}>
        <View style={styles.desktopMap}>
          <RouteMapHero boost={busy} focus={{ x: 0.6, y: 0.5 }} onDistance={setDistance} />
          <View style={styles.desktopCopy} pointerEvents="none">
            <View style={styles.desktopBrand}><Text style={styles.desktopBrandTitle}>Run Club</Text><Text style={styles.heroSub}>Magagna</Text></View>
            <Text style={styles.desktopTitle}>Cada km{"\n"}conta</Text>
            <Text style={styles.desktopSub}>A planilha do treinador e as corridas do Strava no mesmo lugar.</Text>
          </View>
          <View style={styles.desktopStats} pointerEvents="none">{stats}</View>
        </View>
        <ScrollView style={styles.desktopSide} contentContainerStyle={styles.desktopSideContent} keyboardShouldPersistTaps="handled">
          {form}
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.phone}>
      <ScrollView contentContainerStyle={styles.phoneContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { paddingTop: insets.top + 28 }]}>
          <RouteMapHero boost={busy} focus={{ x: 0.58, y: 0.58 }} onDistance={setDistance} />
          <View pointerEvents="none">
            <Text style={styles.heroTitle}>Run Club</Text>
            <Text style={styles.heroSub}>Magagna</Text>
          </View>
          <View style={styles.heroStats} pointerEvents="none">{stats}</View>
        </View>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>{form}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  phone: { flex: 1, backgroundColor: "#222527" },
  phoneContent: { flexGrow: 1 },
  hero: { minHeight: 360, paddingHorizontal: 24, paddingBottom: 28, justifyContent: "space-between", overflow: "hidden", backgroundColor: "#222527" },
  heroTitle: { color: C.road, fontFamily: F.display, fontSize: 52, lineHeight: 50, textTransform: "uppercase", letterSpacing: 1 },
  heroSub: { color: C.lime, fontFamily: F.displayMedium, fontSize: 15, letterSpacing: 4, textTransform: "uppercase", marginTop: 6 },
  heroStats: { marginTop: 120 },
  sheet: { flexGrow: 1, backgroundColor: C.road, borderTopLeftRadius: 22, borderTopRightRadius: 22, marginTop: -18, paddingHorizontal: 20, paddingTop: 24 },

  desktop: { flex: 1, flexDirection: "row", backgroundColor: C.road },
  desktopMap: { flex: 1.25, overflow: "hidden", backgroundColor: "#222527", padding: 56, justifyContent: "space-between" },
  desktopCopy: { gap: 14 },
  desktopTitle: { color: C.road, fontFamily: F.display, fontSize: 76, lineHeight: 70, textTransform: "uppercase" },
  desktopSub: { color: C.onAsphaltMuted, fontFamily: F.text, fontSize: 17, lineHeight: 25, maxWidth: 360 },
  desktopStats: {},
  desktopSide: { flex: 1 },
  desktopSideContent: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingVertical: 48, paddingHorizontal: 32 },

  stats: { flexDirection: "row", gap: 30 },
  stat: { gap: 2 },
  statValue: { color: C.road, fontFamily: F.displayBold, fontSize: 28, lineHeight: 30, ...NUM },
  statLabel: { color: "#8E9294", fontFamily: F.textSemi, fontSize: 12, letterSpacing: 1, textTransform: "uppercase" },

  form: { width: "100%", maxWidth: 480, alignSelf: "center" },
  formDesktop: { maxWidth: 400 },
  formTitle: { color: C.ink, fontFamily: F.display, fontSize: 34, lineHeight: 36, textTransform: "uppercase", marginBottom: 28 },
  desktopBrand: { marginBottom: 36 },
  desktopBrandTitle: { color: C.road, fontFamily: F.display, fontSize: 30, lineHeight: 30, textTransform: "uppercase", letterSpacing: 1 },
  label: { color: C.muted, fontFamily: F.text, fontSize: 14, marginBottom: 7 },
  passwordLabel: { marginTop: 16 },
  input: { minHeight: 52, borderRadius: 12, borderWidth: 1.5, borderColor: "transparent", backgroundColor: C.concrete, paddingHorizontal: 15, color: C.ink, fontSize: 16, fontFamily: F.text },
  primary: { minHeight: 56, borderRadius: 12, backgroundColor: C.cone, alignItems: "center", justifyContent: "center", marginTop: 22 },
  primaryText: { color: "#FFFFFF", fontFamily: F.displayBold, fontSize: 21, letterSpacing: 2, textTransform: "uppercase" },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.85 },
  notice: { color: C.coneInk, backgroundColor: C.coneTint, borderRadius: 10, overflow: "hidden", paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, lineHeight: 19, fontFamily: F.textSemi, marginTop: 14 },
  linkButton: { alignSelf: "center", paddingVertical: 16 },
  linkText: { color: C.muted, fontSize: 14, fontFamily: F.text },
  linkStrong: { color: C.ink, fontFamily: F.textBold },
  divider: { flexDirection: "row", alignItems: "center", gap: 11, marginTop: 4, marginBottom: 14 },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.line },
  dividerText: { color: C.muted, fontSize: 13, fontFamily: F.text },
  coachButton: { minHeight: 50, borderRadius: 12, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.road, alignItems: "center", justifyContent: "center" },
  coachButtonText: { color: C.ink, fontSize: 15, fontFamily: F.textBold },
  googleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  googleMark: { color: C.ink, fontSize: 17, fontFamily: F.textBold },
});
