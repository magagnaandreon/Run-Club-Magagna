import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { C, F, HeaderStat, HeaderStats, RoadHeader, Screen, SectionTitle } from "@/components/run-ui";
import { Achievements } from "@/components/achievements";
import { ProfileAvatar } from "@/components/profile-avatar";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

const MAX_AVATAR_BASE64_CHARS = 400_000;

export default function ProfileScreen() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { user, logout, updateUser } = useAuth();
  const profile = trpc.account.profile.useQuery();
  const saveProfile = trpc.account.saveProfile.useMutation();
  const isCoach = user?.role === "admin";
  const activities = trpc.club.myActivities.useQuery(undefined, { enabled: Boolean(user) && !isCoach });
  const athletes = trpc.club.athletes.useQuery(undefined, { enabled: isCoach });
  const pending = trpc.club.pendingAthletes.useQuery(undefined, { enabled: isCoach });
  const stravaStatus = trpc.strava.status.useQuery(undefined, { enabled: Boolean(user), staleTime: 0 });
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [avatarDraftUri, setAvatarDraftUri] = useState<string | null>(null);
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const thisWeek = (activities.data ?? []).filter((activity) => new Date(activity.completedAt) >= weekStart);
  const weekKm = thisWeek.reduce((total, activity) => total + activity.distanceMeters, 0) / 1000;
  const displayName = profile.data?.name || user?.name || user?.email || "Sua conta";
  const avatarUrl = profile.data?.avatarUrl ?? user?.avatarUrl ?? null;

  const beginEdit = () => {
    setDraftName(displayName);
    setAvatarDraftUri(null);
    setAvatarBase64(null);
    setNotice("");
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setAvatarDraftUri(null);
    setAvatarBase64(null);
    setNotice("");
  };

  const pickPhoto = async () => {
    setNotice("");
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
        exif: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) return;

      const width = Math.round(asset.width);
      const height = Math.round(asset.height);
      if (width < 1 || height < 1) throw new Error("Não foi possível ler as dimensões desta foto.");
      const side = Math.min(width, height);
      const size = Math.min(side, 512);
      const image = await ImageManipulator.manipulate(asset.uri)
        .crop({
          originX: Math.floor((width - side) / 2),
          originY: Math.floor((height - side) / 2),
          width: side,
          height: side,
        })
        .resize({ width: size, height: size })
        .renderAsync();

      let optimized = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.82, base64: true });
      if (optimized.base64 && optimized.base64.length > MAX_AVATAR_BASE64_CHARS) {
        optimized = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.62, base64: true });
      }
      if (!optimized.base64 || optimized.base64.length > MAX_AVATAR_BASE64_CHARS) {
        throw new Error("Esta foto ainda ficou grande. Escolha outra imagem para continuar.");
      }
      setAvatarDraftUri(optimized.uri);
      setAvatarBase64(optimized.base64);
      setNotice("Foto pronta. Toque em salvar para atualizar seu perfil.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível selecionar essa foto.");
    }
  };

  const save = async () => {
    const cleanName = draftName.trim();
    if (cleanName.length < 2) {
      setNotice("Digite um nome com pelo menos 2 caracteres.");
      return;
    }
    setNotice("");
    try {
      const result = await saveProfile.mutateAsync({
        displayName: cleanName,
        ...(avatarBase64 ? { avatarBase64 } : {}),
      });
      await Promise.all([
        updateUser({ name: result.name, avatarUrl: result.avatarUrl }),
        utils.account.profile.invalidate(),
        utils.club.athletes.invalidate(),
        utils.club.coachActivityFeed.invalidate(),
      ]);
      setEditing(false);
      setAvatarDraftUri(null);
      setAvatarBase64(null);
      setNotice("Perfil atualizado.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível salvar as alterações.");
    }
  };

  const signOut = async () => {
    await logout();
    router.replace("/login");
  };

  return <Screen scroll>
    <RoadHeader
      leading={<ProfileAvatar uri={avatarUrl} name={displayName} size={68} />}
      eyebrow={isCoach ? "treinador do clube" : "aluno do clube"}
      title={displayName}
      subtitle={profile.data?.email || user?.email || undefined}
    >
      <HeaderStats>
        {isCoach ? (
          <>
            <HeaderStat accent value={String(athletes.data?.length ?? 0)} label="alunos aprovados" />
            <HeaderStat value={String(pending.data?.length ?? 0)} label="pedidos pendentes" />
          </>
        ) : (
          <>
            <HeaderStat accent value={`${weekKm.toFixed(1).replace(".", ",")} km`} label="nesta semana" />
            <HeaderStat value={String(thisWeek.length)} label={thisWeek.length === 1 ? "corrida na semana" : "corridas na semana"} />
          </>
        )}
      </HeaderStats>
    </RoadHeader>

    {editing ? <View style={styles.editCard}>
      <Text style={styles.editTitle}>Seu perfil, do seu jeito</Text>
      <View style={styles.photoPreview}><ProfileAvatar uri={avatarDraftUri ?? avatarUrl} name={draftName} size={92} /></View>
      <Pressable accessibilityRole="button" onPress={pickPhoto} style={({ pressed }) => [styles.photoButton, pressed && styles.pressed]}>
        <Ionicons name="image-outline" size={18} color={C.ink} />
        <Text style={styles.photoButtonText}>{avatarDraftUri ? "Escolher outra foto" : avatarUrl ? "Trocar foto" : "Adicionar foto"}</Text>
      </Pressable>
      <Text style={styles.formHint}>A foto é recortada e otimizada antes de ser enviada.</Text>
      <Text style={styles.formLabel}>Nome de exibição</Text>
      <TextInput value={draftName} onChangeText={setDraftName} maxLength={120} autoCapitalize="words" autoComplete="name" placeholder="Seu nome" placeholderTextColor={C.muted} style={styles.input} accessibilityLabel="Nome de exibição" />
      <Text style={styles.formLabel}>E-mail (somente leitura)</Text>
      <View style={styles.readOnly}><Text style={styles.readOnlyText}>{profile.data?.email || user?.email || "Não informado"}</Text></View>
      <Text style={styles.formHint}>Sua conta e seu papel não podem ser alterados nesta tela. A foto fica visível apenas no seu perfil e nas telas autorizadas do clube.</Text>
      {notice ? <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text> : null}
      <View style={styles.editActions}>
        <Pressable disabled={saveProfile.isPending} onPress={cancelEdit} style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}><Text style={styles.cancelText}>Cancelar</Text></Pressable>
        <Pressable disabled={saveProfile.isPending} onPress={save} style={({ pressed }) => [styles.saveButton, saveProfile.isPending && styles.disabled, pressed && styles.pressed]}>
          {saveProfile.isPending ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>Salvar alterações</Text>}
        </Pressable>
      </View>
    </View> : notice ? <Text accessibilityLiveRegion="polite" style={styles.successNotice}>{notice}</Text> : null}
    {profile.error ? <Text style={styles.profileError}>Não foi possível atualizar os dados do perfil. Tente novamente.</Text> : null}

    {isCoach ? null : <Achievements />}

    <View style={styles.gap} />
    <SectionTitle title="Conta" />
    <View style={styles.list}>
      <Pressable accessibilityRole="button" onPress={() => router.push("/strava")} style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
        <Text style={styles.itemText}>Strava</Text>
        <View style={styles.status}><View style={[styles.statusDot, stravaStatus.data?.connected && styles.statusOn]} /><Text style={styles.statusText}>{stravaStatus.data?.connected ? "conectado" : stravaStatus.data?.configured ? "conectar" : "indisponível"}</Text></View>
        <Ionicons name="chevron-forward" size={18} color={C.muted} />
      </Pressable>
      <Pressable accessibilityRole="button" onPress={beginEdit} style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
        <Text style={styles.itemText}>Nome e foto</Text>
        <Ionicons name="chevron-forward" size={18} color={C.muted} />
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.push("/(tabs)/club")} style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
        <Text style={styles.itemText}>{isCoach ? "Alunos e treinos" : "Agenda e avaliações"}</Text>
        <Ionicons name="chevron-forward" size={18} color={C.muted} />
      </Pressable>
      <Pressable accessibilityRole="button" onPress={signOut} style={({ pressed }) => [styles.item, styles.itemLast, pressed && styles.pressed]}>
        <Text style={styles.signOutText}>Sair da conta</Text>
      </Pressable>
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  editCard: { padding: 18, borderRadius: 14, backgroundColor: C.road, marginBottom: 8 },
  editTitle: { color: C.ink, fontSize: 22, fontFamily: F.display, textTransform: "uppercase", marginBottom: 14 },
  photoPreview: { alignItems: "center", marginBottom: 10 },
  photoButton: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 7, minHeight: 42, paddingHorizontal: 14, borderRadius: 12, backgroundColor: C.stone },
  photoButtonText: { color: C.ink, fontSize: 13, fontFamily: F.textBold },
  formHint: { color: C.muted, fontSize: 12, lineHeight: 16, fontFamily: F.text, marginTop: 8 },
  formLabel: { color: C.ink, fontSize: 12, fontFamily: F.textBold, marginTop: 16, marginBottom: 7 },
  input: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.paper, paddingHorizontal: 14, color: C.ink, fontSize: 14, fontFamily: F.text },
  readOnly: { minHeight: 46, justifyContent: "center", paddingHorizontal: 14, borderRadius: 14, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line },
  readOnlyText: { color: C.muted, fontSize: 13, fontFamily: F.textSemi },
  notice: { color: "#A74736", fontSize: 12, lineHeight: 17, fontFamily: F.textSemi, marginTop: 11 },
  successNotice: { color: C.inkSoft, fontSize: 12, fontFamily: F.textBold, marginTop: 7, paddingHorizontal: 4 },
  profileError: { color: "#A74736", fontSize: 12, fontFamily: F.textSemi, marginTop: 8 },
  editActions: { flexDirection: "row", gap: 10, marginTop: 18 },
  cancelButton: { flex: 1, minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: C.stone },
  cancelText: { color: C.ink, fontSize: 13, fontFamily: F.textBold },
  saveButton: { flex: 1.3, minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: C.cone },
  saveText: { color: "#FFFFFF", fontSize: 17, fontFamily: F.displayBold, letterSpacing: 1.2, textTransform: "uppercase" },
  disabled: { opacity: 0.55 },
  gap: { height: 22 },
  list: { borderRadius: 14, backgroundColor: C.road },
  item: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: C.line },
  itemLast: { borderBottomWidth: 0 },
  itemText: { flex: 1, color: C.ink, fontFamily: F.text, fontSize: 15 },
  status: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#9EA19C" },
  statusOn: { backgroundColor: "#3F7A12" },
  statusText: { color: C.inkSoft, fontFamily: F.text, fontSize: 13 },
  signOutText: { color: C.cone, fontFamily: F.textSemi, fontSize: 15 },
  pressed: { opacity: 0.72 },
});
