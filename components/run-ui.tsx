import { Ionicons } from "@expo/vector-icons";
import { useEffect, type ComponentProps, type ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming } from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";

import { useIsDesktop } from "@/hooks/use-layout";

/** "Corrida de rua": asfalto, pista e conhaque. Conhaque é a cor das ações e da voz do treinador; limão é progresso. */
export const C = {
  asphalt: "#2B2E30",
  asphaltSoft: "#3A3E41",
  road: "#F4F4EF",
  concrete: "#ECECE7",
  cone: "#8A3B1E",
  coneInk: "#5E2410",
  coneTint: "#F1DBD2",
  conePressed: "#7A3219",
  onAsphaltMuted: "#B9BCB6",
  ink: "#1E2123",
  inkSoft: "#3C4043",
  navy: "#2B2E30",
  paper: "#ECECE7",
  white: "#F4F4EF",
  stone: "#DADBD6",
  line: "#D2D3CD",
  muted: "#5D6264",
  lime: "#C9F23A",
  limeDeep: "#A8C92B",
  coral: "#8A3B1E",
  sky: "#E2E3DD",
  skyDeep: "#C4C6BF",
  sand: "#E2E3DD",
} as const;

/** Barlow Condensed for titles and numbers, Barlow for text. */
export const F = {
  display: "BarlowCondensed_800ExtraBold",
  displayBold: "BarlowCondensed_700Bold",
  displayMedium: "BarlowCondensed_600SemiBold",
  text: "Barlow_500Medium",
  textRegular: "Barlow_400Regular",
  textSemi: "Barlow_600SemiBold",
  textBold: "Barlow_700Bold",
} as const;

export const NUM: TextStyle = { fontVariant: ["tabular-nums"] };

type IconName = ComponentProps<typeof Ionicons>["name"];

/** `wide` lets multi-column screens use the full desktop width; others stay a readable single column. */
export function Screen({ children, scroll = false, wide = false, edges = ["top", "left", "right"] }: { children: ReactNode; scroll?: boolean; wide?: boolean; edges?: Edge[] }) {
  const desktop = useIsDesktop();
  const column = [styles.column, desktop && (wide ? styles.columnWide : styles.columnDesktop)];
  const body = scroll
    ? <ScrollView contentContainerStyle={[styles.scrollContent, desktop && styles.scrollContentDesktop]} showsVerticalScrollIndicator={false}><View style={column}>{children}</View></ScrollView>
    : <View style={[column, styles.fill]}>{children}</View>;
  return <SafeAreaView edges={edges} style={styles.screen}>{body}</SafeAreaView>;
}

/** A painted lane line: 22 px dashes. */
export function LaneDashes({ color = C.road, vertical = false, count = 14 }: { color?: string; vertical?: boolean; count?: number }) {
  return (
    <View style={vertical ? styles.dashesV : styles.dashesH} pointerEvents="none">
      {Array.from({ length: count }, (_, i) => <View key={i} style={[vertical ? styles.dashV : styles.dashH, { backgroundColor: color }]} />)}
    </View>
  );
}

/** Asphalt top of a screen, edge to edge, with the lane line along its bottom. */
export function RoadHeader({ eyebrow, title, subtitle, right, leading, children }: { eyebrow?: string; title: string; subtitle?: string; right?: ReactNode; leading?: ReactNode; children?: ReactNode }) {
  const desktop = useIsDesktop();
  return (
    <View style={[styles.roadHeader, desktop && styles.roadHeaderDesktop]}>
      <View style={styles.roadHeaderInner}>
        <View style={[styles.roadHeaderRow, leading ? styles.roadHeaderRowLead : null]}>
          {leading}
          <View style={[styles.headerCopy, leading ? styles.headerCopyLead : null]}>
            {eyebrow ? <Text style={styles.roadEyebrow}>{eyebrow}</Text> : null}
            <Text style={[styles.roadTitle, desktop && styles.roadTitleDesktop]}>{title}</Text>
            {subtitle ? <Text style={styles.roadSubtitle}>{subtitle}</Text> : null}
          </View>
          {right}
        </View>
        {children}
      </View>
    </View>
  );
}

