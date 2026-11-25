import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { C, F } from "@/components/run-ui";
import { TopBar } from "@/components/top-bar";
import { HapticTab } from "@/components/haptic-tab";
import { useAuth } from "@/hooks/use-auth";
import { useIsDesktop } from "@/hooks/use-layout";
import { trpc } from "@/lib/trpc";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { user, loading } = useAuth();
  const desktop = useIsDesktop();
  const athleteStatus = trpc.account.status.useQuery(undefined, { enabled: Boolean(user) && user?.role !== "admin" });
  const bottomPadding = Platform.OS === "web" ? 11 : Math.max(insets.bottom, 8);
  const tabBarHeight = 68 + bottomPadding;

  // A refetch must not unmount the tabs of an approved athlete: that would reset the navigation to Hoje.
  const checkingStatus = athleteStatus.isFetching && athleteStatus.data?.status !== "approved";
  if (loading || (user && user.role !== "admin" && checkingStatus)) return <View style={styles.loading}><ActivityIndicator size="large" color={C.ink} /></View>;
  if (!user) return <Redirect href="/login" />;
  if (user.role !== "admin" && athleteStatus.data?.status !== "approved") {
    if (athleteStatus.data?.status === "pending") return <Redirect href={{ pathname: "/pending", params: { email: user.email ?? "" } }} />;
    const reason = athleteStatus.data?.status === "rejected" ? "rejected" : "not-athlete";
    return <Redirect href={{ pathname: "/login", params: { reason } }} />;
  }

  return (
    <Tabs
      backBehavior="history"
      tabBar={desktop ? (props) => <TopBar tabs={props} /> : undefined}
      screenOptions={{
        // Phones keep the tabs at the bottom and show the same dark bar as the screen header.
        headerShown: !desktop,
        header: () => <TopBar />,
        tabBarPosition: desktop ? "top" : "bottom",
        tabBarButton: HapticTab,
        tabBarActiveTintColor: C.ink,
        tabBarInactiveTintColor: C.muted,
        tabBarLabelPosition: "below-icon",
        tabBarStyle: [styles.tabBar, { height: tabBarHeight, paddingBottom: bottomPadding }],
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Hoje", tabBarIcon: ({ focused }) => <TabChip focused={focused} name={focused ? "home" : "home-outline"} /> }} />
      <Tabs.Screen name="progress" options={{ title: "Dados", tabBarIcon: ({ focused }) => <TabChip focused={focused} name={focused ? "analytics" : "analytics-outline"} /> }} />
      <Tabs.Screen name="map" options={{ title: "Mapa", tabBarIcon: ({ focused }) => <TabChip focused={focused} name={focused ? "earth" : "earth-outline"} /> }} />
      <Tabs.Screen name="plans" options={{ title: "Planos", tabBarIcon: ({ focused }) => <TabChip focused={focused} name={focused ? "map" : "map-outline"} /> }} />
      <Tabs.Screen name="club" options={{ title: user.role === "admin" ? "Alunos" : "Clube", tabBarIcon: ({ focused }) => <TabChip focused={focused} name={focused ? "people" : "people-outline"} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Perfil", tabBarIcon: ({ focused }) => <TabChip focused={focused} name={focused ? "person" : "person-outline"} /> }} />
      {/* The athlete sheet stays inside the tabs, so the navigation bar remains on screen. */}
      <Tabs.Screen name="aluno/[id]" options={{ href: null }} />
    </Tabs>
  );
}

/** The active tab is a patch of asphalt with a lime lane line under it. */
function TabChip({ focused, name }: { focused: boolean; name: ComponentProps<typeof Ionicons>["name"] }) {
  return <View style={[styles.chip, focused && styles.chipOn]}><Ionicons name={name} size={20} color={focused ? C.road : C.muted} />{focused ? <View style={styles.chipLine} /> : null}</View>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.paper },
  tabBar: { paddingTop: 8, backgroundColor: C.road, borderTopColor: C.line, borderTopWidth: 1, elevation: 0 },
  tabLabel: { fontFamily: F.textBold, fontSize: 11, marginTop: 2 },
  chip: { width: 46, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  chipOn: { backgroundColor: C.asphalt },
  chipLine: { position: "absolute", left: 0, right: 0, bottom: 0, height: 4, backgroundColor: C.lime },
});
