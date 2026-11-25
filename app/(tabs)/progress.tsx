import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { BarChart, DeltaChip, EmptyState, Explain, PeriodSelector, Skeleton, delta, formatDay, formatDuration, formatKm, formatPace } from "@/components/dashboard-ui";
import { RunAnalysisSection } from "@/components/run-analysis";
import { ChartCard, GoalTrack, PaceTrend, WeekKmBars } from "@/components/run-charts";
import { AppHeader, C, PrimaryButton, ProgressRing, Screen, SectionTitle, F, NUM } from "@/components/run-ui";
import { useAuth } from "@/hooks/use-auth";
import { localToday, useInsights } from "@/hooks/use-insights";
import { useIsDesktop } from "@/hooks/use-layout";
import { trpc } from "@/lib/trpc";
import { calendarWeeks, daysInRange, type InsightBucket } from "@/shared/insights";

type RecordIcon = "trophy-outline" | "flash-outline" | "trending-up-outline" | "time-outline";

export default function ProgressScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isCoach = user?.role === "admin";
  const desktop = useIsDesktop();
  const insights = useInsights(Boolean(user));
  const assignments = trpc.club.myAssignments.useQuery({ today: localToday() }, { enabled: Boolean(user) && !isCoach });
  const coachFeed = trpc.club.coachActivityFeed.useQuery(undefined, { enabled: isCoach });
  const data = insights.data;

  const weekly = useInsights(Boolean(user), "12w");
  const header = (
    <AppHeader eyebrow={isCoach ? "seu treino e a turma" : "sua evolução, semana a semana"} title="Seus dados" />
  );

  if (!data) {
    return <Screen scroll>{header}<View style={styles.stack}><Skeleton height={44} radius={16} /><Skeleton height={260} radius={28} /><Skeleton height={180} /></View></Screen>;
  }

  const { period } = data;
  const periodFrom = period.from ?? period.to;
  const periodDays = daysInRange(periodFrom, period.to);
  const periodWeeks = calendarWeeks(periodFrom, period.to);
  const consistency = Math.min(1, period.activeDays / periodDays);
  const runsPerWeek = period.runs / periodWeeks;
  const currentWeek = insights.period === "week";
  const compared = delta(period.distanceMeters, period.previousDistanceMeters);
  const inPeriod = (date: string) => date >= periodFrom && date <= period.to;
  const planned = (assignments.data ?? []).filter((assignment) => inPeriod(assignment.scheduledDate));
  const plannedDone = planned.filter((assignment) => assignment.status === "completed").length;
  const reviewed = (coachFeed.data ?? []).filter((item) => item.review).length;
  const feedTotal = coachFeed.data?.length ?? 0;

  return (
    <Screen scroll wide>
      {header}
      <TrendCards weeks={weekly.data?.series ?? []} longest={weekly.data?.period.longestMeters ?? period.longestMeters} desktop={desktop} />

      <View style={styles.gap} />
      <SectionTitle title="Números do período" />
      <View style={desktop && styles.selectorDesktop}><PeriodSelector value={insights.period} onChange={insights.setPeriod} /></View>
      <Text style={styles.weekNote}>As semanas vão de segunda a domingo. A semana atual entra até hoje.</Text>

      <View style={desktop && styles.split}>
      <View style={[styles.hero, desktop && styles.heroDesktop]}>
        <View style={styles.heroTop}>
          <Text style={styles.heroEyebrow}>Distância no período</Text>
          <View style={styles.heroValueRow}>
            <Text style={styles.heroValue}>{formatKm(period.distanceMeters)}</Text>
            <Text style={styles.heroUnit}>km</Text>
            <DeltaChip value={compared} />
          </View>
          <Text style={styles.heroRange}>
            {period.from ? `${formatDay(period.from)} – ${formatDay(currentWeek ? data.week.to : period.to)}` : "Sem corridas registradas ainda"}
            {insights.isFetching ? " · atualizando…" : ""}
          </Text>
          {compared !== null ? <Text style={styles.heroRange}>A porcentagem compara com {currentWeek ? "a semana passada" : "o período anterior"} até o mesmo dia.</Text> : null}
        </View>
        <BarChart buckets={data.series} height={desktop ? 150 : 120} highlight={data.series.findIndex((bucket) => bucket.from <= period.to && period.to <= bucket.to)} />
        <View style={styles.heroMetrics}>
          <HeroMetric value={String(period.runs)} label="corridas" />
          <HeroMetric value={formatDuration(period.movingSeconds)} label="em movimento" />
          <HeroMetric value={formatPace(period.averagePaceSecondsPerKm)} label="pace médio /km" />
        </View>
      </View>

      <View style={desktop && styles.side}>
      {period.runs ? (
        <>
          <View style={desktop ? styles.gapNone : styles.gap} />
          <SectionTitle title="Destaques do período" />
          <View style={styles.records}>
            <RecordCard icon="trophy-outline" label="Maior corrida" hint="A corrida mais longa." value={`${formatKm(period.longestMeters, 2)} km`} />
            <RecordCard icon="flash-outline" label="Melhor ritmo" hint="Menor tempo por km em uma corrida de 1 km ou mais." value={`${formatPace(period.bestPaceSecondsPerKm)} /km`} />
            <RecordCard icon="trending-up-outline" label="Subida acumulada" hint="Soma de todas as subidas das corridas." value={`${period.elevationMeters} m`} />
            <RecordCard icon="time-outline" label="Média por corrida" hint="Distância típica de cada saída." value={`${formatKm(period.distanceMeters / Math.max(1, period.runs), 1)} km`} />
          </View>

          <View style={styles.gap} />
          <SectionTitle title="Consistência" />
          <View style={styles.consistency}>
            <ProgressRing value={consistency} label={`${Math.round(consistency * 100)}%`} sublabel="DIAS ATIVOS" size={112} />
            <View style={styles.consistencyCopy}>
              <Text style={styles.consistencyTitle}>
                {insights.period === "all" && period.from
                  ? `${period.activeDays} dias com corrida desde ${formatDay(period.from)}`
                  : `${period.activeDays} de ${periodDays} dias com corrida`}
              </Text>
              <Text style={styles.consistencyText}>
                {currentWeek
                  ? `${period.runs} ${period.runs === 1 ? "corrida" : "corridas"} nesta semana.`
                  : `Média de ${runsPerWeek.toFixed(1).replace(".", ",")} ${runsPerWeek >= 1.95 || runsPerWeek < 1 ? "corridas" : "corrida"} por semana.`}
                {data.week.streakDays > 1 ? ` Você está numa sequência de ${data.week.streakDays} dias.` : ""}
              </Text>
              <Explain more="Mostra em quantos dias do período você correu. Correr com regularidade, mesmo pouco, costuma render mais do que uma corrida grande de vez em quando." />
            </View>
          </View>
        </>
      ) : (
        <>
          <View style={desktop ? styles.gapNone : styles.gap} />
          <EmptyState
            icon="analytics-outline"
            title="Ainda não há corridas neste período"
            text={data.stravaConnected ? "Escolha um período maior ou corra com o Strava: os dados entram sozinhos." : "Conecte o Strava ou registre treinos no clube para acompanhar sua evolução."}
            action={!data.stravaConnected ? <PrimaryButton label="Conectar Strava" icon="flash" onPress={() => router.push("/strava")} style={styles.emptyButton} /> : undefined}
          />
        </>
      )}
      </View>
      </View>

      <View style={styles.gap} />
      <RunAnalysisSection />
      <View style={styles.gap} />
      {isCoach ? (
        <>
          <SectionTitle title="Retorno à turma" action="Abrir turma" onPress={() => router.push("/(tabs)/club")} />
          <View style={styles.planCard}>
            <View style={styles.planTop}>
              <Text style={styles.planValue}>{reviewed}/{feedTotal}</Text>
              <Text style={styles.planLabel}>atividades avaliadas</Text>
            </View>
            <View style={styles.track}><View style={[styles.trackFill, { width: feedTotal ? `${Math.round((reviewed / feedTotal) * 100)}%` : "0%" }]} /></View>
            <Text style={styles.planText}>{feedTotal - reviewed ? `${feedTotal - reviewed} ${feedTotal - reviewed === 1 ? "treino aguarda" : "treinos aguardam"} seu comentário.` : "Tudo em dia com a turma."}</Text>
          </View>
        </>
      ) : (
        <>
          <SectionTitle title="Plano do treinador" action="Clube" onPress={() => router.push("/(tabs)/club")} />
          <View style={styles.planCard}>
            <View style={styles.planTop}>
              <Text style={styles.planValue}>{plannedDone}/{planned.length}</Text>
              <Text style={styles.planLabel}>treinos do plano concluídos</Text>
            </View>
            <View style={styles.track}><View style={[styles.trackFill, { width: planned.length ? `${Math.round((plannedDone / planned.length) * 100)}%` : "0%" }]} /></View>
            <Text style={styles.planText}>{planned.length ? `Treinos atribuídos com data dentro do período. Fora do plano: ${period.freeRuns} ${period.freeRuns === 1 ? "corrida livre" : "corridas livres"}.` : "Nenhum treino do treinador com data neste período."}</Text>
          </View>
        </>
      )}
    </Screen>
  );
}