/** A number on its own dark tile inside the header; `accent` paints it lime (progress). */
export function HeaderStat({ value, label, accent = false }: { value: string; label: string; accent?: boolean }) {
  return <View style={styles.headerStat}><Text style={[styles.headerStatValue, accent && styles.headerStatAccent]} numberOfLines={1}>{value}</Text><Text style={styles.headerStatLabel}>{label}</Text></View>;
}

export function HeaderStats({ children }: { children: ReactNode }) {
  return <View style={styles.headerStats}>{children}</View>;
}

/** Comes up once, staggered; stays still when the system asks for less motion. */
export function Settle({ index = 0, children, style }: { index?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    progress.value = withDelay(60 + index * 55, withTiming(1, { duration: 320, easing: Easing.out(Easing.exp) }));
  }, [index, progress, reduced]);
  const animated = useAnimatedStyle(() => ({ opacity: 0.001 + progress.value * 0.999, transform: [{ translateY: (1 - progress.value) * 14 }] }));
  return <Animated.View style={[animated, style]}>{children}</Animated.View>;
}

/** A conhaque dot that breathes: something new is waiting (a run to review). Still when motion is reduced. */
export function PulseDot({ size = 10, color = C.cone }: { size?: number; color?: string }) {
  const reduced = useReducedMotion();
  const wave = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    wave.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1, false);
  }, [reduced, wave]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.45 * (1 - wave.value), transform: [{ scale: 1 + wave.value * 1.8 }] }));
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {reduced ? null : <Animated.View style={[{ position: "absolute", width: size, height: size, borderRadius: size / 2, backgroundColor: color }, ring]} />}
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
}

/** What goes on a step's km plate: the distance, else the minutes. */
export function stepPlate(step: { distanceMeters: number | null; durationSeconds: number | null }) {
  if (step.distanceMeters) return step.distanceMeters < 1000 ? `${step.distanceMeters}m` : (step.distanceMeters / 1000).toFixed(step.distanceMeters % 1000 ? 1 : 0).replace(".", ",");
  if (step.durationSeconds) return `${Math.round(step.durationSeconds / 60)}'`;
  return "·";
}

export type RoadStepState = "done" | "now" | "next";

/** Workout steps as a timeline: one asphalt rail, a dot per step. Steps with a target pace are the hard ones (conhaque). */
export function Road({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const grow = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) grow.value = withDelay(100, withTiming(1, { duration: 1200, easing: Easing.bezier(0.3, 0.7, 0.3, 1) }));
  }, [grow, reduced]);
  const rail = useAnimatedStyle(() => ({ transform: [{ scaleY: grow.value }] }));
  return (
    <View style={styles.road}>
      <Animated.View style={[styles.roadRail, { transformOrigin: "top" }, rail]} pointerEvents="none" />
      {children}
    </View>
  );
}

/** "15'" → "15 min"; distances stay as they are ("400m", "5"). */
function plateWords(plate: string) {
  if (plate.endsWith("'")) return `${plate.slice(0, -1)} min`;
  if (/^[\d,]+$/.test(plate)) return `${plate} km`;
  return plate === "·" ? "" : plate.replace("m", " m");
}

export function RoadStep({ plate, title, detail, pace, paceUnit = "min/km", state = "next", index = 0 }: { plate: string; title: string; detail?: string; pace?: string; paceUnit?: string; state?: RoadStepState; index?: number }) {
  const hard = Boolean(pace);
  const now = state === "now";
  // When the detail already says the minutes or the distance, the plate would only repeat it.
  const words = plateWords(plate);
  const line = detail && /^\d/.test(detail) ? detail : [words, detail].filter(Boolean).join(" · ");
  return (
    <Settle index={index} style={[styles.step, state === "done" && styles.stepDone]}>
      <View style={[styles.stepDot, hard && styles.stepDotHard, now && styles.stepDotNow]} />
      <View style={styles.stepCopy}>
        <Text style={styles.stepTitle} numberOfLines={2}>{title}</Text>
        {line ? <Text style={styles.stepDetail} numberOfLines={3}>{line}</Text> : null}
      </View>
      <View style={styles.paceCell}>
        <Text style={[styles.pace, hard && styles.paceHard]}>{pace ?? "livre"}</Text>
        {pace ? <Text style={styles.paceUnit}>{paceUnit}</Text> : null}
      </View>
    </Settle>
  );
}

