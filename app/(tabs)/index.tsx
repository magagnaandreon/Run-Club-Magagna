import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { formatDay, formatKm, formatPace } from "@/components/dashboard-ui";
import { C, F, HeaderStat, HeaderStats, Pill, PrimaryButton, Road, RoadHeader, RoadStep, Screen, SectionTitle, stepPlate } from "@/components/run-ui";
import { TrainingDashboard } from "@/components/training-dashboard";
import { useAuth } from "@/hooks/use-auth";
import { localToday } from "@/hooks/use-insights";
import { trpc } from "@/lib/trpc";
import { addDays, startOfWeek } from "@/shared/insights";

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
}

/** Date and greeting on asphalt; the photo and brand live in the top bar right above. */
function Header() {
  const { user } = useAuth();
  const profile = trpc.account.profile.useQuery(undefined, { enabled: Boolean(user) });
  const name = profile.data?.name || user?.name || "";
  const firstName = name.split(" ")[0] || "corredor";
  const rawDate = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const dateLabel = rawDate.charAt(0).toUpperCase() + rawDate.slice(1);
  return (
    <RoadHeader eyebrow={dateLabel} title={`${greeting()}, ${firstName}`}>
      {user?.role === "admin" ? null : <AthleteStats />}
    </RoadHeader>
  );
}

export default function TodayScreen() {
  const { user } = useAuth();
  return (
    <Screen scroll wide>
      <Header />
      {user?.role === "admin" ? <CoachToday /> : <AthleteToday />}
    </Screen>
  );
}

function AthleteStats() {
  const assignments = trpc.club.myAssignments.useQuery({ today: localToday() });
  const weekFrom = startOfWeek(localToday());
  const week = (assignments.data ?? []).filter((assignment) => assignment.scheduledDate >= weekFrom && assignment.scheduledDate <= addDays(weekFrom, 6));
  const next = assignments.data?.find((assignment) => assignment.status === "assigned");
  if (!assignments.data) return null;
  return (
    <HeaderStats>
      <HeaderStat value={`${week.filter((assignment) => assignment.status === "completed").length}/${week.length}`} label="treinos da semana" />
      <HeaderStat value={next ? formatDay(next.scheduledDate) : "—"} label="próximo treino" />
    </HeaderStats>
  );
}

function AthleteToday() {
  const router = useRouter();
  const assignments = trpc.club.myAssignments.useQuery({ today: localToday() });
  const upcoming = assignments.data?.find((assignment) => assignment.status === "assigned");
  // The plan of this calendar week, Monday to Sunday.
  const weekFrom = startOfWeek(localToday());
  const weekTo = addDays(weekFrom, 6);
  const weekAssignments = (assignments.data ?? []).filter((assignment) => assignment.scheduledDate >= weekFrom && assignment.scheduledDate <= weekTo);
  const weekCompleted = weekAssignments.filter((assignment) => assignment.status === "completed").length;
  const stepMinutes = (upcoming?.steps ?? []).reduce((total, step) => total + (step.durationSeconds ?? 0), 0) / 60;
  const stepDistance = (upcoming?.steps ?? []).reduce((total, step) => total + (step.distanceMeters ?? 0), 0);
  const pace = upcoming?.steps.find((step) => step.targetPaceSecondsPerKm)?.targetPaceSecondsPerKm ?? null;

  const nextCard = (
    <>
      <View style={styles.nextCard}>
        <View style={styles.nextTop}>
          <Pill label={upcoming ? "PRÓXIMO TREINO" : "SUA AGENDA"} tone="lime" icon="flash" />
          {upcoming ? <Text style={styles.nextDate}>{formatDay(upcoming.scheduledDate)}</Text> : null}
        </View>
        <Text style={styles.nextTitle}>{upcoming?.title || "Aguardando o próximo treino"}</Text>
        <Text style={styles.nextText}>{upcoming?.objective || "Quando o treinador enviar um treino, os detalhes aparecem aqui."}</Text>
        {upcoming?.steps.length ? (
          <View style={styles.road}>
            <Road>
              {upcoming.steps.map((step, index) => (
                <RoadStep
                  key={step.id}
                  index={index}
                  plate={stepPlate(step)}
                  title={step.label}
                  detail={step.instruction || undefined}
                  pace={step.targetPaceSecondsPerKm ? formatPace(step.targetPaceSecondsPerKm) : undefined}
                />
              ))}
            </Road>
          </View>
        ) : null}
        {upcoming ? (
          <View style={styles.nextMetrics}>
            <NextMetric icon="time-outline" value={stepMinutes ? `${Math.round(stepMinutes)} min` : "—"} />
            <NextMetric icon="map-outline" value={stepDistance ? `${formatKm(stepDistance)} km` : "—"} />
            <NextMetric icon="speedometer-outline" value={pace ? `${formatPace(pace)} /km` : "livre"} />
            <NextMetric icon="list-outline" value={`${upcoming.steps.length} etapas`} />
          </View>
        ) : null}
        {weekAssignments.length ? (
          <View style={styles.planProgress}>
            <View style={styles.planProgressTop}>
              <Text style={styles.planProgressLabel}>Plano da semana</Text>
              <Text style={styles.planProgressValue}>{weekCompleted}/{weekAssignments.length} feitos</Text>
            </View>
            <View style={styles.track}><View style={[styles.trackFill, { width: `${Math.round((weekCompleted / weekAssignments.length) * 100)}%` }]} /></View>
          </View>
        ) : null}
        <PrimaryButton label={upcoming ? "Abrir meu treino" : "Ver meu clube"} icon="arrow-forward" onPress={() => router.push("/(tabs)/club")} style={styles.nextButton} />
      </View>
    </>
  );

  return <TrainingDashboard title="Seu painel" aside={nextCard} />;
}