const GOALS = [
  { meters: 5000, name: "5 km" },
  { meters: 10000, name: "10 km" },
  { meters: 21097, name: "21 km" },
  { meters: 42195, name: "42 km" },
];

/** The three trends of the approved design: pace line, km per week and the next distance goal. */
function TrendCards({ weeks, longest, desktop }: { weeks: InsightBucket[]; longest: number; desktop: boolean }) {
  const recent = weeks.slice(-6);
  const paced = weeks.filter((week) => week.distanceMeters >= 500 && week.movingSeconds);
  const lastPace = paced.length ? paced[paced.length - 1].movingSeconds! / (paced[paced.length - 1].distanceMeters / 1000) : null;
  const firstPace = paced.length > 1 ? paced[0].movingSeconds! / (paced[0].distanceMeters / 1000) : null;
  const gain = lastPace && firstPace ? Math.round(firstPace - lastPace) : 0;
  const goal = GOALS.find((item) => longest < item.meters) ?? GOALS[GOALS.length - 1];
  const share = Math.min(1, longest / goal.meters);
  const paceCaption = gain > 5 ? `Mais rápido é a linha subindo: seu km está ${formatPace(gain)} mais rápido do que há ${weeks.length} semanas.` : "Mais rápido é a linha subindo. Cada ponto é o pace médio de uma semana.";
  const cards = [
    <ChartCard key="pace" title="Pace médio" value={lastPace ? `${formatPace(lastPace)} /km` : undefined} caption={paced.length > 1 ? paceCaption : undefined}>
      <PaceTrend weeks={weeks} />
    </ChartCard>,
    <ChartCard key="km" title="Km por semana" value={recent.length ? `${formatKm(recent[recent.length - 1].distanceMeters)} km` : undefined} caption="A barra verde é a semana atual. O tracejado mostra quanto falta para igualar sua melhor semana.">
      <WeekKmBars weeks={recent} />
    </ChartCard>,
    <ChartCard key="goal" title={`Rumo aos ${goal.name}`} value={`${Math.round(share * 100)}%`}>
      <GoalTrack share={share} />
      <View style={styles.goalLabels}><Text style={styles.goalLabel}>maior corrida: {formatKm(longest)} km</Text><Text style={styles.goalLabel}>{goal.name}</Text></View>
    </ChartCard>,
  ];
  if (!weeks.length) return <View style={styles.stack}><Skeleton height={160} radius={14} /><Skeleton height={160} radius={14} /></View>;
  return <View style={desktop ? styles.trendGrid : styles.stack}>{cards.map((card) => <View key={card.key} style={desktop && styles.trendCell}>{card}</View>)}</View>;
}

