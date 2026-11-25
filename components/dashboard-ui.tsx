import { Ionicons } from "@expo/vector-icons";
import { type ComponentProps, type ReactNode, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { C, F } from "@/components/run-ui";
import type { InsightBucket, InsightPeriod } from "@/shared/insights";

type IconName = ComponentProps<typeof Ionicons>["name"];

export const STRAVA_ORANGE = "#FC4C02";

export function formatKm(meters: number, digits = 1) {
  return (meters / 1000).toFixed(meters >= 100_000 ? 0 : digits).replace(".", ",");
}

export function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours) return `${hours}h${String(minutes).padStart(2, "0")}`;
  return `${minutes} min`;
}

export function formatPace(secondsPerKm: number | null | undefined) {
  if (!secondsPerKm) return "—";
  const whole = Math.round(secondsPerKm);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export function formatDay(date: string) {
  const value = new Date(`${date}T12:00:00`);
  return value.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "");
}

/** Percentage change, or null when there is nothing to compare with. */
export function delta(current: number, previous: number | null | undefined) {
  if (previous === null || previous === undefined || previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

const PERIOD_LABELS: Record<InsightPeriod, string> = { week: "Semana", "4w": "4 semanas", "12w": "12 semanas", all: "Tudo" };

/** A plain-language line, with the longer explanation one tap away. */
export function Explain({ lead, more }: { lead?: string; more: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.explain}>
      {lead ? <Text style={styles.explainText}>{lead}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} hitSlop={8} onPress={() => setOpen(!open)} style={styles.explainToggle}>
        <Ionicons name={open ? "chevron-up" : "help-circle-outline"} size={15} color={C.inkSoft} />
        <Text style={styles.explainToggleText}>{open ? "Fechar" : "O que é isso?"}</Text>
      </Pressable>
      {open ? <Text style={styles.explainText}>{more}</Text> : null}
    </View>
  );
}

export function PeriodSelector({ value, onChange }: { value: InsightPeriod; onChange: (period: InsightPeriod) => void }) {
  return (
    <View style={styles.segment} accessibilityRole="tablist">
      {(Object.keys(PERIOD_LABELS) as InsightPeriod[]).map((period) => {
        const active = period === value;
        return (
          <Pressable
            key={period}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(period)}
            style={({ pressed }) => [styles.segmentItem, active && styles.segmentItemActive, pressed && styles.pressed]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{PERIOD_LABELS[period]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export type SegmentOption<T extends string> = { value: T; label: string; badge?: number };

/** Pill-shaped tabs for switching between sections of one screen. */
export function Segmented<T extends string>({ options, value, onChange }: { options: SegmentOption<T>[]; value: T; onChange: (value: T) => void }) {
  return (
    <View style={styles.segment} accessibilityRole="tablist">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [styles.segmentItem, styles.segmentItemRow, active && styles.segmentItemActive, pressed && styles.pressed]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>{option.label}</Text>
            {option.badge ? (
              <View style={[styles.segmentBadge, active && styles.segmentBadgeActive]}>
                <Text style={styles.segmentBadgeText}>{option.badge}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function shiftDate(days: number) {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

/** Quick date picks plus the typed AAAA-MM-DD field, so most dates take one tap. */
export function DateChips({ value, onChange, past = false }: { value: string; onChange: (value: string) => void; past?: boolean }) {
  const options = past
    ? [{ label: "Hoje", value: shiftDate(0) }, { label: "Ontem", value: shiftDate(-1) }, { label: "Anteontem", value: shiftDate(-2) }]
    : [{ label: "Hoje", value: shiftDate(0) }, { label: "Amanhã", value: shiftDate(1) }, { label: "Em 2 dias", value: shiftDate(2) }];
  return (
    <View style={styles.dateChips}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable key={option.label} onPress={() => onChange(option.value)} style={({ pressed }) => [styles.dateChip, active && styles.dateChipActive, pressed && styles.pressed]}>
            <Text style={[styles.dateChipText, active && styles.dateChipTextActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function DeltaChip({ value, inverse = false }: { value: number | null; inverse?: boolean }) {
  if (value === null) return null;
  const up = value >= 0;
  return (
    <View style={[styles.delta, up ? styles.deltaUp : styles.deltaDown, inverse && up && styles.deltaUpInverse]}>
      <Ionicons name={up ? "arrow-up" : "arrow-down"} size={10} color={up ? C.ink : "#8A2A12"} />
      <Text style={[styles.deltaText, !up && styles.deltaTextDown]}>{Math.abs(value)}%</Text>
    </View>
  );
}

export type FloatingStat = { icon: IconName; label: string; value: string; unit?: string; delta?: number | null; accent?: string };

/** Horizontally scrolling stat tiles that sit above the page with a soft shadow. */
/** A swipeable row on phones; `grid` lays the same cards out in two columns for wide screens. */
export function FloatingStats({ stats, grid = false }: { stats: FloatingStat[]; grid?: boolean }) {
  const cards = stats.map((stat) => (
    <View key={stat.label} style={grid ? styles.gridCard : styles.floatingCard}>
      <View style={[styles.floatingTop, grid && styles.gridTop]}>
        <View style={[styles.floatingIcon, grid && styles.gridIcon, { backgroundColor: stat.accent ?? C.lime }]}><Ionicons name={stat.icon} size={grid ? 14 : 16} color={C.ink} /></View>
        <DeltaChip value={stat.delta ?? null} />
      </View>
      <Text style={[styles.floatingValue, grid && styles.gridValue]} numberOfLines={1}>
        {stat.value}
        {stat.unit ? <Text style={styles.floatingUnit}> {stat.unit}</Text> : null}
      </Text>
      <Text style={styles.floatingLabel} numberOfLines={1}>{stat.label}</Text>
    </View>
  ));
  if (grid) return <View style={styles.grid}>{cards}</View>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.floatingRow} style={styles.floatingScroll}>
      {cards}
    </ScrollView>
  );
}

/**
 * Bar chart scaled to its own maximum. Tapping a bar shows its value; the last bar is highlighted
 * as "now". Long series hide most labels so they stay readable on a phone.
 */
/** `highlight` marks the current bucket (the last one by default; today in a Monday-to-Sunday week). */
export function BarChart({ buckets, dark = false, height = 120, unit = "km", highlight = buckets.length - 1 }: { buckets: InsightBucket[]; dark?: boolean; height?: number; unit?: string; highlight?: number }) {
  const [selected, setSelected] = useState<number | null>(null);
  const max = Math.max(...buckets.map((bucket) => bucket.distanceMeters), 1);
  const labelEvery = buckets.length > 14 ? Math.ceil(buckets.length / 7) : 1;
  const focus = selected ?? null;
  const focused = focus !== null ? buckets[focus] : null;

  return (
    <View>
      <View style={styles.chartHint}>
        {focused ? (
          <Text style={[styles.chartHintText, dark && styles.textOnDark]}>
            {focused.from === focused.to ? formatDay(focused.from) : `${formatDay(focused.from)} – ${formatDay(focused.to)}`} · <Text style={styles.chartHintStrong}>{formatKm(focused.distanceMeters)} {unit}</Text> · {focused.runs} {focused.runs === 1 ? "corrida" : "corridas"}
          </Text>
        ) : (
          <Text style={[styles.chartHintText, dark && styles.mutedOnDark]}>Toque numa barra para ver o detalhe</Text>
        )}
      </View>
      <View style={[styles.chart, { height }]}>
        {buckets.map((bucket, index) => {
          const ratio = bucket.distanceMeters / max;
          const isLast = index === highlight;
          const isFocus = focus === index;
          return (
            <Pressable
              key={`${bucket.from}-${index}`}
              onPress={() => setSelected(isFocus ? null : index)}
              accessibilityLabel={`${bucket.label}: ${formatKm(bucket.distanceMeters)} ${unit}`}
              style={styles.barSlot}
            >
              <View style={[styles.barTrack, dark && styles.barTrackDark]}>
                <View
                  style={[
                    styles.barFill,
                    { height: `${bucket.distanceMeters ? Math.max(6, ratio * 100) : 0}%` },
                    dark ? styles.barFillDark : styles.barFillLight,
                    (isLast || isFocus) && styles.barFillHot,
                  ]}
                />
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.chartLabels}>
        {buckets.map((bucket, index) => (
          <Text
            key={`${bucket.from}-label`}
            style={[styles.chartLabel, dark && styles.mutedOnDark, (index === highlight || focus === index) && (dark ? styles.textOnDark : styles.chartLabelHot)]}
            numberOfLines={1}
          >
            {(buckets.length - 1 - index) % labelEvery === 0 ? bucket.label : ""}
          </Text>
        ))}
      </View>
    </View>
  );
}

export function SourceBadge({ source }: { source: "club" | "strava" }) {
  const strava = source === "strava";
  return (
    <View style={[styles.source, strava ? styles.sourceStrava : styles.sourceClub]}>
      <Text style={[styles.sourceText, strava && styles.sourceTextStrava]}>{strava ? "STRAVA" : "CLUBE"}</Text>
    </View>
  );
}

/** Tells the coach's workouts apart from runs outside the plan. */
export function KindBadge({ workout }: { workout: boolean }) {
  return (
    <View style={[styles.kind, workout && styles.kindWorkout]}>
      <Text style={styles.kindText}>{workout ? "TREINO" : "CORRIDA LIVRE"}</Text>
    </View>
  );
}

export function TrainingRow({ title, workout, date, source, distanceMeters, movingSeconds, paceSecondsPerKm, onPress }: {
  title: string;
  workout: boolean;
  date: string;
  source: "club" | "strava";
  distanceMeters: number;
  movingSeconds: number;
  paceSecondsPerKm: number | null;
  onPress?: () => void;
}) {
  const body = (
    <>
      <View style={styles.trainingDate}>
        <Text style={styles.trainingDay}>{date.slice(8, 10)}</Text>
        <Text style={styles.trainingMonth}>{new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase()}</Text>
      </View>
      <View style={styles.trainingCopy}>
        <View style={styles.trainingTitleRow}>
          <Text style={styles.trainingTitle} numberOfLines={1}>{title}</Text>
          <SourceBadge source={source} />
        </View>
        <KindBadge workout={workout} />
        <View style={styles.trainingMetrics}>
          <Text style={styles.trainingMetricStrong}>{formatKm(distanceMeters, 2)} km</Text>
          <Text style={styles.trainingDot}>·</Text>
          <Text style={styles.trainingMetric}>{formatDuration(movingSeconds)}</Text>
          <Text style={styles.trainingDot}>·</Text>
          <Text style={styles.trainingMetric}>{formatPace(paceSecondsPerKm)} /km</Text>
        </View>
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={18} color={C.muted} /> : null}
    </>
  );
  if (!onPress) return <View style={styles.trainingRow}>{body}</View>;
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.trainingRow, pressed && styles.pressed]}>{body}</Pressable>;
}

export function Card({ children, tone = "white", style }: { children: ReactNode; tone?: "white" | "dark" | "sand" | "sky" | "lime"; style?: object }) {
  return <View style={[styles.card, styles[`card_${tone}`], style]}>{children}</View>;
}

export function EmptyState({ icon, title, text, action }: { icon: IconName; title: string; text: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}><Ionicons name={icon} size={22} color={C.ink} /></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
      {action}
    </View>
  );
}

export function Skeleton({ height = 120, radius = 22 }: { height?: number; radius?: number }) {
  return <View style={[styles.skeleton, { height, borderRadius: radius }]} />;
}

const styles = StyleSheet.create({
  explain: { gap: 6 },
  explainText: { color: C.inkSoft, fontSize: 12, lineHeight: 18, fontFamily: F.text },
  explainToggle: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 4 },
  explainToggleText: { color: C.inkSoft, fontSize: 12, fontFamily: F.textBold, textDecorationLine: "underline" },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  textOnDark: { color: C.white },
  mutedOnDark: { color: "rgba(255,255,255,0.55)" },

  segment: { flexDirection: "row", padding: 4, gap: 4, borderRadius: 14, backgroundColor: C.stone },
  segmentItem: { flex: 1, minHeight: 36, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  segmentItemActive: { backgroundColor: C.asphalt },
  segmentItemRow: { flexDirection: "row", flexGrow: 1, flexShrink: 0, flexBasis: "auto", gap: 6, paddingHorizontal: 6 },
  segmentBadge: { minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: C.coral },
  segmentBadgeActive: { backgroundColor: C.lime },
  segmentBadgeText: { color: C.ink, fontSize: 11, fontFamily: F.textBold },
  dateChips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  dateChip: { minHeight: 34, justifyContent: "center", paddingHorizontal: 12, borderRadius: 999, backgroundColor: C.stone },
  dateChipActive: { backgroundColor: C.asphalt },
  dateChipText: { color: C.ink, fontSize: 12, fontFamily: F.textBold },
  dateChipTextActive: { color: C.road },
  segmentText: { color: C.inkSoft, fontSize: 13, fontFamily: F.textSemi },
  segmentTextActive: { color: C.road },

  delta: { flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 999 },
  deltaUp: { backgroundColor: "#E9F9B5" },
  deltaUpInverse: { backgroundColor: C.lime },
  deltaDown: { backgroundColor: "#FBE0D8" },
  deltaText: { color: C.ink, fontSize: 11, fontFamily: F.textBold },
  deltaTextDown: { color: "#8A2A12" },

  floatingScroll: { marginHorizontal: -20, overflow: "visible" },
  floatingRow: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 18, gap: 10 },
  floatingCard: { width: 138, padding: 14, borderRadius: 14, backgroundColor: C.white, gap: 2 },
  floatingTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  floatingIcon: { width: 30, height: 30, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  floatingValue: { color: C.ink, fontSize: 24, lineHeight: 28, fontFamily: F.display, letterSpacing: 0 },
  floatingUnit: { color: C.muted, fontSize: 12, fontFamily: F.textSemi, letterSpacing: 0 },
  floatingLabel: { color: C.muted, fontSize: 12, fontFamily: F.text },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  gridCard: { flexBasis: "45%", flexGrow: 1, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: C.white, gap: 1 },
  gridTop: { marginBottom: 8 },
  gridIcon: { width: 26, height: 26, borderRadius: 9 },
  gridValue: { fontSize: 20, lineHeight: 24 },

  chartHint: { minHeight: 20, marginBottom: 10 },
  chartHintText: { color: C.muted, fontSize: 12, fontFamily: F.text },
  chartHintStrong: { fontFamily: F.textBold },
  chart: { flexDirection: "row", alignItems: "stretch", gap: 6 },
  barSlot: { flex: 1, alignItems: "center" },
  barTrack: { flex: 1, width: "100%", maxWidth: 40, justifyContent: "flex-end", borderRadius: 4, overflow: "hidden" },
  barTrackDark: {},
  barFill: { width: "100%", borderRadius: 4 },
  barFillLight: { backgroundColor: "#B9BCB6" },
  barFillDark: { backgroundColor: "#5D6264" },
  barFillHot: { backgroundColor: C.lime, borderWidth: 1.5, borderColor: C.asphalt },
  chartLabels: { flexDirection: "row", gap: 4, marginTop: 8 },
  chartLabel: { flex: 1, textAlign: "center", color: C.muted, fontSize: 12, fontFamily: F.text },
  chartLabelHot: { color: C.ink, fontFamily: F.textBold },

  source: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  sourceStrava: { backgroundColor: "#FFE4D6" },
  sourceClub: { backgroundColor: "#EEF8C6" },
  kind: { alignSelf: "flex-start", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: C.stone, marginBottom: 3 },
  kindWorkout: { backgroundColor: C.coneTint },
  kindText: { color: C.inkSoft, fontSize: 11, fontFamily: F.textBold, letterSpacing: 0.5 },
  sourceText: { color: C.ink, fontSize: 8, fontFamily: F.textBold, letterSpacing: 0.6 },
  sourceTextStrava: { color: "#B23500" },

  trainingRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: C.white },
  trainingDate: { width: 44, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: C.asphalt },
  trainingDay: { color: C.road, fontSize: 20, lineHeight: 21, fontFamily: F.displayBold },
  trainingMonth: { color: C.onAsphaltMuted, fontSize: 11, fontFamily: F.textSemi, letterSpacing: 0.5 },
  trainingCopy: { flex: 1, gap: 5 },
  trainingTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  trainingTitle: { flexShrink: 1, color: C.ink, fontSize: 15, fontFamily: F.textBold },
  trainingMetrics: { flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap" },
  trainingMetricStrong: { color: C.ink, fontSize: 13, fontFamily: F.textBold },
  trainingMetric: { color: C.muted, fontSize: 13, fontFamily: F.text },
  trainingDot: { color: C.line, fontSize: 12, fontFamily: F.textBold },

  card: { borderRadius: 14, padding: 18 },
  card_white: { backgroundColor: C.white },
  card_dark: { backgroundColor: C.ink },
  card_sand: { backgroundColor: C.sand },
  card_sky: { backgroundColor: C.sky },
  card_lime: { backgroundColor: C.lime },

  empty: { alignItems: "flex-start", gap: 6, padding: 18, borderRadius: 14, backgroundColor: C.white },
  emptyIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: C.stone, marginBottom: 4 },
  emptyTitle: { color: C.ink, fontSize: 16, fontFamily: F.textBold },
  emptyText: { color: C.muted, fontSize: 14, lineHeight: 20, fontFamily: F.text },

  skeleton: { backgroundColor: C.stone },
});
