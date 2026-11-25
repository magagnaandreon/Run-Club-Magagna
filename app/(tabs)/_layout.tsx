import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
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
        tabBarLabel: ({ focused, children }) => <TabLabel focused={focused} label={children} />,
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

function TabChip({ focused, name }: { focused: boolean; name: ComponentProps<typeof Ionicons>["name"] }) {
  return <Ionicons name={name} size={22} color={focused ? C.ink : C.muted} />;
}

/** The active tab gets a short lime line under its name. */
function TabLabel({ focused, label }: { focused: boolean; label: string }) {
  return (
    <View style={styles.label}>
      <Text style={[styles.tabLabel, { color: focused ? C.ink : C.muted }, !focused && styles.tabLabelOff]}>{label}</Text>
      <View style={[styles.labelLine, focused && styles.labelLineOn]} />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.paper },
  tabBar: { paddingTop: 8, backgroundColor: C.road, borderTopColor: C.line, borderTopWidth: 1, elevation: 0 },
  tabLabel: { fontFamily: F.textBold, fontSize: 12, marginTop: 2 },
  tabLabelOff: { fontFamily: F.textSemi },
  label: { alignItems: "center", gap: 4 },
  labelLine: { width: 18, height: 3, borderRadius: 2 },
  labelLineOn: { backgroundColor: C.lime },
});
