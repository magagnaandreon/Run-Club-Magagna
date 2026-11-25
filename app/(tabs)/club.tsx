import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { DateChips, EmptyState, KindBadge, Segmented, SourceBadge, STRAVA_ORANGE, formatDay, formatKm, formatPace } from "@/components/dashboard-ui";
import { AppHeader, C, CoachMessage, CoachNote, Pill, PulseDot, Road, RoadStep, Screen, SectionTitle, stepPlate, F } from "@/components/run-ui";
import { RunFinish } from "@/components/run-finish";
import { CoachAthletes } from "@/components/coach-athletes";
import { ProfileAvatar } from "@/components/profile-avatar";
import { ReviewForm } from "@/components/review-form";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

type Effort = "easy" | "challenging" | "intense";
type CoachTab = "team" | "review";
type AthleteTab = "agenda" | "log" | "history";
type ActivityDraft = { date: string; distance: string; minutes: string; note: string; effort: Effort };


const emptyActivityDraft = (): ActivityDraft => ({ date: localDate(), distance: "", minutes: "", note: "", effort: "easy" });


const effortLabels: Record<Effort, string> = {
  easy: "Leve",
  challenging: "Desafiador",
  intense: "Intenso",
};

function localDate(value = new Date()) {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function LoadingState() {
  return <View style={styles.loading}><ActivityIndicator size="large" color={C.ink} /></View>;
}

export default function ClubScreen() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingState />;
  if (user?.role === "admin") return <CoachClub />;
  return <AthleteClub />;
}

function CoachClub() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const pending = trpc.club.pendingAthletes.useQuery();
  const feed = trpc.club.coachActivityFeed.useQuery();
  const refreshTeam = () => Promise.all([utils.club.pendingAthletes.invalidate(), utils.club.athletes.invalidate(), utils.club.clubAthletes.invalidate()]);
  const approve = trpc.club.approveAthlete.useMutation({ onSuccess: refreshTeam });
  const reject = trpc.club.rejectAthlete.useMutation({ onSuccess: refreshTeam });
  const [tab, setTab] = useState<CoachTab | null>(null);
  const openAthlete = (athleteId: number) => router.push({ pathname: "/aluno/[id]", params: { id: String(athleteId) } });
  const [notice, setNotice] = useState("");

  const pageError = pending.error || feed.error;
  const toReview = (feed.data ?? []).filter((entry) => !entry.review);
  if (pending.isLoading || feed.isLoading) return <LoadingState />;
  // Open where the coach is needed first: approvals, then reviews.
  const activeTab: CoachTab = tab ?? (pending.data?.length ? "team" : toReview.length ? "review" : "team");

  return (
    <Screen scroll>
      <AppHeader eyebrow="Gestão do clube" title="Alunos" />
      <Segmented<CoachTab>
        value={activeTab}
        onChange={(value) => { setTab(value); setNotice(""); }}
        options={[
          { value: "team", label: "Turma", badge: pending.data?.length },
          { value: "review", label: "Avaliar", badge: toReview.length },
        ]}
      />
      <View style={styles.tabGap} />
      {pageError ? <View style={styles.errorCard}><Text style={styles.errorText}>Não foi possível carregar o clube agora. Tente novamente em instantes.</Text></View> : null}
      {notice ? <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text> : null}

      {activeTab === "team" ? <>
        {pending.data?.length ? <>
          <SectionTitle title={`Pedidos de acesso · ${pending.data.length}`} />
          {pending.data.map((item) => (
            <View key={item.userId} style={styles.requestCard}>
              <ProfileAvatar name={item.name} size={42} />
              <View style={styles.flexCopy}><Text style={styles.cardTitle}>{item.name}</Text><Text style={styles.cardDetail}>{item.email}</Text></View>
              <Pressable accessibilityLabel={`Rejeitar ${item.name}`} onPress={() => reject.mutate({ athleteId: item.userId })} style={({ pressed }) => [styles.rejectButton, pressed && styles.pressed]}><Ionicons name="close" size={19} color={C.ink} /></Pressable>
              <Pressable accessibilityLabel={`Aprovar ${item.name}`} onPress={() => approve.mutate({ athleteId: item.userId })} style={({ pressed }) => [styles.approveButton, pressed && styles.pressed]}><Ionicons name="checkmark" size={19} color="#FFFFFF" /><Text style={styles.approveText}>Aprovar</Text></Pressable>
            </View>
          ))}
          <View style={styles.gap} />
        </> : null}
        <CoachAthletes onOpen={(athleteId) => { setNotice(""); openAthlete(athleteId); }} onNotice={setNotice} />
      </> : null}

      {activeTab === "review" ? <>
        <Text style={styles.helper}>Corridas dos alunos que você acompanha.</Text>
        {feed.data?.length ? feed.data.map(({ activity, athleteName, athleteAvatarUrl, review }) => (
          <View key={activity.id} style={[styles.activityCard, !review && styles.activityOpen]}>
            <View style={styles.activityTop}>
              <Pressable onPress={() => openAthlete(activity.athleteId)} accessibilityLabel={`Abrir ficha de ${athleteName || "aluno"}`} style={styles.athleteIdentity}><ProfileAvatar uri={athleteAvatarUrl} name={athleteName} size={34} /><View><Text style={styles.cardTitle}>{athleteName || "Aluno"}</Text><Text style={styles.cardDetail}>{new Date(activity.completedAt).toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}</Text></View></Pressable>
              {review ? <Pill label="AVALIADO" tone="lime" /> : <View style={styles.waiting}><PulseDot /><Pill label="AGUARDA" tone="coral" /></View>}
            </View>
            <Text style={styles.activityTitle}>{activity.title}</Text>
            <View style={styles.metricChips}>
              <MetricChip icon="map-outline" text={`${formatKm(activity.distanceMeters, 2)} km`} />
              <MetricChip icon="time-outline" text={`${Math.floor(activity.durationSeconds / 60)} min`} />
              <MetricChip icon="speedometer-outline" text={`${formatPace(activity.averagePaceSecondsPerKm)} /km`} />
              {activity.perceivedEffort ? <MetricChip icon="pulse-outline" text={effortLabels[activity.perceivedEffort]} /> : null}
            </View>
            {activity.athleteNote ? <Text style={styles.athleteNote}>“{activity.athleteNote}”</Text> : null}
            {review ? <View style={styles.reviewed}><Text style={styles.reviewedTitle}>Sua avaliação · {review.rating}/5</Text><Text style={styles.cardDetail}>{review.comment}</Text></View> : <ReviewForm activityId={activity.id} onNotice={setNotice} aiDraft={activity.source === "manual"} />}
          </View>
        )) : <EmptyState icon="checkmark-done-outline" title="Tudo em dia" text="Os treinos registrados pelos alunos aparecem aqui para você avaliar." />}
        <View style={styles.gap} />
        <CoachNote label="STRAVA">Esta área avalia os treinos que o aluno registra no clube. As corridas do Strava ficam na ficha de cada aluno.</CoachNote>
      </> : null}
    </Screen>
  );
}

