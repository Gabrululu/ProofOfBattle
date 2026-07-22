import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
} from "react-native";
import { useRobotHardware } from "../hooks/useRobotHardware";
import { C, MONO, SANS_900 } from "../lib/theme";

const DEFAULT_IP = "192.168.4.1"; // standard ESP32 AP gateway address

const COMMANDS: { label: string; action: string; color: string }[] = [
  { label: "⚔ ATTACK",  action: "attack",  color: C.danger  },
  { label: "🛡 DEFEND",  action: "defend",  color: C.teal    },
  { label: "⬆ ADVANCE", action: "forward", color: C.robotA  },
  { label: "⬇ RETREAT", action: "back",    color: C.waiting },
  { label: "◀ LEFT",    action: "left",    color: C.purple  },
  { label: "▶ RIGHT",   action: "right",   color: C.purple  },
];

interface Props {
  robotId: "robot_a" | "robot_b";
}

export function HardwareControlPanel({ robotId }: Props) {
  const { connected, connecting, connect, holdAction } = useRobotHardware();
  const [ip, setIp] = useState(DEFAULT_IP);

  const sideLabel = robotId === "robot_a" ? "A" : "B";

  return (
    <View style={styles.panel}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.sideBadge, { backgroundColor: robotId === "robot_a" ? C.robotA : C.robotB }]}>
            <Text style={styles.sideBadgeText}>UNIT-{sideLabel}</Text>
          </View>
          <Text style={styles.title}>HARDWARE CONTROL</Text>
        </View>
        <View style={styles.connRow}>
          <View style={[styles.connDot, { backgroundColor: connected ? C.green : C.danger }]} />
          <Text style={[styles.connText, { color: connected ? C.green : C.danger }]}>
            {connected ? "LINKED" : "OFFLINE"}
          </Text>
        </View>
      </View>

      {!connected ? (
        <View style={styles.pairBox}>
          <Text style={styles.pairHint}>
            Conectate primero a la red WiFi del robot, luego pegá su IP acá.
          </Text>
          <View style={styles.pairRow}>
            <TextInput
              style={styles.pairInput}
              value={ip}
              onChangeText={setIp}
              placeholder={DEFAULT_IP}
              placeholderTextColor={C.textDim}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="numbers-and-punctuation"
            />
            <TouchableOpacity
              style={styles.pairBtn}
              onPress={() => connect(ip.trim())}
              disabled={connecting || !ip.trim()}
              activeOpacity={0.8}
            >
              {connecting ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <Text style={styles.pairBtnText}>CONNECT</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.grid}>
          {COMMANDS.map((cmd) => (
            <TouchableOpacity
              key={cmd.action}
              style={[styles.cmdBtn, { borderColor: cmd.color }]}
              onPressIn={() => holdAction(cmd.action)}
              onPressOut={() => holdAction(null)}
              activeOpacity={0.7}
            >
              <Text style={[styles.cmdText, { color: cmd.color }]}>{cmd.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: C.bgCard,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.purple,
    padding: 16,
    gap: 12,
    shadowColor: C.purple,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  sideBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3 },
  sideBadgeText: { color: "#000", fontFamily: SANS_900, fontSize: 9, letterSpacing: 1 },
  title: { color: C.textPrimary, fontSize: 12, fontFamily: SANS_900, letterSpacing: 2 },
  connRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  connDot: { width: 6, height: 6, borderRadius: 3 },
  connText: { fontFamily: MONO, fontSize: 9, fontWeight: "800", letterSpacing: 1 },

  pairBox: { gap: 10 },
  pairHint: { fontFamily: MONO, color: C.textDim, fontSize: 10, lineHeight: 15 },
  pairRow: { flexDirection: "row", gap: 8 },
  pairInput: {
    flex: 1, backgroundColor: C.bg, borderRadius: 8, borderWidth: 1,
    borderColor: C.border, paddingVertical: 10, paddingHorizontal: 12,
    color: C.textPrimary, fontFamily: MONO, fontSize: 13,
  },
  pairBtn: {
    backgroundColor: C.purple, borderRadius: 8,
    paddingHorizontal: 18, alignItems: "center", justifyContent: "center",
  },
  pairBtnText: { fontFamily: SANS_900, color: "#fff", fontSize: 11, letterSpacing: 1 },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  cmdBtn: {
    width: "31%",
    borderWidth: 1.5,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: C.bgAccent,
  },
  cmdText: { fontFamily: MONO, fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
});
