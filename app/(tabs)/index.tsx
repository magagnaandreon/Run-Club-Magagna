import { Ionicons } from "@expo/vector-icons";
import type { inferRouterOutputs } from "@trpc/server";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { NextAchievement } from "@/components/achievements";
import { formatDay, formatKm, formatPace, TrainingRow } from "@/components/dashboard-ui";
import { ChartCard, WeekKmBars } from "@/components/run-charts";
import { C, CoachMessage, F, HeaderStat, HeaderStats, PrimaryButton, PulseDot, RoadHeader, Screen, SectionTitle, Settle } from "@/components/run-ui";
import { TrainingDashboard } from "@/components/training-dashboard";
import { WeekLine, type WeekDay } from "@/components/week-line";
import { useAuth } from "@/hooks/use-auth";
import { localToday, useInsights } from "@/hooks/use-insights";
import { useIsDesktop } from "@/hooks/use-layout";
import { trpc } from "@/lib/trpc";
import type { AppRouter } from "@/server/routers";
import { addDays, paceSecondsPerKm, startOfWeek } from "@/shared/insights";

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
  const dateLabel = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  return (
    <RoadHeader eyebrow={dateLabel} title={`${greeting()}, ${firstName}`}>
      {user?.role === "admin" ? <CoachStats /> : <AthleteStats />}
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

/** This Monday-to-Sunday week from the coach's plan: what each day is, and how many are done. */
function useWeekPlan() {
  const today = localToday();
  const assignments = trpc.club.myAssignments.useQuery({ today });
  const weekFrom = startOfWeek(today);
  const week = (assignments.data ?? []).filter((assignment) => assignment.scheduledDate >= weekFrom && assignment.scheduledDate <= addDays(weekFrom, 6));
  const days: WeekDay[] = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekFrom, index);
    const planned = week.filter((assignment) => assignment.scheduledDate === date);
    if (!planned.length) return "free";
    if (planned.some((assignment) => assignment.status === "completed")) return "done";
    return date < today ? "missed" : "planned";
  });
  return { assignments, week, days, weekFrom, today, done: week.filter((assignment) => assignment.status === "completed").length };
}

function AthleteStats() {
  const desktop = useIsDesktop();
  const insights = useInsights(true);
  const { assignments, week, days, weekFrom, today, done } = useWeekPlan();
  if (!assignments.data) return null;
  const streak = insights.data?.week.streakDays ?? 0;
  return (
    <>
      {desktop ? <WeekLine weekFrom={weekFrom} today={today} days={days} /> : null}
      <HeaderStats>
        <HeaderStat accent value={insights.data ? `${formatKm(insights.data.week.distanceMeters)} km` : "—"} label="na semana" />
        <HeaderStat value={week.length ? `${done} de ${week.length}` : "0"} label={week.length ? "treinos feitos" : "treinos marcados"} />
        {desktop ? <HeaderStat value={`${streak} ${streak === 1 ? "dia" : "dias"}`} label="seguidos correndo" /> : null}
      </HeaderStats>
    </>
  );
}

