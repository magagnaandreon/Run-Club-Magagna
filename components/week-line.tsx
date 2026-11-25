import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

import { ChartTip } from "@/components/run-charts";
import { C, F } from "@/components/run-ui";
import { addDays } from "@/shared/insights";

export type WeekDay = "done" | "planned" | "missed" | "free";

const LABELS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

/** Monday to Sunday as one line on the asphalt: lime up to today, today ringed, planned days hollow. */
const STATUS: Record<WeekDay, string> = { done: "treino feito", planned: "treino marcado", missed: "treino não feito", free: "dia livre" };

/** `titles` names the coach's workout of each day, shown when the mouse (or a tap) is on that day. */
export function WeekLine({ weekFrom, today, days, light = false, titles }: { weekFrom: string; today: string; days: WeekDay[]; light?: boolean; titles?: (string | null)[] }) {
  const [active, setActive] = useState<number | null>(null);
  const reduced = useReducedMotion();
  const todayIndex = Math.max(0, Math.min(6, Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${weekFrom}T12:00:00Z`)) / 86400000)));
  const target = todayIndex / 6;
  const progress = useSharedValue(reduced ? target : 0);
  useEffect(() => {
    progress.value = reduced ? target : withDelay(150, withTiming(target, { duration: 1400, easing: Easing.bezier(0.3, 0.7, 0.3, 1) }));
  }, [progress, reduced, target]);
  // Track length in px: the space between the first and the last dot's centres.
  const [span, setSpan] = useState(0);
  const fill = useAnimatedStyle(() => ({ width: progress.value * span }));
  const doneCount = days.filter((day) => day === "done").length;
  const plannedCount = days.filter((day) => day !== "free").length;
  const label = `Semana de segunda a domingo: ${doneCount} de ${plannedCount} treinos feitos, hoje é ${LABELS[todayIndex]}.`;

  return (
    <View style={[styles.wrap, light && styles.wrapLight]} accessibilityLabel={label}>
      <View style={styles.lineRow} onLayout={(event) => setSpan(Math.max(0, event.nativeEvent.layout.width - DOT))}>
        <View style={[styles.track, light && styles.trackLight]} />
        <Animated.View style={[styles.fill, light && styles.fillLight, fill]} />
        <View style={styles.dots}>
          {days.map((day, index) => (
            <Pressable
              key={index}
              style={styles.dotSlot}
              hitSlop={{ top: 12, bottom: 22, left: 14, right: 14 }}
              onHoverIn={() => setActive(index)}
              onHoverOut={() => setActive((current) => (current === index ? null : current))}
              onPress={() => setActive(active === index ? null : index)}
              accessibilityLabel={`${dayName(weekFrom, index)}: ${STATUS[day]}${titles?.[index] ? `, ${titles[index]}` : ""}`}
            >
              <View style={[styles.dot, index === todayIndex ? (light ? styles.dotTodayLight : styles.dotToday) : day === "done" ? [styles.dotDone, light && styles.dotDoneLight] : day === "planned" ? (light ? styles.dotPlannedLight : styles.dotPlanned) : day === "missed" ? styles.dotMissed : (light ? styles.dotFreeLight : styles.dotFree)]} />
            </Pressable>
          ))}
        </View>
        {active !== null && span ? <ChartTip onDark={!light} x={(active * span) / 6 + DOT / 2} width={span + DOT} top={DOT + 6} title={dayName(weekFrom, active)} lines={[STATUS[days[active]], ...(titles?.[active] ? [titles[active] as string] : [])]} /> : null}
      </View>
      <View style={styles.labels}>
        {LABELS.map((name, index) => (
          <Text key={name} style={[styles.label, light && styles.labelLight, index === todayIndex && (light ? styles.labelTodayLight : styles.labelToday)]}>{index === todayIndex ? "hoje" : name}</Text>
        ))}
      </View>
      <Text style={[styles.date, light && styles.labelLight]} accessibilityElementsHidden>{formatRange(weekFrom)}</Text>
    </View>
  );
}

function dayName(weekFrom: string, index: number) {
  return new Date(`${addDays(weekFrom, index)}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).replace(/\./g, "");
}

function formatRange(from: string) {
  const fmt = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" }).replace(".", "");
  return `${fmt(from)} a ${fmt(addDays(from, 6))}`;
}

const DOT = 18;

const styles = StyleSheet.create({
  wrap: { marginTop: 20, gap: 8 },
  lineRow: { height: DOT, justifyContent: "center", marginHorizontal: 0, zIndex: 2 },
  track: { position: "absolute", left: DOT / 2, right: DOT / 2, height: 5, borderRadius: 3, backgroundColor: C.asphaltSoft },
  fill: { position: "absolute", left: DOT / 2, height: 5, borderRadius: 3, backgroundColor: C.lime },
  dots: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dotSlot: { width: DOT, height: DOT, alignItems: "center", justifyContent: "center" },
  dot: { borderRadius: 999 },
  dotDone: { width: 16, height: 16, backgroundColor: C.lime },
  dotToday: { width: 18, height: 18, backgroundColor: C.asphalt, borderWidth: 3, borderColor: C.road },
  dotPlanned: { width: 14, height: 14, backgroundColor: C.asphalt, borderWidth: 2, borderColor: C.onAsphaltMuted },
  dotMissed: { width: 10, height: 10, backgroundColor: "#5D6264" },
  dotFree: { width: 8, height: 8, backgroundColor: C.asphaltSoft },
  labels: { flexDirection: "row", justifyContent: "space-between" },
  label: { width: 34, marginHorizontal: -8, textAlign: "center", color: C.onAsphaltMuted, fontFamily: F.text, fontSize: 12 },
  labelToday: { color: C.road, fontFamily: F.textBold },
  wrapLight: { marginTop: 4 },
  trackLight: { backgroundColor: C.stone, height: 4 },
  fillLight: { backgroundColor: C.asphalt, height: 4 },
  dotDoneLight: { borderWidth: 2, borderColor: C.asphalt },
  dotTodayLight: { width: 18, height: 18, backgroundColor: C.road, borderWidth: 3, borderColor: C.cone },
  dotPlannedLight: { width: 14, height: 14, backgroundColor: C.road, borderWidth: 2, borderColor: "#9EA19C" },
  dotFreeLight: { width: 10, height: 10, backgroundColor: C.stone },
  labelLight: { color: C.muted },
  labelTodayLight: { color: C.cone, fontFamily: F.textBold },
  date: { color: C.onAsphaltMuted, fontFamily: F.text, fontSize: 12, marginTop: 2 },
});
