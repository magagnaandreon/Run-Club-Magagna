import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

import { formatKm } from "@/components/dashboard-ui";
import { C, F, NUM, SectionTitle } from "@/components/run-ui";
import { useInsights } from "@/hooks/use-insights";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Totals = { runs: number; distanceMeters: number; longestMeters: number; bestPaceSecondsPerKm: number | null };
type Achievement = { key: string; badge: string; title: string; earned: boolean; goal?: { have: number; need: number; unit: string } };

/** Medals earned from the runs themselves (club and Strava, all time). Nothing is invented: each one is a plain threshold. */
export function achievementsFrom(totals: Totals): Achievement[] {
  const longest = totals.longestMeters;
  const distance = (key: string, badge: string, title: string, meters: number): Achievement => ({ key, badge, title, earned: longest >= meters, goal: { have: longest, need: meters, unit: "km" } });
  return [
    { key: "first", badge: "1ª", title: "Primeira corrida", earned: totals.runs > 0 },
    distance("5k", "5K", "Primeiros 5 km", 5000),
    distance("10k", "10K", "Primeiros 10 km", 10000),
    distance("21k", "21K", "Meia maratona", 21097),
    distance("42k", "42K", "Maratona", 42195),
    { key: "100", badge: "100", title: "100 km no total", earned: totals.distanceMeters >= 100000, goal: { have: totals.distanceMeters, need: 100000, unit: "km" } },
    { key: "pace", badge: "5:00", title: "Pace abaixo de 5 min/km", earned: totals.bestPaceSecondsPerKm !== null && totals.bestPaceSecondsPerKm < 300 },
  ];
}

export function Achievements() {
  const insights = useInsights(true, "all");
  const period = insights.data?.period;
  if (!period) return null;
  const list = achievementsFrom(period);
  const next = list.find((item) => !item.earned && item.goal);
  return (
    <View style={styles.wrap}>
      <SectionTitle title="Conquistas" />
      <View style={styles.card}>
        <View style={styles.grid}>
          {list.map((item, index) => <Medal key={item.key} item={item} index={index} />)}
        </View>
        {next?.goal ? (
          <View style={styles.next}>
            <View style={styles.nextTop}>
              <Text style={styles.nextTitle}>Próxima: {next.title.toLowerCase()}</Text>
              <Text style={styles.nextValue}>{formatKm(next.goal.have)} de {formatKm(next.goal.need, next.goal.need % 1000 ? 1 : 0)} km</Text>
            </View>
            <View style={styles.track}><View style={[styles.fill, { width: `${Math.min(100, Math.round((next.goal.have / next.goal.need) * 100))}%` }]} /></View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function Medal({ item, index }: { item: Achievement; index: number }) {
  const reduced = useReducedMotion();
  const size = 64;
  const radius = 27;
  const length = 2 * Math.PI * radius;
  const drawn = useSharedValue(reduced || !item.earned ? 1 : 0);
  useEffect(() => {
    if (reduced || !item.earned) return;
    drawn.value = withDelay(120 + index * 110, withTiming(1, { duration: 900, easing: Easing.bezier(0.3, 0.7, 0.3, 1) }));
  }, [drawn, index, item.earned, reduced]);
  const ring = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - drawn.value) }));
  const fade = useAnimatedStyle(() => ({ opacity: 0.35 + drawn.value * 0.65 }));
  return (
    <View style={styles.medal} accessible accessibilityLabel={`${item.title}: ${item.earned ? "conquistada" : "ainda não"}`}>
      <Animated.View style={[styles.medalArt, item.earned && fade]}>
        <Svg width={size} height={size}>
          {item.earned ? (
            <>
              <Circle cx={32} cy={32} r={radius} fill={C.asphalt} />
              <AnimatedCircle cx={32} cy={32} r={radius} stroke={C.lime} strokeWidth={3} fill="none" strokeDasharray={`${length} ${length}`} animatedProps={ring} transform="rotate(-90 32 32)" />
            </>
          ) : <Circle cx={32} cy={32} r={radius} stroke={C.skyDeep} strokeWidth={2} strokeDasharray="4 4" fill="none" />}
        </Svg>
        <Text style={[styles.badge, !item.earned && styles.badgeLocked, item.badge.length > 3 && styles.badgeSmall]}>{item.badge}</Text>
      </Animated.View>
      <Text style={[styles.medalTitle, !item.earned && styles.medalTitleLocked]} numberOfLines={2}>{item.title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 26 },
  card: { backgroundColor: C.road, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 16, gap: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: 14 },
  medal: { width: "25%", minWidth: 76, alignItems: "center", gap: 6, paddingHorizontal: 2 },
  medalArt: { width: 64, height: 64, alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", color: C.road, fontFamily: F.display, fontSize: 18, ...NUM },
  badgeSmall: { fontSize: 15 },
  badgeLocked: { color: C.muted },
  medalTitle: { color: C.ink, fontFamily: F.textSemi, fontSize: 12, lineHeight: 15, textAlign: "center" },
  medalTitleLocked: { color: C.muted, fontFamily: F.text },
  next: { borderTopWidth: 1, borderTopColor: C.line, paddingTop: 12, gap: 8 },
  nextTop: { flexDirection: "row", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
  nextTitle: { color: C.ink, fontFamily: F.textSemi, fontSize: 14 },
  nextValue: { color: C.muted, fontFamily: F.text, fontSize: 13, ...NUM },
  track: { height: 8, borderRadius: 4, backgroundColor: C.stone, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4, backgroundColor: C.asphalt },
});
