// Polyfills must load before any Solana imports
import "react-native-get-random-values";
import "react-native-url-polyfill/auto";
import { Buffer } from "buffer";
(global as typeof globalThis & { Buffer: typeof Buffer }).Buffer = Buffer;

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { WalletProvider } from "../contexts/WalletContext";
import { ToastContainer } from "../components/Toast";

export default function RootLayout() {
  return (
    <WalletProvider>
      <StatusBar style="light" />
      <ToastContainer />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#050510" },
          headerTintColor: "#ff0",
          headerTitleStyle: { fontWeight: "bold" },
          contentStyle: { backgroundColor: "#050510" },
        }}
      >
        <Stack.Screen name="index"       options={{ headerShown: false }} />
        <Stack.Screen name="home"        options={{ title: "PROOF OF BATTLE", headerBackVisible: false }} />
        <Stack.Screen name="compete"     options={{ title: "CREATE COMPETITION" }} />
        <Stack.Screen name="leaderboard" options={{ title: "LEADERBOARD" }} />
        <Stack.Screen name="history"     options={{ title: "MY BATTLES"  }} />
      </Stack>
    </WalletProvider>
  );
}