function AthleteClub() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const assignments = trpc.club.myAssignments.useQuery({ today: localDate() });
  const activities = trpc.club.myActivities.useQuery();
  const refreshWork = () => Promise.all([utils.club.myActivities.invalidate(), utils.club.myAssignments.invalidate(), utils.club.linkableRuns.invalidate(), utils.insights.overview.invalidate()]);
  const linkRun = trpc.club.linkStravaRun.useMutation({ onSuccess: refreshWork });
  const unlinkRun = trpc.club.unlinkStravaRun.useMutation({ onSuccess: refreshWork });
  const submit = trpc.club.submitActivity.useMutation({ onSuccess: async () => { await Promise.all([utils.club.myActivities.invalidate(), utils.club.myAssignments.invalidate()]); } });
  const [drafts, setDrafts] = useState<Record<number, ActivityDraft>>({});
  const [manualDraft, setManualDraft] = useState({ title: "Corrida livre", ...emptyActivityDraft() });
  const [notice, setNotice] = useState("");
  const pageError = assignments.error || activities.error;

  const onSubmit = async (assignmentId: number, title: string) => {
    const draft = drafts[assignmentId] ?? emptyActivityDraft();
    const distanceMeters = Math.round(Number(draft.distance.replace(",", ".")) * 1000);
    const durationSeconds = Math.round(Number(draft.minutes) * 60);
    if (!Number.isFinite(distanceMeters) || distanceMeters <= 0 || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      setNotice("Informe uma distância em quilômetros e um tempo em minutos válidos.");
      return false;
    }
    try {
      await submit.mutateAsync({ assignmentId, title, distanceMeters, durationSeconds, activityDate: draft.date, perceivedEffort: draft.effort, athleteNote: draft.note.trim() || undefined });
      setNotice("Treino registrado. Seu treinador poderá avaliar quando abrir o registro.");
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível registrar o treino.");
      return false;
    }
  };

  const link = async (assignmentId: number, runId: string) => {
    try {
      await linkRun.mutateAsync({ assignmentId, runId });
      setOpenLog(null);
      setNotice("Corrida ligada ao treino.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível ligar a corrida.");
    }
  };

  const unlink = async (assignmentId: number) => {
    try {
      await unlinkRun.mutateAsync({ assignmentId });
      setNotice("Treino reaberto. Ele não será mais ligado sozinho a corridas do mesmo dia.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível desfazer.");
    }
  };

  const onManualSubmit = async () => {
    const distanceMeters = Math.round(Number(manualDraft.distance.replace(",", ".")) * 1000);
    const durationSeconds = Math.round(Number(manualDraft.minutes) * 60);
    if (manualDraft.title.trim().length < 2 || !Number.isFinite(distanceMeters) || distanceMeters <= 0 || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      setNotice("Informe o nome, uma distância em quilômetros e um tempo em minutos válidos.");
      return;
    }
    try {
      await submit.mutateAsync({ title: manualDraft.title.trim(), distanceMeters, durationSeconds, activityDate: manualDraft.date, perceivedEffort: manualDraft.effort, athleteNote: manualDraft.note.trim() || undefined });
      setNotice("Atividade registrada e compartilhada com seu treinador para acompanhamento.");
      setManualDraft({ title: "Corrida livre", ...emptyActivityDraft() });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível registrar a atividade.");
    }
  };

  const [tab, setTab] = useState<AthleteTab>("agenda");
  const [openLog, setOpenLog] = useState<number | null>(null);
  const linkable = trpc.club.linkableRuns.useQuery(undefined, { enabled: openLog !== null });
  if (assignments.isLoading || activities.isLoading) return <LoadingState />;
  const open = (assignments.data ?? []).filter((assignment) => assignment.status === "assigned");
  const done = (assignments.data ?? []).filter((assignment) => assignment.status !== "assigned");

  const effortPicker = (value: Effort, onChange: (effort: Effort) => void) => (
    <View style={styles.choiceWrap}>{(["easy", "challenging", "intense"] as Effort[]).map((effort) => <Pressable key={effort} onPress={() => onChange(effort)} style={[styles.choice, styles.effortChoice, value === effort && styles.choiceSelected]}><Text style={[styles.choiceText, value === effort && styles.choiceTextSelected]}>{effortLabels[effort]}</Text></Pressable>)}</View>
  );

  const workoutCard = (assignment: NonNullable<typeof assignments.data>[number]) => {
    const draft = drafts[assignment.id] ?? emptyActivityDraft();
    const setDraft = (patch: Partial<ActivityDraft>) => setDrafts((current) => ({ ...current, [assignment.id]: { ...draft, ...patch } }));
    const completed = assignment.status === "completed";
    return <View key={assignment.id} style={[styles.athleteWorkout, !completed && styles.workoutOpen]}>
      <View style={styles.activityTop}><Pill label={completed ? "CONCLUÍDO" : "PARA FAZER"} tone={completed ? "lime" : "dark"} /><Text style={styles.cardDetail}>{formatDay(String(assignment.scheduledDate))}</Text></View>
      <Text style={styles.activityTitle}>{assignment.title}</Text>
      <Text style={styles.cardDetail}>{assignment.objective}</Text>
      {assignment.description ? <Text style={styles.athleteNote}>{assignment.description}</Text> : null}
      {assignment.steps.length ? <View style={styles.stepsRoad}>
        <Road>
          {assignment.steps.map((step, index) => (
            <RoadStep
              key={step.id}
              index={index}
              state={completed ? "done" : "next"}
              plate={stepPlate(step)}
              title={step.label}
              detail={[step.durationSeconds ? `${Math.round(step.durationSeconds / 60)} min` : step.distanceMeters ? `${formatKm(step.distanceMeters)} km` : "", step.instruction ?? ""].filter(Boolean).join(" · ")}
              pace={step.targetPaceSecondsPerKm ? formatPace(step.targetPaceSecondsPerKm) : undefined}
            />
          ))}
        </Road>
      </View> : null}
      {completed && assignment.run ? <RunFinish distanceMeters={assignment.run.distanceMeters} durationSeconds={assignment.run.durationSeconds} plannedMeters={assignment.steps.reduce((total, step) => total + (step.distanceMeters ?? 0), 0) || undefined} source={assignment.run.source} /> : null}
      {assignment.run?.source === "strava" ? <View style={styles.linkedRun}>
        <Pressable accessibilityRole="button" disabled={unlinkRun.isPending} onPress={() => unlink(assignment.id)} style={({ pressed }) => pressed && styles.pressed}><Text style={styles.linkAction}>Não foi este treino</Text></Pressable>
      </View> : null}
      {!completed ? openLog === assignment.id ? <View style={styles.logBox}>
        {linkable.data?.length ? <>
          <Text style={styles.formSection}>Foi uma destas corridas do Strava?</Text>
          {linkable.data.map((run) => <Pressable key={run.id} accessibilityRole="button" disabled={linkRun.isPending} onPress={() => link(assignment.id, run.id)} style={({ pressed }) => [styles.runChoice, pressed && styles.pressed]}>
            <View style={styles.flexCopy}><Text style={styles.stepLabel} numberOfLines={1}>{run.title}</Text><Text style={styles.cardDetail}>{formatDay(run.date)} · {formatKm(run.distanceMeters, 2)} km · {Math.round(run.movingSeconds / 60)} min</Text></View>
            <Text style={styles.linkAction}>Usar</Text>
          </Pressable>)}
          <Text style={styles.formSection}>Ou preencha à mão</Text>
        </> : <Text style={styles.formSection}>Como foi?</Text>}
        <DateChips past value={draft.date} onChange={(date) => setDraft({ date })} />
        <View style={styles.metricsInputRow}>
          <TextInput keyboardType="decimal-pad" value={draft.distance} onChangeText={(distance) => setDraft({ distance })} placeholder="km" placeholderTextColor={C.muted} style={[styles.input, styles.metricInput]} accessibilityLabel="Distância em quilômetros" />
          <TextInput keyboardType="decimal-pad" value={draft.minutes} onChangeText={(minutes) => setDraft({ minutes })} placeholder="minutos" placeholderTextColor={C.muted} style={[styles.input, styles.metricInput]} accessibilityLabel="Tempo em minutos" />
        </View>
        {effortPicker(draft.effort, (effort) => setDraft({ effort }))}
        <TextInput value={draft.note} onChangeText={(note) => setDraft({ note })} placeholder="Algum comentário para o treinador? (opcional)" placeholderTextColor={C.muted} multiline style={[styles.input, styles.reviewInput]} />
        <Pressable disabled={submit.isPending} onPress={async () => { if (await onSubmit(assignment.id, assignment.title)) setOpenLog(null); }} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>{submit.isPending ? "Salvando…" : "Registrar treino feito"}</Text></Pressable>
      </View> : <Pressable onPress={() => setOpenLog(assignment.id)} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>Fiz este treino</Text></Pressable> : null}
    </View>;
  };

  return (
    <Screen scroll>
      <AppHeader eyebrow="Seu clube" title="Meus treinos" />
      <Segmented<AthleteTab>
        value={tab}
        onChange={(value) => { setTab(value); setNotice(""); }}
        options={[
          { value: "agenda", label: "Agenda", badge: open.length },
          { value: "log", label: "Registrar" },
          { value: "history", label: "Histórico" },
        ]}
      />
      <View style={styles.tabGap} />
      {pageError ? <View style={styles.errorCard}><Text style={styles.errorText}>Não foi possível carregar seus treinos. Tente novamente.</Text></View> : null}
      {notice ? <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text> : null}

      {tab === "agenda" ? <>
        {open.length ? <View style={styles.list}>{open.map(workoutCard)}</View> : <EmptyState icon="calendar-outline" title="Nada pendente na agenda" text="Quando o treinador enviar um treino, ele aparece aqui com as etapas." />}
        {done.length ? <>
          <View style={styles.gap} />
          <SectionTitle title="Já concluídos" />
          <View style={styles.list}>{done.map(workoutCard)}</View>
        </> : null}
      </> : null}

      {tab === "log" ? <View style={styles.formCard}>
        <Text style={styles.formSection}>Registrar uma corrida</Text>
        <Text style={styles.helper}>Para corridas fora do plano. Seu treinador vê o registro e pode comentar.</Text>
        <Text style={styles.formLabel}>Nome da atividade</Text>
        <TextInput value={manualDraft.title} onChangeText={(value) => setManualDraft((current) => ({ ...current, title: value }))} placeholder="Ex.: Corrida no parque" placeholderTextColor={C.muted} style={styles.input} />
        <Text style={styles.formLabel}>Quando</Text>
        <DateChips past value={manualDraft.date} onChange={(date) => setManualDraft((current) => ({ ...current, date }))} />
        <TextInput value={manualDraft.date} onChangeText={(value) => setManualDraft((current) => ({ ...current, date: value }))} placeholder="AAAA-MM-DD" placeholderTextColor={C.muted} style={styles.input} accessibilityLabel="Data da corrida no formato ano-mês-dia" />
        <Text style={styles.formLabel}>Distância e tempo</Text>
        <View style={styles.metricsInputRow}>
          <TextInput keyboardType="decimal-pad" value={manualDraft.distance} onChangeText={(value) => setManualDraft((current) => ({ ...current, distance: value }))} placeholder="km" placeholderTextColor={C.muted} style={[styles.input, styles.metricInput]} accessibilityLabel="Distância da corrida manual em quilômetros" />
          <TextInput keyboardType="decimal-pad" value={manualDraft.minutes} onChangeText={(value) => setManualDraft((current) => ({ ...current, minutes: value }))} placeholder="minutos" placeholderTextColor={C.muted} style={[styles.input, styles.metricInput]} accessibilityLabel="Tempo da corrida manual em minutos" />
        </View>
        <Text style={styles.formLabel}>Esforço</Text>
        {effortPicker(manualDraft.effort, (effort) => setManualDraft((current) => ({ ...current, effort })))}
        <TextInput value={manualDraft.note} onChangeText={(value) => setManualDraft((current) => ({ ...current, note: value }))} placeholder="Observações (opcional)" placeholderTextColor={C.muted} multiline style={[styles.input, styles.reviewInput]} />
        <Pressable disabled={submit.isPending} onPress={onManualSubmit} style={({ pressed }) => [styles.primaryButton, submit.isPending && styles.disabled, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>{submit.isPending ? "Salvando…" : "Salvar corrida"}</Text></Pressable>
      </View> : null}

      {tab === "history" ? <>
        {activities.data?.length ? <View style={styles.list}>{activities.data.map((activity) => (
          <View key={activity.id} style={styles.activityCard}>
            <View style={styles.activityTop}><View style={styles.badges}><KindBadge workout={Boolean(activity.assignmentId)} /><SourceBadge source={activity.source === "strava" ? "strava" : "club"} /></View>{activity.review ? <Pill label={`AVALIADO · ${activity.review.rating}/5`} tone="lime" /> : <Pill label="AGUARDA RETORNO" tone="light" />}</View>
            <Text style={styles.activityTitle}>{activity.title}</Text>
            <View style={styles.metricChips}>
              <MetricChip icon="calendar-outline" text={new Date(activity.completedAt).toLocaleDateString("pt-BR", { day: "numeric", month: "short" })} />
              <MetricChip icon="map-outline" text={`${formatKm(activity.distanceMeters, 2)} km`} />
              <MetricChip icon="time-outline" text={`${Math.floor(activity.durationSeconds / 60)} min`} />
              {activity.perceivedEffort ? <MetricChip icon="pulse-outline" text={effortLabels[activity.perceivedEffort]} /> : null}
            </View>
            {activity.review ? <CoachMessage label="Avaliação do treinador">{activity.review.comment}</CoachMessage> : null}
          </View>
        ))}</View> : <EmptyState icon="time-outline" title="Seu histórico começa aqui" text="Treinos registrados e comentários do treinador ficam guardados nesta aba." />}
        <View style={styles.gap} />
        <Pressable onPress={() => router.push("/strava")} style={({ pressed }) => [styles.athleteRow, pressed && styles.pressed]}>
          <View style={styles.stravaIcon}><Ionicons name="flash" size={16} color={C.white} /></View>
          <View style={styles.flexCopy}><Text style={styles.cardTitle}>Histórico do Strava</Text><Text style={styles.cardDetail}>Suas corridas do Strava.</Text></View>
          <Ionicons name="chevron-forward" size={18} color={C.muted} />
        </Pressable>
      </> : null}
    </Screen>
  );
}

function MetricChip({ icon, text }: { icon: "map-outline" | "time-outline" | "speedometer-outline" | "pulse-outline" | "calendar-outline"; text: string }) {
  return <View style={styles.metricChip}><Ionicons name={icon} size={13} color={C.inkSoft} /><Text style={styles.metricChipText}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.paper },
  gap: { height: 27 },
  badges: { flexDirection: "row", alignItems: "center", gap: 6 },
  waiting: { flexDirection: "row", alignItems: "center", gap: 8 },
  linkedRun: { alignItems: "flex-end", paddingTop: 8 },
  linkAction: { color: C.cone, fontSize: 14, fontFamily: F.textBold },
  runChoice: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 12, backgroundColor: C.white },
  tabGap: { height: 18 },
  list: { gap: 10 },
  helper: { color: C.muted, fontSize: 12, lineHeight: 17, fontFamily: F.text, marginBottom: 10 },
  formSection: { color: C.ink, fontSize: 15, fontFamily: F.textBold },
  approveText: { color: "#FFFFFF", fontSize: 15, fontFamily: F.displayBold, letterSpacing: 1, textTransform: "uppercase" },
  athleteRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, backgroundColor: C.road },
  activityOpen: { borderColor: "#F6C4B5" },
  activityTitle: { color: C.ink, fontSize: 26, lineHeight: 28, fontFamily: F.display, textTransform: "uppercase" },
  metricChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  metricChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10, backgroundColor: C.paper },
  metricChipText: { color: C.inkSoft, fontSize: 12, fontFamily: F.textBold },
  effortChoice: { flexGrow: 1, alignItems: "center" },
  workoutOpen: {},
  logBox: { gap: 10, padding: 14, borderRadius: 14, backgroundColor: C.concrete },
  stravaIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: STRAVA_ORANGE },
  requestCard: { minHeight: 71, flexDirection: "row", alignItems: "center", gap: 10, padding: 14, marginBottom: 9, borderRadius: 14, backgroundColor: C.road },
  flexCopy: { flex: 1, gap: 3 },
  cardTitle: { color: C.ink, fontSize: 16, lineHeight: 21, fontFamily: F.textBold },
  cardDetail: { color: C.muted, fontSize: 13, lineHeight: 18, fontFamily: F.text },
  approveButton: { height: 40, flexDirection: "row", gap: 4, paddingHorizontal: 14, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: C.cone },
  rejectButton: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: C.stone },
  pressed: { opacity: 0.72 },
  formCard: { padding: 18, borderRadius: 14, backgroundColor: C.road, gap: 9 },
  formLabel: { color: C.ink, fontSize: 12, fontFamily: F.textBold, marginTop: 9 },
  input: { minHeight: 48, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: C.ink, backgroundColor: C.concrete, fontSize: 15, fontFamily: F.text },
  choiceWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 3 },
  choice: { minHeight: 38, justifyContent: "center", paddingHorizontal: 14, borderRadius: 19, borderWidth: 1, borderColor: "#B9BCB6", backgroundColor: "transparent" },
  choiceSelected: { borderColor: C.asphalt, backgroundColor: C.asphalt },
  choiceText: { color: C.inkSoft, fontSize: 14, fontFamily: F.textSemi },
  choiceTextSelected: { color: C.white },
  primaryButton: { minHeight: 50, borderRadius: 12, backgroundColor: C.cone, alignItems: "center", justifyContent: "center", marginTop: 8, paddingHorizontal: 12 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 18, fontFamily: F.displayBold, letterSpacing: 1.5, textTransform: "uppercase" },
  disabled: { opacity: 0.6 },
  activityCard: { padding: 16, borderRadius: 14, backgroundColor: C.road, marginBottom: 10, gap: 10 },
  activityTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  athleteIdentity: { flexDirection: "row", alignItems: "center", gap: 7, flexShrink: 1 },
  athleteNote: { color: C.coneInk, backgroundColor: C.coneTint, borderRadius: 12, padding: 12, fontSize: 14, lineHeight: 20, fontFamily: F.text },
  reviewInput: { minHeight: 72, textAlignVertical: "top", marginTop: 4 },
  reviewed: { padding: 12, borderRadius: 12, backgroundColor: C.coneTint, gap: 4 },
  reviewedTitle: { color: C.ink, fontSize: 12, fontFamily: F.textBold },
  notice: { color: C.inkSoft, backgroundColor: C.stone, padding: 12, borderRadius: 12, marginBottom: 12, fontSize: 14, lineHeight: 19, fontFamily: F.text },
  errorCard: { padding: 13, backgroundColor: "#F9D5CC", borderRadius: 14, marginBottom: 13 },
  errorText: { color: "#762E21", fontSize: 12, lineHeight: 17, fontFamily: F.textSemi },
  athleteWorkout: { padding: 18, borderRadius: 14, backgroundColor: C.road, gap: 10 },
  stepsRoad: { marginTop: 14 },
  stepLabel: { color: C.ink, fontSize: 12, fontFamily: F.textBold },
  metricsInputRow: { flexDirection: "row", gap: 9 },
  metricInput: { flex: 1 },
});
