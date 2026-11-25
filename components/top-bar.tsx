import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { formatKm } from "@/components/dashboard-ui";
import { ProfileAvatar } from "@/components/profile-avatar";
import { AppMark, C, F, LaneDashes, NUM } from "@/components/run-ui";
import { useAuth } from "@/hooks/use-auth";
import { useInsights } from "@/hooks/use-insights";
import { trpc } from "@/lib/trpc";

/**
 * The dark app bar: brand, this week's summary and the profile photo. On desktop it is the tab bar
 * (pass the tab props and the tabs show as pills); on phones it is the screen header and the tabs stay
 * at the bottom. It shares the dashboard's insights query (same period and day), so it adds no Strava reads.
 */
export function TopBar({ tabs }: { tabs?: BottomTabBarProps }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const profile = trpc.account.profile.useQuery(undefined, { enabled: Boolean(user) });
  const insights = useInsights(Boolean(user));
  const week = insights.data?.week;
  const name = profile.data?.name || user?.name || "";

  return (
    <View style={[styles.bar, { paddingTop: insets.top }]}>
      <View style={[styles.inner, !tabs && styles.innerPhone]}>
        <Pressable onPress={() => router.navigate("/(tabs)")} style={styles.brand} accessibilityRole="link" accessibilityLabel="Run Club Magagna, início">
          <AppMark inverse size={tabs ? 32 : 30} />
          {tabs || width >= 430 ? <Text style={styles.brandText}>Run Club <Text style={styles.brandAccent}>Magagna</Text></Text> : null}
        </Pressable>

        {tabs ? <TabPills {...tabs} /> : null}

        <View style={styles.right}>
          {week ? (
            <>
              <View style={styles.chip}>
                <Text style={styles.chipMuted}>Semana</Text>
                <Text style={styles.chipStrong}>{formatKm(week.distanceMeters)} km</Text>
              </View>
              <View style={styles.chip}>
                <Ionicons name="flame" size={14} color={C.lime} />
                <Text style={[styles.chipStrong, styles.chipLime]}>{week.streakDays}</Text>
              </View>
            </>
          ) : null}
          <Pressable onPress={() => router.navigate("/(tabs)/profile")} accessibilityLabel="Abrir perfil" style={({ pressed }) => pressed && styles.pressed}>
            <ProfileAvatar uri={profile.data?.avatarUrl} name={name} size={34} />
          </Pressable>
        </View>
      </View>
      {tabs ? null : <View style={styles.lane}><LaneDashes count={Math.max(8, Math.floor(width / 36))} color={C.asphaltSoft} /></View>}
    </View>
  );
}

const ATHLETE_ROUTE = "aluno/[id]";

function TabPills({ state, descriptors, navigation }: BottomTabBarProps) {
  const currentRoute = state.routes[state.index];
  // The athlete sheet has no pill of its own: it belongs to the Alunos tab.
  const activeName = currentRoute.name === ATHLETE_ROUTE ? "club" : currentRoute.name;
  return (
    <View style={styles.nav}>
      {state.routes.filter((route) => route.name !== ATHLETE_ROUTE).map((route) => {
        const { options } = descriptors[route.key];
        const focused = route.name === activeName;
        const color = focused ? C.road : C.onAsphaltMuted;
        const onPress = () => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (route.key !== currentRoute.key && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        };
        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            style={({ hovered }) => [styles.tab, !focused && hovered && styles.tabHover]}
          >
            <Text style={[styles.tabLabel, { color }]}>{options.title ?? route.name}</Text>
            {focused ? <View style={styles.tabLine} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.75 },
  bar: { backgroundColor: C.asphalt },
  lane: { height: 4, overflow: "hidden", paddingHorizontal: 16 },
  inner: { width: "100%", maxWidth: 1160, alignSelf: "center", height: 64, paddingHorizontal: 24, flexDirection: "row", alignItems: "center", gap: 28 },
  innerPhone: { height: 58, paddingHorizontal: 16, gap: 10 },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandText: { color: C.road, fontFamily: F.display, fontSize: 18, letterSpacing: 0.7, textTransform: "uppercase" },
  brandAccent: { color: C.lime },
  nav: { flexDirection: "row", alignItems: "stretch", alignSelf: "stretch", gap: 2 },
  tab: { justifyContent: "center", paddingHorizontal: 14, borderRadius: 4 },
  tabHover: { backgroundColor: C.asphaltSoft },
  tabLabel: { fontFamily: F.displayBold, fontSize: 17, letterSpacing: 0.6, textTransform: "uppercase" },
  tabLine: { position: "absolute", left: 10, right: 10, bottom: 0, height: 4, backgroundColor: C.lime },
  right: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, height: 32, borderRadius: 4, backgroundColor: C.asphaltSoft },
  chipMuted: { color: C.onAsphaltMuted, fontFamily: F.textSemi, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  chipStrong: { color: C.road, fontFamily: F.displayBold, fontSize: 17, ...NUM },
  chipLime: { color: C.lime },
});