function HeroMetric({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.heroMetric}>
      <Text style={styles.heroMetricValue}>{value}</Text>
      <Text style={styles.heroMetricLabel}>{label}</Text>
    </View>
  );
}

function RecordCard({ icon, label, hint, value }: { icon: RecordIcon; label: string; hint: string; value: string }) {
  return (
    <View style={styles.record}>
      <View style={styles.recordIcon}><Ionicons name={icon} size={17} color={C.lime} /></View>
      <Text style={styles.recordValue}>{value}</Text>
      <Text style={styles.recordLabel}>{label}</Text>
      <Text style={styles.recordHint}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  trendGrid: { flexDirection: "row", gap: 16, alignItems: "stretch" },
  trendCell: { flex: 1, minWidth: 0 },
  goalLabels: { flexDirection: "row", justifyContent: "space-between" },
  goalLabel: { color: C.muted, fontFamily: F.text, fontSize: 12 },
  gap: { height: 28 },
  gapNone: { height: 0 },
  selectorDesktop: { maxWidth: 440 },
  weekNote: { color: C.muted, fontSize: 12, fontFamily: F.text, marginTop: 8 },
  split: { flexDirection: "row", alignItems: "flex-start", gap: 20 },
  side: { flex: 1, minWidth: 0, marginTop: 16 },
  heroDesktop: { flex: 1.35, minWidth: 0 },

  hero: { marginTop: 16, padding: 18, borderRadius: 14, backgroundColor: C.road },
  heroTop: { marginBottom: 14 },
  heroEyebrow: { color: C.inkSoft, fontFamily: F.displayBold, fontSize: 16, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 },
  heroValueRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  heroValue: { color: C.ink, fontSize: 40, lineHeight: 42, fontFamily: F.display, ...NUM },
  heroUnit: { color: C.muted, fontSize: 16, fontFamily: F.textSemi, marginTop: 12, marginRight: 4 },
  heroRange: { color: C.muted, fontSize: 13, fontFamily: F.text, marginTop: 2 },
  heroMetrics: { flexDirection: "row", marginTop: 18, paddingTop: 16, borderTopWidth: 1, borderTopColor: C.line },
  heroMetric: { flex: 1, alignItems: "center", gap: 3 },
  heroMetricValue: { color: C.ink, fontSize: 22, fontFamily: F.displayBold, ...NUM },
  heroMetricLabel: { color: C.muted, fontSize: 12, fontFamily: F.text },

  records: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  record: { flexBasis: "47%", flexGrow: 1, padding: 16, borderRadius: 14, gap: 4, backgroundColor: C.road },
  recordIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: C.asphalt, marginBottom: 10 },
  recordValue: { color: C.ink, fontSize: 26, fontFamily: F.displayBold, ...NUM },
  recordLabel: { color: C.ink, fontSize: 14, fontFamily: F.textBold },
  recordHint: { color: C.muted, fontSize: 12, lineHeight: 16, fontFamily: F.text },

  consistency: { flexDirection: "row", alignItems: "center", gap: 18, padding: 18, borderRadius: 14, backgroundColor: C.road },
  consistencyCopy: { flex: 1, gap: 6 },
  consistencyTitle: { color: C.ink, fontSize: 16, fontFamily: F.textBold },
  consistencyText: { color: C.muted, fontSize: 14, lineHeight: 20, fontFamily: F.text },

  planCard: { padding: 18, borderRadius: 14, backgroundColor: C.road, gap: 10 },
  planTop: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  planValue: { color: C.ink, fontSize: 26, fontFamily: F.display, letterSpacing: 0 },
  planLabel: { color: C.inkSoft, fontSize: 14, fontFamily: F.textSemi },
  planText: { color: C.muted, fontSize: 13, lineHeight: 18, fontFamily: F.text },
  track: { height: 10, borderRadius: 5, overflow: "hidden", backgroundColor: C.stone },
  trackFill: { height: "100%", borderRadius: 5, backgroundColor: C.asphalt },

  emptyButton: { alignSelf: "stretch", marginTop: 8 },
});
