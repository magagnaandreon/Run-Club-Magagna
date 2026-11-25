import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

import { formatKm, formatPace } from "@/components/dashboard-ui";
import { C, F, NUM } from "@/components/run-ui";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * "Treino cumprido": the run that closed a workout, on asphalt.
 * The ring closes as far as the run covered the planned distance; no confetti.
 */
export function RunFinish({ distanceMeters, durationSeconds, plannedMeters, source }: { distanceMeters: number; durationSeconds: number; plannedMeters?: number; source?: string | null }) {
  const reduced = useReducedMotion();
  const share = plannedMeters ? Math.min(distanceMeters / plannedMeters, 1) : 1;
  const size = 132;
  const stroke = 9;
  const radius = (size - stroke) / 2;
  const length = 2 * Math.PI * radius;
  const progress = useSharedValue(reduced ? share : 0);
  const copy = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    progress.value = withDelay(150, withTiming(share, { duration: 1400, easing: Easing.bezier(0.3, 0.7, 0.3, 1) }));
    copy.value = withDelay(900, withTiming(1, { duration: 500, easing: Easing.out(Easing.quad) }));
  }, [copy, progress, reduced, share]);
  const ring = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - progress.value) }));
  const rise = useAnimatedStyle(() => ({ opacity: 0.001 + copy.value * 0.999, transform: [{ translateY: (1 - copy.value) * 8 }] }));
  const pace = distanceMeters > 0 ? Math.round(durationSeconds / (distanceMeters / 1000)) : null;
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = String(Math.round(durationSeconds % 60)).padStart(2, "0");
  const label = `Treino cumprido: ${formatKm(distanceMeters, 1)} quilômetros em ${minutes} minutos${pace ? `, pace de ${formatPace(pace)} por quilômetro` : ""}.`;

  return (
    <View style={styles.card} accessible accessibilityLabel={label}>
      <View style={styles.ringBox}>
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={radius} stroke={C.asphaltSoft} strokeWidth={stroke} fill="none" />
          <AnimatedCircle cx={size / 2} cy={size / 2} r={radius} stroke={C.lime} strokeWidth={stroke} strokeLinecap="round" fill="none" strokeDasharray={`${length} ${length}`} animatedProps={ring} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        </Svg>
        <View style={styles.ringCopy}>
          <Text style={styles.ringValue}>{formatKm(distanceMeters, 1)}</Text>
          <Text style={styles.ringUnit}>km</Text>
        </View>
      </View>
      <Animated.View style={[styles.copy, rise]}>
        <Text style={styles.title}>Treino cumprido</Text>
        <Text style={styles.source}>{source === "strava" ? "chegou do Strava" : "registrado por você"}</Text>
        <View style={styles.stats}>
          <View><Text style={styles.statValue}>{pace ? formatPace(pace) : "—"}</Text><Text style={styles.statLabel}>pace médio</Text></View>
          <View><Text style={styles.statValue}>{minutes}:{seconds}</Text><Text style={styles.statLabel}>tempo</Text></View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 18, marginTop: 14, padding: 18, borderRadius: 14, backgroundColor: C.asphalt },
  ringBox: { width: 132, height: 132, alignItems: "center", justifyContent: "center" },
  ringCopy: { position: "absolute", alignItems: "center" },
  ringValue: { color: C.road, fontFamily: F.display, fontSize: 38, lineHeight: 40, ...NUM },
  ringUnit: { color: C.onAsphaltMuted, fontFamily: F.textSemi, fontSize: 12, letterSpacing: 2, textTransform: "uppercase" },
  copy: { flex: 1, minWidth: 160, gap: 2 },
  title: { color: C.road, fontFamily: F.display, fontSize: 28, lineHeight: 30, textTransform: "uppercase" },
  source: { color: C.onAsphaltMuted, fontFamily: F.text, fontSize: 13 },
  stats: { flexDirection: "row", gap: 24, marginTop: 12 },
  statValue: { color: C.road, fontFamily: F.displayBold, fontSize: 24, lineHeight: 26, ...NUM },
  statLabel: { color: C.onAsphaltMuted, fontFamily: F.text, fontSize: 12 },
});