/** The coach's own words, on the light conhaque tint. */
export function CoachMessage({ children, label = "Recado do treinador" }: { children: ReactNode; label?: string }) {
  return (
    <View style={styles.coachMsg}>
      <View style={styles.coachMsgHead}><Ionicons name="megaphone" size={15} color={C.coneInk} /><Text style={styles.coachMsgLabel}>{label}</Text></View>
      <Text style={styles.coachMsgText}>{children}</Text>
    </View>
  );
}

export function AppMark({ inverse = false, size = 42 }: { inverse?: boolean; size?: number }) {
  const scale = size / 42;
  return (
    <View style={[styles.mark, { width: size, height: size, borderRadius: size * 0.32, backgroundColor: inverse ? C.lime : C.ink }]}>
      <View style={[styles.markArc, { width: 24 * scale, height: 24 * scale, borderRadius: 12 * scale, borderWidth: 5 * scale, borderColor: inverse ? C.ink : C.lime }]} />
      <View style={[styles.markDash, { width: 12 * scale, height: 5 * scale, right: 5 * scale, top: 12 * scale, backgroundColor: inverse ? C.ink : C.lime }]} />
    </View>
  );
}

/** Every screen's title sits on the asphalt top. */
export function AppHeader({ eyebrow, title, subtitle, right, children }: { eyebrow?: string; title: string; subtitle?: string; right?: ReactNode; children?: ReactNode }) {
  return <RoadHeader eyebrow={eyebrow} title={title} subtitle={subtitle} right={right}>{children}</RoadHeader>;
}

export function IconCircle({ name, onPress, dark = false, size = 42 }: { name: IconName; onPress?: () => void; dark?: boolean; size?: number }) {
  const inner = <Ionicons name={name} size={20} color={dark ? C.white : C.ink} />;
  if (!onPress) return <View style={[styles.iconCircle, { width: size, height: size, borderRadius: size / 2 }, dark && styles.iconCircleDark]}>{inner}</View>;
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.iconCircle, { width: size, height: size, borderRadius: size / 2 }, dark && styles.iconCircleDark, pressed && styles.pressed]}>{inner}</Pressable>;
}

export function PrimaryButton({ label, icon, onPress, dark = false, style }: { label: string; icon?: IconName; onPress: () => void; dark?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.primaryButton, dark ? styles.primaryButtonDark : styles.primaryButtonLime, style, pressed && styles.pressed]}>
      <Text style={[styles.primaryButtonText, dark && styles.primaryButtonTextDark]}>{label}</Text>
      {icon ? <Ionicons name={icon} size={19} color={dark ? C.lime : "#FFFFFF"} /> : null}
    </Pressable>
  );
}