function NextMetric({ icon, value }: { icon: "time-outline" | "map-outline" | "speedometer-outline" | "list-outline"; value: string }) {
  return (
    <View style={styles.nextMetric}>
      <Ionicons name={icon} size={14} color={C.lime} />
      <Text style={styles.nextMetricText}>{value}</Text>
    </View>
  );
}

function CoachToday() {
  const router = useRouter();
  const pending = trpc.club.pendingAthletes.useQuery();
  const athletes = trpc.club.athletes.useQuery();
  const feed = trpc.club.coachActivityFeed.useQuery();
  const workouts = trpc.club.workouts.useQuery();
  const toReview = (feed.data ?? []).filter((entry) => !entry.review);
  const nextAction = pending.data?.length
    ? { icon: "person-add" as const, title: "Aprovar novos alunos", text: `${pending.data.length} ${pending.data.length === 1 ? "pedido aguarda" : "pedidos aguardam"} sua revisão.` }
    : toReview.length
      ? { icon: "chatbubble-ellipses" as const, title: "Dar retorno aos alunos", text: `${toReview.length} ${toReview.length === 1 ? "treino aguarda" : "treinos aguardam"} sua avaliação.` }
      : { icon: "add-circle" as const, title: "Enviar o próximo treino", text: "Monte uma sessão por etapas e atribua a um aluno." };

  const classBlock = (
    <>
      <View style={styles.coachGrid}>
        <CoachTile icon="people" value={athletes.data?.length ?? 0} label="alunos" onPress={() => router.push("/(tabs)/club")} />
        <CoachTile icon="hourglass" value={pending.data?.length ?? 0} label="pedidos" hot={Boolean(pending.data?.length)} onPress={() => router.push("/(tabs)/club")} />
        <CoachTile icon="star" value={toReview.length} label="para avaliar" hot={toReview.length > 0} onPress={() => router.push("/(tabs)/club")} />
        <CoachTile icon="library" value={workouts.data?.length ?? 0} label="treinos" onPress={() => router.push("/(tabs)/plans")} />
      </View>

      <Pressable onPress={() => router.push("/(tabs)/club")} style={({ pressed }) => [styles.actionCard, pressed && styles.pressed]}>
        <View style={styles.actionIcon}><Ionicons name={nextAction.icon} size={20} color={C.ink} /></View>
        <View style={styles.actionCopy}>
          <Text style={styles.actionEyebrow}>PRÓXIMA AÇÃO</Text>
          <Text style={styles.actionTitle}>{nextAction.title}</Text>
          <Text style={styles.actionText}>{nextAction.text}</Text>
        </View>
        <Ionicons name="arrow-forward" size={20} color={C.ink} />
      </Pressable>

      {feed.data?.length ? (
        <>
          <View style={styles.gap} />
          <SectionTitle title="Atividade da turma" action="Ver turma" onPress={() => router.push("/(tabs)/club")} />
          <View style={styles.feed}>
            {feed.data.slice(0, 3).map(({ activity, athleteName, review }) => (
              <View key={activity.id} style={styles.feedRow}>
                <View style={[styles.feedDot, review ? styles.feedDotDone : styles.feedDotOpen]} />
                <View style={styles.actionCopy}>
                  <Text style={styles.feedTitle} numberOfLines={1}>{athleteName || "Aluno"} · {activity.title}</Text>
                  <Text style={styles.feedText}>{formatKm(activity.distanceMeters, 2)} km · {formatPace(activity.averagePaceSecondsPerKm)} /km · {review ? "avaliado" : "aguarda avaliação"}</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </>
  );

  return <TrainingDashboard title="Seu treino" aside={classBlock} />;
}

function CoachTile({ icon, value, label, hot = false, onPress }: { icon: "people" | "hourglass" | "star" | "library"; value: number; label: string; hot?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.coachTile, hot && styles.coachTileHot, pressed && styles.pressed]}>
      <Ionicons name={icon} size={16} color={C.ink} />
      <Text style={styles.coachValue}>{value}</Text>
      <Text style={styles.coachLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  gap: { height: 28 },

  nextCard: { padding: 18, borderRadius: 14, backgroundColor: C.stone },
  nextTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  nextDate: { color: C.muted, fontFamily: F.textBold, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6 },
  nextTitle: { color: C.ink, fontSize: 30, lineHeight: 32, fontFamily: F.display, textTransform: "uppercase", marginTop: 12 },
  nextText: { color: C.inkSoft, fontSize: 14, lineHeight: 20, fontFamily: F.text, marginTop: 4 },
  road: { marginTop: 18 },
  nextMetrics: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  nextMetric: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4, backgroundColor: C.asphalt },
  nextMetricText: { color: C.road, fontFamily: F.displayBold, fontSize: 15, letterSpacing: 0.3 },
  planProgress: { marginTop: 18, gap: 8 },
  planProgressTop: { flexDirection: "row", justifyContent: "space-between" },
  planProgressLabel: { color: C.muted, fontFamily: F.textSemi, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6 },
  planProgressValue: { color: C.ink, fontFamily: F.displayBold, fontSize: 16 },
  track: { height: 10, borderRadius: 3, overflow: "hidden", backgroundColor: C.stone },
  trackFill: { height: "100%", borderRadius: 3, backgroundColor: C.limeDeep },
  nextButton: { marginTop: 16 },

  coachGrid: { flexDirection: "row", gap: 8, marginBottom: 12 },
  coachTile: { flex: 1, gap: 4, padding: 12, borderRadius: 12, backgroundColor: C.white, boxShadow: "0px 8px 20px rgba(30, 33, 35, 0.07)" },
  coachTileHot: { backgroundColor: C.lime },
  coachValue: { color: C.ink, fontSize: 24, lineHeight: 28, fontFamily: F.display, letterSpacing: 0, marginTop: 4 },
  coachLabel: { color: C.inkSoft, fontSize: 10, fontWeight: "800" },

  actionCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 14, backgroundColor: C.sand },
  actionIcon: { width: 42, height: 42, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: C.lime },
  actionCopy: { flex: 1, gap: 2 },
  actionEyebrow: { color: C.inkSoft, fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  actionTitle: { color: C.ink, fontSize: 16, fontWeight: "900" },
  actionText: { color: C.inkSoft, fontSize: 12, fontWeight: "600" },

  feed: { gap: 8 },
  feedRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, backgroundColor: C.white, borderWidth: 1, borderColor: "#E2E3DD" },
  feedDot: { width: 10, height: 10, borderRadius: 5 },
  feedDotDone: { backgroundColor: C.limeDeep },
  feedDotOpen: { backgroundColor: C.coral },
  feedTitle: { color: C.ink, fontSize: 14, fontWeight: "800" },
  feedText: { color: C.muted, fontSize: 12, fontWeight: "600" },
});
