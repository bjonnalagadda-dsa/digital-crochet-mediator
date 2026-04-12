import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { PatternProvider } from "../../hooks/PatternContext";

export default function TabsLayout() {
  return (
    <PatternProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: "#0b1220",
            borderTopColor: "rgba(255,255,255,0.08)",
          },
          tabBarActiveTintColor: "#2ec4b6",
          tabBarInactiveTintColor: "rgba(255,255,255,0.4)",
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Pattern",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="document-text-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: "Library",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="bookmarks-outline" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </PatternProvider>
  );
}