export function SecondaryButton({ label, icon, onPress }: { label: string; icon?: IconName; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
      {icon ? <Ionicons name={icon} size={18} color={C.ink} /> : null}
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function Pill({ label, tone = "light", icon }: { label: string; tone?: "light" | "lime" | "dark" | "coral"; icon?: IconName }) {
  const toneStyle = tone === "lime" ? styles.pillLime : tone === "dark" ? styles.pillDark : tone === "coral" ? styles.pillCoral : styles.pillLight;
  const textStyle = tone === "dark" ? styles.pillTextDark : tone === "coral" ? styles.pillTextCone : styles.pillText;
  return <View style={[styles.pill, toneStyle]}>{icon ? <Ionicons name={icon} size={13} color={tone === "dark" ? C.road : tone === "coral" ? C.coneInk : C.ink} /> : null}<Text style={textStyle}>{label}</Text></View>;
}

export function SectionTitle({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  return <View style={styles.sectionTitleRow}><Text style={styles.sectionTitle}>{title}</Text>{action ? <Pressable onPress={onPress} style={({ pressed }) => [styles.textAction, pressed && styles.pressed]}><Text style={styles.textActionLabel}>{action}</Text><Ionicons name="arrow-forward" size={15} color={C.cone} /></Pressable> : null}</View>;
}

export function Metric({ value, label, reverse = false, valueStyle }: { value: string; label: string; reverse?: boolean; valueStyle?: StyleProp<TextStyle> }) {
  return <View style={styles.metric}><Text style={[styles.metricValue, reverse && styles.metricValueReverse, valueStyle]}>{value}</Text><Text style={[styles.metricLabel, reverse && styles.metricLabelReverse]}>{label}</Text></View>;
}

export function MiniBarChart({ values, highlightIndex = values.length - 1 }: { values: number[]; highlightIndex?: number }) {
  return <View style={styles.bars}>{values.map((value, index) => <View key={`${value}-${index}`} style={styles.barSlot}><View style={[styles.bar, { height: value }, index === highlightIndex ? styles.barHighlight : styles.barMuted]} /></View>)}</View>;
}

export function ProgressRing({ value, label, sublabel, size = 128 }: { value: number; label: string; sublabel: string; size?: number }) {
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - value);
  return <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}><Svg width={size} height={size} style={StyleSheet.absoluteFill}><Circle cx={size / 2} cy={size / 2} r={radius} stroke={C.stone} strokeWidth={stroke} fill="none" /><Circle cx={size / 2} cy={size / 2} r={radius} stroke={C.lime} strokeWidth={stroke} strokeLinecap="round" fill="none" strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={offset} transform={`rotate(-90 ${size / 2} ${size / 2})`} /></Svg><Text style={styles.ringLabel}>{label}</Text><Text style={styles.ringSubLabel}>{sublabel}</Text></View>;
}

export function RouteSpark({ light = false, height = 92 }: { light?: boolean; height?: number }) {
  const stroke = light ? C.lime : C.ink;
  const dot = light ? C.road : C.lime;
  return <Svg width="100%" height={height} viewBox="0 0 320 92" preserveAspectRatio="none"><Path d="M 8 72 C 48 70, 49 22, 91 26 S 130 81, 171 64 S 195 10, 230 25 S 276 80, 314 19" fill="none" stroke={stroke} strokeWidth="5" strokeLinecap="butt" strokeDasharray="14 9" /><Circle cx="9" cy="72" r="7" fill={dot} /><Circle cx="314" cy="19" r="7" fill={dot} /></Svg>;
}

export function CoachNote({ children, label = "TREINADOR" }: { children: ReactNode; label?: string }) {
  return <View style={styles.coachNote}><View style={styles.coachBadge}><Ionicons name="information" size={17} color={C.road} /></View><View style={styles.coachCopy}><Text style={styles.coachLabel}>{label}</Text><Text style={styles.coachText}>{children}</Text></View></View>;
}

export function Row({ icon, title, detail, accessory, onPress }: { icon: IconName; title: string; detail?: string; accessory?: ReactNode; onPress?: () => void }) {
  const content = <><View style={styles.rowIcon}><Ionicons name={icon} size={18} color={C.road} /></View><View style={styles.rowCopy}><Text style={styles.rowTitle}>{title}</Text>{detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}</View>{accessory ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={C.muted} /> : null)}</>;
  if (!onPress) return <View style={styles.row}>{content}</View>;
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>{content}</Pressable>;
}

