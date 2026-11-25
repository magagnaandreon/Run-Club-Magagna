import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { CoachPlans } from "@/components/coach-plans";
import { EmptyState, formatDay } from "@/components/dashboard-ui";
import { AppHeader, C, PrimaryButton, Row, Screen, SectionTitle, F, NUM } from "@/components/run-ui";
import { useAuth } from "@/hooks/use-auth";
import { localToday } from "@/hooks/use-insights";
import { trpc } from "@/lib/trpc";

export default function PlansScreen() {
  const { user } = useAuth();
  if (user?.role === "admin") return <CoachPlans />;
  return <AthletePlans />;
}

function AthletePlans() {
  const router = useRouter();
  const { user } = useAuth();
  const assignments = trpc.club.myAssignments.useQuery({ today: localToday() }, { enabled: Boolean(user) });
  const completedCount = (assignments.data ?? []).filter((assignment) => assignment.status === "completed").length;
  const nextAssignment = assignments.data?.find((assignment) => assignment.status === "assigned");
  if (assignments.isLoading) return <Screen><View style={styles.empty}><Text style={styles.currentText}>Carregando seu plano…</Text></View></Screen>;

  return <Screen scroll>
    <AppHeader eyebrow="Seu caminho" title="Planos" />

    <View style={styles.currentPlan}><View style={styles.currentTop}><Text style={styles.eyebrow}>{nextAssignment ? "PRÓXIMO TREINO" : "AGUARDANDO"}</Text><Text style={styles.week}>{nextAssignment ? formatDay(nextAssignment.scheduledDate) : "SEU CLUBE"}</Text></View><Text style={styles.currentTitle}>{nextAssignment?.title || "Aguardando seu treinador"}</Text><Text style={styles.currentText}>{nextAssignment?.objective || "Os treinos atribuídos aparecerão aqui, com as etapas e orientações do seu treinador."}</Text><View style={styles.currentStats}><View style={styles.statTile}><Text style={styles.statValue}>{nextAssignment?.steps.length ?? 0}</Text><Text style={styles.statLabel}>etapas</Text></View><View style={styles.statTile}><Text style={styles.statValue}>{assignments.data?.length ?? 0}</Text><Text style={styles.statLabel}>recebidos</Text></View><View style={styles.statTile}><Text style={[styles.statValue, styles.statLime]}>{completedCount}</Text><Text style={styles.statLabel}>concluídos</Text></View></View><PrimaryButton label="Ver treinos" onPress={() => router.push("/(tabs)/club")} style={styles.currentButton} /></View>

    <View style={styles.gap} />
    <SectionTitle title="Treinos atribuídos" />
    {assignments.data?.length ? <View style={styles.planList}>{assignments.data.map((assignment) => <PlanCard key={assignment.id} done={assignment.status === "completed"} title={assignment.title} detail={assignment.objective} meta={formatDay(assignment.scheduledDate)} onPress={() => router.push("/(tabs)/club")} />)}</View> : <EmptyState icon="calendar-outline" title="Nenhum treino enviado ainda" text="Quando seu treinador atribuir uma sessão, ela aparecerá aqui." />}

    <View style={styles.gap} />
    <SectionTitle title="O que guia cada plano" />
    <View style={styles.guideCard}><Row icon="heart-outline" title="Esforço sustentável" detail="Intensidade ajustada ao seu momento." /><Row icon="calendar-outline" title="Rotina que cabe" detail="Treinos adaptáveis à sua semana." /><Row icon="sparkles-outline" title="Orientação clara" detail="Cada passo tem um porquê, sem jargão." /></View>
  </Screen>;
}

/** One assigned workout: a lime dot when done, a hollow one while it waits. */
function PlanCard({ done, title, detail, meta, onPress }: { done: boolean; title: string; detail: string; meta: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.planCard, pressed && styles.pressed]}><View style={[styles.planDot, done && styles.planDotDone]} /><View style={styles.planCopy}><Text style={styles.planTitle}>{title}</Text><Text style={styles.planDetail}>{detail}</Text></View><View style={styles.planSide}><Text style={styles.planMeta}>{meta}</Text><Text style={[styles.planState, done && styles.planStateDone]}>{done ? "concluído" : "para fazer"}</Text></View><Ionicons name="chevron-forward" size={18} color={C.muted} /></Pressable>;
}

const styles = StyleSheet.create({
  currentPlan: { padding: 18, borderRadius: 14, backgroundColor: C.stone },
  currentTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { color: C.coneInk, fontSize: 12, fontFamily: F.textBold, letterSpacing: 1 },
  week: { color: C.muted, fontSize: 13, fontFamily: F.text },
  currentTitle: { color: C.ink, fontSize: 28, lineHeight: 30, fontFamily: F.display, textTransform: "uppercase", marginTop: 10 },
  currentText: { color: C.inkSoft, fontSize: 14, lineHeight: 20, fontFamily: F.text, marginTop: 4 },
  currentStats: { flexDirection: "row", gap: 8, marginTop: 16 },
  statTile: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: C.asphalt },
  statValue: { color: C.road, fontSize: 26, fontFamily: F.displayBold, ...NUM },
  statLime: { color: C.lime },
  statLabel: { color: C.onAsphaltMuted, fontSize: 12, fontFamily: F.text },
  currentButton: { marginTop: 16, minHeight: 50 },
  gap: { height: 24 },
  planList: { gap: 8 },
  planCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, backgroundColor: C.road },
  planDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: "#9EA19C" },
  planDotDone: { backgroundColor: C.lime, borderColor: C.asphalt },
  planCopy: { flex: 1, gap: 2 },
  planTitle: { color: C.ink, fontSize: 16, fontFamily: F.textBold },
  planDetail: { color: C.muted, fontSize: 13, lineHeight: 18, fontFamily: F.text },
  planSide: { alignItems: "flex-end", gap: 2 },
  planMeta: { color: C.inkSoft, fontSize: 13, fontFamily: F.textSemi },
  planState: { color: C.coneInk, fontSize: 12, fontFamily: F.text },
  planStateDone: { color: C.muted },
  guideCard: { paddingHorizontal: 16, borderRadius: 14, backgroundColor: C.road },
  empty: { padding: 18, borderRadius: 14, backgroundColor: C.road, gap: 6 },
  pressed: { opacity: 0.75 },
});