function AthleteToday() {
  const router = useRouter();
  const desktop = useIsDesktop();
  const weeks = useInsights(true, "12w");
  const { assignments, days, weekFrom, today } = useWeekPlan();
  // Today or the next date first; an old workout left undone only when nothing is ahead.
  const pending = (assignments.data ?? []).filter((assignment) => assignment.status === "assigned");
  const upcoming = pending.find((assignment) => assignment.scheduledDate >= today) ?? pending[pending.length - 1];
  const recent = weeks.data?.recent ?? [];
  const series = (weeks.data?.series ?? []).slice(-6);

  const weekCard = (
    <Settle index={0} style={styles.card}>
      <Text style={styles.cardTitle}>Sua semana</Text>
      <WeekLine light weekFrom={weekFrom} today={today} days={days} />
    </Settle>
  );

  const nextCard = <NextWorkout assignment={upcoming} loading={!assignments.data} onOpen={() => router.push("/(tabs)/club")} />;
  const note = upcoming?.description ? <Settle index={2}><CoachMessage label="Recado do treinador">{upcoming.description}</CoachMessage></Settle> : null;

  const kmCard = series.length ? (
    <Settle index={3}>
      <ChartCard title="Km por semana" value={undefined} caption="A barra verde é a semana atual. O tracejado mostra quanto falta para igualar sua melhor semana.">
        <WeekKmBars weeks={series} height={desktop ? 150 : 104} />
      </ChartCard>
    </Settle>
  ) : null;

  const runs = recent.length ? (
    <View style={styles.runs}>
      <SectionTitle title="Corridas da semana" action="Dados" onPress={() => router.push("/(tabs)/progress")} />
      {recent.slice(0, 4).map((entry) => (
        <TrainingRow
          key={entry.id}
          title={entry.workoutTitle ?? entry.title}
          workout={Boolean(entry.workoutTitle)}
          date={entry.date}
          source={entry.source}
          distanceMeters={entry.distanceMeters}
          movingSeconds={entry.movingSeconds}
          paceSecondsPerKm={paceSecondsPerKm(entry.distanceMeters, entry.movingSeconds)}
        />
      ))}
    </View>
  ) : null;

  const strava = weeks.data && !weeks.data.stravaConnected ? (
    <Pressable onPress={() => router.push("/strava")} style={({ pressed }) => [styles.strava, pressed && styles.pressed]}>
      <View style={styles.actionCopy}>
        <Text style={styles.stravaTitle}>Conecte seu Strava</Text>
        <Text style={styles.stravaText}>As corridas entram sozinhas e concluem o treino do dia.</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={C.cone} />
    </Pressable>
  ) : null;

  if (desktop) {
    return (
      <View style={styles.split}>
        <View style={styles.main}>{kmCard}{runs}</View>
        <View style={styles.side}>{nextCard}{note}{strava}<NextAchievement /></View>
      </View>
    );
  }
  return <View style={styles.stack}>{weekCard}{nextCard}{note}{strava}{kmCard}{runs}</View>;
}

type Assignment = inferRouterOutputs<AppRouter>["club"]["myAssignments"][number];

