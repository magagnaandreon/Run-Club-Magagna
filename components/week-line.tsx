import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

import { C, F } from "@/components/run-ui";
import { addDays } from "@/shared/insights";

export type WeekDay = "done" | "planned" | "missed" | "free";

const LABELS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

/** Monday to Sunday as one line on the asphalt: lime up to today, today ringed, planned days hollow. */
export function WeekLine({ weekFrom, today, days }: { weekFrom: string; today: string; days: WeekDay[] }) {
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
    <View style={styles.wrap} accessible accessibilityRole="image" accessibilityLabel={label}>
      <View style={styles.lineRow} onLayout={(event) => setSpan(Math.max(0, event.nativeEvent.layout.width - DOT))}>
        <View style={styles.track} />
        <Animated.View style={[styles.fill, fill]} />
        <View style={styles.dots}>
          {days.map((day, index) => (
            <View key={index} style={styles.dotSlot}>
              <View style={[styles.dot, index === todayIndex ? styles.dotToday : day === "done" ? styles.dotDone : day === "planned" ? styles.dotPlanned : day === "missed" ? styles.dotMissed : styles.dotFree]} />
            </View>
          ))}
        </View>
      </View>
      <View style={styles.labels}>
        {LABELS.map((name, index) => (
          <Text key={name} style={[styles.label, index === todayIndex && styles.labelToday]}>{index === todayIndex ? "hoje" : name}</Text>
        ))}
      </View>
      <Text style={styles.date} accessibilityElementsHidden>{formatRange(weekFrom)}</Text>
    </View>
  );
}

function formatRange(from: string) {
  const fmt = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" }).replace(".", "");
  return `${fmt(from)} a ${fmt(addDays(from, 6))}`;
}

const DOT = 18;

const styles = StyleSheet.create({
  wrap: { marginTop: 20, gap: 8 },
  lineRow: { height: DOT, justifyContent: "center", marginHorizontal: 0 },
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
  date: { color: C.onAsphaltMuted, fontFamily: F.text, fontSize: 12, marginTop: 2 },
});