export function BackButton({ onPress, label = "Voltar" }: { onPress: () => void; label?: string }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}><Ionicons name="arrow-back" size={19} color={C.ink} /><Text style={styles.backLabel}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.concrete },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 34 },
  // Keeps screens phone-shaped on wide browsers instead of stretching edge to edge.
  scrollContentDesktop: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 48 },
  column: { width: "100%", maxWidth: 720, alignSelf: "center" },
  columnDesktop: { maxWidth: 760 },
  columnWide: { maxWidth: 1112 },
  fill: { flex: 1 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },

  dashesH: { flexDirection: "row", justifyContent: "space-between", height: 4 },
  dashH: { width: 22, height: 4 },
  dashesV: { flex: 1, justifyContent: "space-between", width: 2 },
  dashV: { width: 2, height: 8 },

  roadHeader: { backgroundColor: C.asphalt, marginHorizontal: -20, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 22, marginBottom: 18 },
  roadHeaderDesktop: { marginHorizontal: 0, borderRadius: 18, paddingHorizontal: 32, paddingTop: 28, paddingBottom: 28, overflow: "hidden" },
  roadHeaderInner: { gap: 0 },
  roadHeaderRowLead: { alignItems: "center", justifyContent: "flex-start", gap: 16 },
  headerCopyLead: { flex: 1 },
  roadHeaderRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  roadEyebrow: { color: C.onAsphaltMuted, fontFamily: F.text, fontSize: 13, marginBottom: 4 },
  roadTitle: { color: C.road, fontFamily: F.display, fontSize: 34, lineHeight: 36, letterSpacing: 0.5, textTransform: "uppercase" },
  roadTitleDesktop: { fontSize: 48, lineHeight: 50 },
  roadSubtitle: { color: C.onAsphaltMuted, fontFamily: F.text, fontSize: 14, lineHeight: 20, marginTop: 6, maxWidth: 520 },
  headerStats: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 16 },
  headerStat: { flexGrow: 1, flexBasis: 90, backgroundColor: C.asphaltSoft, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, gap: 2 },
  headerStatValue: { color: C.road, fontFamily: F.displayBold, fontSize: 28, lineHeight: 30, ...NUM },
  headerStatAccent: { color: C.lime },
  headerStatLabel: { color: C.onAsphaltMuted, fontFamily: F.text, fontSize: 12 },

  road: { position: "relative", gap: 16, paddingVertical: 2 },
  roadRail: { position: "absolute", left: 6, top: 10, bottom: 10, width: 3, borderRadius: 2, backgroundColor: C.asphalt },
  step: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  stepDone: { opacity: 0.55 },
  stepDot: { width: 15, height: 15, marginTop: 3, borderRadius: 8, backgroundColor: C.road, borderWidth: 3, borderColor: "#9EA19C", zIndex: 1 },
  stepDotHard: { backgroundColor: C.cone, borderColor: C.cone },
  stepDotNow: { backgroundColor: C.lime, borderColor: C.asphalt },
  stepCopy: { flex: 1, gap: 2 },
  stepTitle: { color: C.ink, fontFamily: F.textBold, fontSize: 16, lineHeight: 20 },
  stepDetail: { color: C.muted, fontFamily: F.text, fontSize: 14, lineHeight: 19 },
  paceCell: { minWidth: 44, alignItems: "flex-end" },
  pace: { color: C.inkSoft, fontFamily: F.text, fontSize: 14, ...NUM },
  paceHard: { color: C.coneInk, fontFamily: F.textBold },
  paceUnit: { color: C.muted, fontFamily: F.text, fontSize: 11 },

  coachMsg: { borderRadius: 14, backgroundColor: C.coneTint, paddingHorizontal: 16, paddingVertical: 14, gap: 4 },
  coachMsgHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  coachMsgLabel: { color: C.coneInk, fontFamily: F.textBold, fontSize: 13 },
  coachMsgText: { color: C.coneInk, fontFamily: F.text, fontSize: 15, lineHeight: 21 },

  mark: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  markArc: { position: "absolute", left: 7, top: 9 },
  markDash: { position: "absolute", borderRadius: 2, transform: [{ rotate: "-35deg" }] },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 4, marginBottom: 22 },
  headerCopy: { flexShrink: 1 },
  eyebrow: { color: C.muted, fontFamily: F.textSemi, fontSize: 12, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 2 },
  headerTitle: { color: C.ink, fontFamily: F.display, fontSize: 34, lineHeight: 36, textTransform: "uppercase" },
  iconCircle: { alignItems: "center", justifyContent: "center", backgroundColor: C.road },
  iconCircleDark: { backgroundColor: C.asphaltSoft, borderColor: C.asphaltSoft },
  primaryButton: { minHeight: 56, paddingHorizontal: 20, borderRadius: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10 },
  primaryButtonLime: { backgroundColor: C.cone },
  primaryButtonDark: { backgroundColor: C.asphalt },
  primaryButtonText: { color: "#FFFFFF", fontFamily: F.displayBold, fontSize: 20, letterSpacing: 1.6, textTransform: "uppercase" },
  primaryButtonTextDark: { color: C.lime },
  secondaryButton: { minHeight: 52, paddingHorizontal: 18, borderRadius: 12, borderWidth: 1.5, borderColor: "#B9BCB6", backgroundColor: "transparent", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  secondaryButtonText: { color: C.ink, fontFamily: F.displayBold, fontSize: 18, letterSpacing: 0.4, textTransform: "uppercase" },
  pill: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  pillLight: { backgroundColor: C.stone },
  pillLime: { backgroundColor: C.lime },
  pillDark: { backgroundColor: C.asphalt },
  pillCoral: { backgroundColor: C.coneTint },
  pillText: { color: C.ink, fontFamily: F.displayBold, fontSize: 13, letterSpacing: 0.5, textTransform: "uppercase" },
  pillTextDark: { color: C.road, fontFamily: F.displayBold, fontSize: 13, letterSpacing: 0.5, textTransform: "uppercase" },
  pillTextCone: { color: C.coneInk, fontFamily: F.displayBold, fontSize: 13, letterSpacing: 0.5, textTransform: "uppercase" },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sectionTitle: { color: C.inkSoft, fontFamily: F.displayBold, fontSize: 17, letterSpacing: 1, textTransform: "uppercase" },
  textAction: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 6, paddingLeft: 8 },
  textActionLabel: { color: C.cone, fontFamily: F.textBold, fontSize: 14 },
  metric: { gap: 0 },
  metricValue: { color: C.ink, fontFamily: F.displayBold, fontSize: 28, lineHeight: 30, ...NUM },
  metricValueReverse: { color: C.road },
  metricLabel: { color: C.muted, fontFamily: F.text, fontSize: 12 },
  metricLabelReverse: { color: C.onAsphaltMuted },
  bars: { height: 58, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 7 },
  barSlot: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  bar: { width: "100%", maxWidth: 18, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  barHighlight: { backgroundColor: C.limeDeep },
  barMuted: { backgroundColor: C.asphalt },
  ringLabel: { color: C.ink, fontFamily: F.display, fontSize: 28, lineHeight: 30, ...NUM },
  ringSubLabel: { color: C.muted, fontFamily: F.textSemi, fontSize: 11, marginTop: 1 },
  coachNote: { flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: C.road, borderRadius: 14, padding: 16 },
  coachBadge: { width: 30, height: 30, borderRadius: 6, alignItems: "center", justifyContent: "center", backgroundColor: C.asphalt, marginTop: 1 },
  coachCopy: { flex: 1, gap: 3 },
  coachLabel: { color: C.muted, fontFamily: F.textBold, fontSize: 12, letterSpacing: 0.8, textTransform: "uppercase" },
  coachText: { color: C.inkSoft, fontFamily: F.text, fontSize: 14, lineHeight: 20 },
  row: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  rowIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.asphalt, alignItems: "center", justifyContent: "center" },
  rowCopy: { flex: 1, gap: 2 },
  rowTitle: { color: C.ink, fontFamily: F.textBold, fontSize: 15 },
  rowDetail: { color: C.muted, fontFamily: F.text, fontSize: 13 },
  backButton: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 10, paddingRight: 10, marginBottom: 14 },
  backLabel: { color: C.ink, fontFamily: F.textBold, fontSize: 15 },
});