/** The next workout: name, an intensity strip (hard steps in conhaque), the numbers and the way in. */
function NextWorkout({ assignment, loading, onOpen }: { assignment?: Assignment; loading: boolean; onOpen: () => void }) {
  const desktop = useIsDesktop();
  if (loading) return <View style={[styles.next, styles.nextLoading]} />;
  if (!assignment) {
    return (
      <Settle index={1} style={styles.next}>
        <Text style={styles.nextEyebrow}>SUA AGENDA</Text>
        <Text style={styles.nextTitle}>Aguardando o próximo treino</Text>
        <Text style={styles.nextText}>Quando o treinador enviar um treino, ele aparece aqui.</Text>
        <PrimaryButton label="Ver meu clube" onPress={onOpen} style={styles.nextButton} />
      </Settle>
    );
  }
  const steps = assignment.steps;
  const minutes = steps.reduce((total, step) => total + (step.durationSeconds ?? 0), 0) / 60;
  const meters = steps.reduce((total, step) => total + (step.distanceMeters ?? 0), 0);
  const pace = steps.find((step) => step.targetPaceSecondsPerKm)?.targetPaceSecondsPerKm ?? null;
  const when = assignment.scheduledDate === localToday() ? "HOJE" : formatDay(assignment.scheduledDate).toUpperCase();
  const facts = [meters ? `${formatKm(meters)} km` : null, minutes ? `${Math.round(minutes)} min` : null, pace ? `alvo ${formatPace(pace)}/km` : null, `${steps.length} ${steps.length === 1 ? "etapa" : "etapas"}`].filter(Boolean);
  return (
    <Settle index={1} style={styles.next}>
      <Text style={styles.nextEyebrow}>PRÓXIMO TREINO · {when}</Text>
      <Text style={[styles.nextTitle, desktop && styles.nextTitleDesktop]}>{assignment.title}</Text>
      {steps.length ? (
        <View style={styles.strip} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {steps.map((step) => <View key={step.id} style={[styles.stripPart, { flex: stepWeight(step) }, step.targetPaceSecondsPerKm ? styles.stripHard : null]} />)}
        </View>
      ) : null}
      <Text style={styles.nextFacts}>{facts.join("   ·   ")}</Text>
      {desktop && steps.length ? (
        <View style={styles.nextSteps}>
          {steps.slice(0, 5).map((step) => (
            <View key={step.id} style={styles.nextStep}>
              <Text style={[styles.nextStepText, step.targetPaceSecondsPerKm ? styles.nextStepHard : null]} numberOfLines={1}>{step.label}</Text>
              <Text style={[styles.nextStepText, step.targetPaceSecondsPerKm ? styles.nextStepHard : null]}>{step.targetPaceSecondsPerKm ? formatPace(step.targetPaceSecondsPerKm) : "livre"}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <PrimaryButton label="Ver treino" onPress={onOpen} style={styles.nextButton} />
    </Settle>
  );
}

/** How wide a step is on the strip: its minutes, or its distance at an easy 6 min/km. */
function stepWeight(step: { durationSeconds: number | null; distanceMeters: number | null }) {
  if (step.durationSeconds) return step.durationSeconds;
  if (step.distanceMeters) return step.distanceMeters * 0.36;
  return 120;
}

function CoachStats() {
  const athletes = trpc.club.athletes.useQuery();
  const pending = trpc.club.pendingAthletes.useQuery();
  const feed = trpc.club.coachActivityFeed.useQuery();
  const toReview = (feed.data ?? []).filter((entry) => !entry.review).length;
  return (
    <HeaderStats>
      <HeaderStat value={String(athletes.data?.length ?? 0)} label="alunos" />
      <HeaderStat accent={toReview > 0} value={String(toReview)} label="a avaliar" />
      <HeaderStat value={String(pending.data?.length ?? 0)} label="pedidos" />
    </HeaderStats>
  );
}

function CoachToday() {
  const router = useRouter();
  const pending = trpc.club.pendingAthletes.useQuery();
  const feed = trpc.club.coachActivityFeed.useQuery();
  const toReview = (feed.data ?? []).filter((entry) => !entry.review);
  const nextAction = pending.data?.length
    ? { icon: "person-add" as const, title: "Aprovar novos alunos", text: `${pending.data.length} ${pending.data.length === 1 ? "pedido aguarda" : "pedidos aguardam"} sua revisão.` }
    : toReview.length
      ? { icon: "chatbubble-ellipses" as const, title: "Dar retorno aos alunos", text: `${toReview.length} ${toReview.length === 1 ? "treino aguarda" : "treinos aguardam"} sua avaliação.` }
      : { icon: "add-circle" as const, title: "Enviar o próximo treino", text: "Monte uma sessão por etapas e atribua a um aluno." };

  const classBlock = (
    <>
      <Pressable onPress={() => router.push("/(tabs)/club")} style={({ pressed }) => [styles.actionCard, pressed && styles.pressed]}>
        <View style={styles.actionIcon}><Ionicons name={nextAction.icon} size={20} color="#FFFFFF" /></View>
        <View style={styles.actionCopy}>
          <Text style={styles.actionEyebrow}>PRÓXIMA AÇÃO</Text>
          <Text style={styles.actionTitle}>{nextAction.title}</Text>
          <Text style={styles.actionText}>{nextAction.text}</Text>
        </View>
        <Ionicons name="arrow-forward" size={20} color={C.cone} />
      </Pressable>

      {feed.data?.length ? (
        <>
          <View style={styles.gap} />
          <SectionTitle title="Atividade da turma" action="Ver turma" onPress={() => router.push("/(tabs)/club")} />
          <View style={styles.feed}>
            {feed.data.slice(0, 3).map(({ activity, athleteName, review }) => (
              <View key={activity.id} style={styles.feedRow}>
                {review ? <View style={[styles.feedDot, styles.feedDotDone]} /> : <PulseDot />}
                <View style={styles.actionCopy}>
                  <Text style={styles.feedTitle} numberOfLines={1}>{athleteName || "Aluno"} · {activity.title}</Text>
                  <Text style={styles.feedText}>{formatKm(activity.distanceMeters, 2)} km · {formatPace(activity.averagePaceSecondsPerKm)} /km{review ? " · avaliado" : ""}</Text>
                </View>
                {review ? null : (
                  <Pressable accessibilityRole="button" accessibilityLabel={`Avaliar ${athleteName || "aluno"}`} onPress={() => router.push("/(tabs)/club")} style={({ pressed }) => [styles.review, pressed && styles.pressed]}>
                    <Text style={styles.reviewText}>Avaliar</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        </>
      ) : null}
    </>
  );

  return <TrainingDashboard title="Seu treino" aside={classBlock} />;
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  gap: { height: 28 },

  stack: { gap: 14 },
  split: { flexDirection: "row", alignItems: "flex-start", gap: 24 },
  main: { flex: 1.55, minWidth: 0, gap: 24 },
  side: { flex: 1, minWidth: 0, gap: 20 },
  card: { backgroundColor: C.road, borderRadius: 14, padding: 16, gap: 10 },
  cardTitle: { color: C.inkSoft, fontFamily: F.displayBold, fontSize: 16, letterSpacing: 1, textTransform: "uppercase" },
  runs: { gap: 8, marginTop: 10 },

  next: { backgroundColor: C.stone, borderRadius: 14, padding: 18, gap: 10 },
  nextLoading: { height: 210 },
  nextEyebrow: { color: C.coneInk, fontFamily: F.textBold, fontSize: 12, letterSpacing: 1 },
  nextTitle: { color: C.ink, fontFamily: F.display, fontSize: 28, lineHeight: 30, textTransform: "uppercase" },
  nextTitleDesktop: { fontSize: 36, lineHeight: 38 },
  nextText: { color: C.inkSoft, fontFamily: F.text, fontSize: 14, lineHeight: 20 },
  strip: { flexDirection: "row", gap: 4 },
  stripPart: { height: 8, borderRadius: 4, backgroundColor: "#9EA19C" },
  stripHard: { backgroundColor: C.cone },
  nextFacts: { color: C.inkSoft, fontFamily: F.text, fontSize: 14, ...{ fontVariant: ["tabular-nums"] } },
  nextSteps: { gap: 8, marginTop: 2 },
  nextStep: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  nextStepText: { color: C.inkSoft, fontFamily: F.text, fontSize: 15 },
  nextStepHard: { color: C.coneInk, fontFamily: F.textBold },
  nextButton: { marginTop: 4, minHeight: 50 },

  strava: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 14, backgroundColor: C.road },
  stravaTitle: { color: C.ink, fontFamily: F.textBold, fontSize: 15 },
  stravaText: { color: C.muted, fontFamily: F.text, fontSize: 13 },


  actionCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 14, backgroundColor: C.stone },
  actionIcon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: C.cone },
  actionCopy: { flex: 1, gap: 2 },
  actionEyebrow: { color: C.coneInk, fontSize: 12, fontFamily: F.textBold, letterSpacing: 1 },
  actionTitle: { color: C.ink, fontSize: 20, fontFamily: F.display, textTransform: "uppercase" },
  actionText: { color: C.inkSoft, fontSize: 12, fontFamily: F.text },

  feed: { gap: 8 },
  feedRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, backgroundColor: C.road },
  review: { height: 38, paddingHorizontal: 14, borderRadius: 10, justifyContent: "center", backgroundColor: C.cone },
  reviewText: { color: "#FFFFFF", fontFamily: F.displayBold, fontSize: 15, letterSpacing: 1, textTransform: "uppercase" },
  feedDot: { width: 10, height: 10, borderRadius: 5 },
  feedDotDone: { backgroundColor: "#9EA19C" },
  feedTitle: { color: C.ink, fontSize: 16, fontFamily: F.textBold },
  feedText: { color: C.muted, fontSize: 13, fontFamily: F.text },
});
