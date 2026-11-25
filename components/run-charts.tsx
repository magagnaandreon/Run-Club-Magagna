import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import Svg, { Circle, Line, Path } from "react-native-svg";

import { formatKm, formatPace } from "@/components/dashboard-ui";
import { C, F, NUM } from "@/components/run-ui";
import type { InsightBucket } from "@/shared/insights";

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** A light card with a small uppercase title and an optional value on the right. */
export function ChartCard({ title, value, caption, children }: { title: string; value?: string; caption?: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.cardTitle}>{title}</Text>
        {value ? <Text style={styles.cardValue}>{value}</Text> : null}
      </View>
      {children}
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

/**
 * Km per Monday-to-Sunday week. Past weeks are gray, the best one asphalt, the current one lime
 * inside a dashed outline that shows how far it is from the best week.
 */
export function WeekKmBars({ weeks, height = 104 }: { weeks: InsightBucket[]; height?: number }) {
  const reduced = useReducedMotion();
  const grow = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) grow.value = withDelay(100, withTiming(1, { duration: 900, easing: Easing.bezier(0.3, 0.7, 0.3, 1) }));
  }, [grow, reduced]);
  const growStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: grow.value }] }));
  const current = weeks.length - 1;
  const past = weeks.slice(0, current);
  const best = past.length ? past.reduce((top, week, index) => (week.distanceMeters > past[top].distanceMeters ? index : top), 0) : -1;
  const max = Math.max(1, ...weeks.map((week) => week.distanceMeters));
  const bestMeters = best >= 0 ? past[best].distanceMeters : 0;
  const label = `Quilômetros por semana: ${weeks.map((week) => formatKm(week.distanceMeters)).join(", ")}${weeks.length ? " até agora" : ""}.`;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label}>
      <View style={[styles.bars, { height }]}>
        {weeks.map((week, index) => {
          const isCurrent = index === current;
          const share = week.distanceMeters / max;
          return (
            <View key={week.from} style={styles.barSlot}>
              {isCurrent && bestMeters > week.distanceMeters ? <View style={[styles.goal, { height: `${(bestMeters / max) * 100}%` }]} /> : null}
              <Animated.View style={[styles.bar, { height: `${week.distanceMeters ? Math.max(4, share * 100) : 0}%`, transformOrigin: "bottom" }, isCurrent ? styles.barCurrent : index === best ? styles.barBest : styles.barPast, growStyle]} />
            </View>
          );
        })}
      </View>
      <View style={styles.barLabels}>
        {weeks.map((week, index) => (
          <Text key={week.from} style={[styles.barLabel, (index === current || index === best) && styles.barLabelStrong]}>{formatKm(week.distanceMeters)}</Text>
        ))}
      </View>
    </View>
  );
}

/** Average pace per week as a line; faster weeks sit higher. Weeks without runs are skipped. */
export function PaceTrend({ weeks, height = 110 }: { weeks: InsightBucket[]; height?: number }) {
  const [width, setWidth] = useState(0);
  const reduced = useReducedMotion();
  const draw = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) draw.value = withDelay(150, withTiming(1, { duration: 1400, easing: Easing.bezier(0.3, 0.7, 0.3, 1) }));
  }, [draw, reduced]);
  const points = weeks
    .map((week, index) => ({ index, pace: week.distanceMeters >= 500 && week.movingSeconds ? week.movingSeconds / (week.distanceMeters / 1000) : null }))
    .filter((point): point is { index: number; pace: number } => point.pace !== null);
  const length = 2000;
  const animated = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - draw.value) }));
  if (points.length < 2) return <Text style={styles.caption}>Corra em pelo menos duas semanas para ver a linha do pace.</Text>;
  const slow = Math.max(...points.map((point) => point.pace));
  const fast = Math.min(...points.map((point) => point.pace));
  const spread = Math.max(slow - fast, 10);
  const top = 14;
  const bottom = height - 22;
  const x = (index: number) => 8 + (index / Math.max(1, weeks.length - 1)) * (width - 16);
  const y = (pace: number) => bottom - ((slow - pace) / spread) * (bottom - top);
  const d = points.map((point, index) => `${index ? "L" : "M"}${x(point.index)} ${y(point.pace)}`).join(" ");
  const last = points[points.length - 1];
  const first = points[0];
  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} accessible accessibilityRole="image" accessibilityLabel={`Pace médio por semana: de ${formatPace(first.pace)} para ${formatPace(last.pace)} por quilômetro.`}>
      {width ? (
        <Svg width={width} height={height}>
          {[top + 6, (top + bottom) / 2, bottom].map((lineY) => <Line key={lineY} x1={0} x2={width} y1={lineY} y2={lineY} stroke={C.stone} strokeWidth={1} />)}
          <AnimatedPath d={d} fill="none" stroke={C.asphalt} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`${length} ${length}`} animatedProps={animated} />
          <Circle cx={x(last.index)} cy={y(last.pace)} r={6} fill={C.lime} stroke={C.asphalt} strokeWidth={2} />
        </Svg>
      ) : <View style={{ height }} />}
      <View style={styles.paceLabels}><Text style={styles.axisLabel}>{weeks.length} sem. atrás</Text><Text style={styles.axisLabel}>esta semana</Text></View>
    </View>
  );
}

/** A thick progress track toward a distance goal. */
export function GoalTrack({ share }: { share: number }) {
  const [width, setWidth] = useState(0);
  const reduced = useReducedMotion();
  const fill = useSharedValue(reduced ? share : 0);
  useEffect(() => {
    fill.value = reduced ? share : withDelay(150, withTiming(share, { duration: 1200, easing: Easing.bezier(0.3, 0.7, 0.3, 1) }));
  }, [fill, reduced, share]);
  const style = useAnimatedStyle(() => ({ width: fill.value * width }));
  return <View style={styles.goalTrack} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}><Animated.View style={[styles.goalFill, style]} /></View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: C.road, borderRadius: 14, padding: 16, gap: 10 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8 },
  cardTitle: { color: C.inkSoft, fontFamily: F.displayBold, fontSize: 16, letterSpacing: 1, textTransform: "uppercase" },
  cardValue: { color: C.ink, fontFamily: F.displayBold, fontSize: 22, ...NUM },
  caption: { color: C.muted, fontFamily: F.text, fontSize: 13, lineHeight: 18 },
  bars: { flexDirection: "row", alignItems: "flex-end", gap: 12 },
  barSlot: { flex: 1, height: "100%", justifyContent: "flex-end" },
  bar: { width: "100%", borderRadius: 4 },
  barPast: { backgroundColor: "#B9BCB6" },
  barBest: { backgroundColor: C.asphalt },
  barCurrent: { backgroundColor: C.lime, borderWidth: 1.5, borderColor: C.asphalt },
  goal: { position: "absolute", left: 0, right: 0, bottom: 0, borderRadius: 4, borderWidth: 1.5, borderStyle: "dashed", borderColor: "#B9BCB6" },
  barLabels: { flexDirection: "row", gap: 12, marginTop: 6 },
  barLabel: { flex: 1, textAlign: "center", color: C.muted, fontFamily: F.text, fontSize: 12, ...NUM },
  barLabelStrong: { color: C.ink, fontFamily: F.textBold },
  paceLabels: { flexDirection: "row", justifyContent: "space-between" },
  axisLabel: { color: C.muted, fontFamily: F.text, fontSize: 12 },
  goalTrack: { height: 12, borderRadius: 6, backgroundColor: C.stone, overflow: "hidden" },
  goalFill: { height: 12, borderRadius: 6, backgroundColor: C.asphalt },
});
