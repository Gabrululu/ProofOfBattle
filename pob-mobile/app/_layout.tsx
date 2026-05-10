// Polyfills must load before any Solana imports
import "react-native-get-random-values";
import "react-native-url-polyfill/auto";
import { Buffer } from "buffer";
(global as typeof globalThis & { Buffer: typeof Buffer }).Buffer = Buffer;

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#050510" },
          headerTintColor: "#ff0",
          headerTitleStyle: { fontWeight: "bold" },
          contentStyle: { backgroundColor: "#050510" },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
