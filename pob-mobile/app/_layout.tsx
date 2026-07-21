// Polyfills must load before any Solana imports
import "react-native-get-random-values";
import "react-native-url-polyfill/auto";
import { Buffer } from "buffer";
(global as typeof globalThis & { Buffer: typeof Buffer }).Buffer = Buffer;

import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts, Inter_700Bold, Inter_900Black } from "@expo-google-fonts/inter";
import {
  JetBrainsMono_600SemiBold,
  JetBrainsMono_700Bold,
} from "@expo-google-fonts/jetbrains-mono";
import { WalletProvider } from "../contexts/WalletContext";
import { ToastContainer } from "../components/Toast";
import { C } from "../lib/theme";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_700Bold,
    Inter_900Black,
    JetBrainsMono_600SemiBold,
    JetBrainsMono_700Bold,
  });

  // Screens (index/home/robot/...) are lazily required by expo-router the
  // first time they're navigated to — holding the Stack back until fonts
  // resolve means none of their StyleSheet.create() calls run before the
  // custom fonts (referenced by name in lib/theme.ts) are registered.
  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  }

  return (
    <SafeAreaProvider>
      <WalletProvider>
        <StatusBar style="light" />
        <ToastContainer />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: C.bg },
            headerTintColor: C.purple,
            headerTitleStyle: { fontWeight: "bold" },
            contentStyle: { backgroundColor: C.bg },
          }}
        >
          <Stack.Screen name="index"       options={{ headerShown: false }} />
          <Stack.Screen name="home"        options={{ title: "PROOF OF BATTLE", headerBackVisible: false }} />
          <Stack.Screen name="compete"     options={{ title: "CREATE COMPETITION" }} />
          <Stack.Screen name="leaderboard" options={{ title: "LEADERBOARD" }} />
          <Stack.Screen name="history"     options={{ title: "MY BATTLES"  }} />
          <Stack.Screen name="resources"   options={{ title: "BUILDER RESOURCES" }} />
        </Stack>
      </WalletProvider>
    </SafeAreaProvider>
  );
}
