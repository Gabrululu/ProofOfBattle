import { useState, useRef, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Animated, Alert,
} from "react-native";
import { Audio } from "expo-av";
import { useSeekerWs } from "../hooks/useSeekerWs";
import { C, MONO } from "../lib/theme";

const COMMANDS: { label: string; text: string; color: string }[] = [
  { label: "⚔ ATTACK",   text: "attack the enemy with maximum force",         color: C.danger  },
  { label: "🛡 DEFEND",   text: "defend and block incoming attacks",            color: C.teal    },
  { label: "⬆ ADVANCE",  text: "advance aggressively towards the enemy",       color: C.robotA  },
  { label: "⬇ RETREAT",  text: "retreat and create distance from the enemy",   color: C.waiting },
  { label: "🌀 SPIN",     text: "spin attack, rotating ram at full speed",      color: C.purple  },
  { label: "⚡ CHARGE",   text: "full speed charge ram attack at the enemy",    color: C.robotB  },
];

interface Props {
  arenaId: number;
  robotId: "robot_a" | "robot_b";
  myHp: number;
  enemyHp: number;
}

export function CommandPanel({ arenaId, robotId, myHp, enemyHp }: Props) {
  const { connected, lastAction, sendText, sendAudio } = useSeekerWs(arenaId, robotId);
  const [recording, setRecording] = useState(false);
  const [pending, setPending] = useState(false);
  const recRef = useRef<Audio.Recording | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const startPulse = () =>
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 400, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 400, useNativeDriver: true }),
      ])
    ).start();

  const stopPulse = () => {
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  };

  const handleCommand = useCallback((text: string) => {
    if (!connected) {
      Alert.alert("Not connected", "Bridge not reachable — check network.");
      return;
    }
    sendText(text);
    setPending(true);
    setTimeout(() => setPending(false), 3000);
  }, [connected, sendText]);

  const startRecording = useCallback(async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) { Alert.alert("Mic permission required"); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      recRef.current = rec;
      setRecording(true);
      startPulse();
    } catch (e) {
      Alert.alert("Recording error", String(e));
    }
  }, []);

  const stopRecording = useCallback(async () => {
    stopPulse();
    setRecording(false);
    const rec = recRef.current;
    if (!rec) return;
    recRef.current = null;
    try {
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      if (!uri) return;
      // Read audio file as base64 without expo-file-system
      const response = await fetch(uri);
      const ab = await response.arrayBuffer();
      const base64 = Buffer.from(ab).toString("base64");
      sendAudio(base64);
      setPending(true);
      setTimeout(() => setPending(false), 4000);
    } catch (e) {
      Alert.alert("Voice error", String(e));
    }
  }, [sendAudio]);

  const sideLabel = robotId === "robot_a" ? "A" : "B";

  return (
    <View style={styles.panel}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.sideBadge, { backgroundColor: robotId === "robot_a" ? C.robotA : C.robotB }]}>
            <Text style={styles.sideBadgeText}>UNIT-{sideLabel}</Text>
          </View>
          <Text style={styles.title}>COMMAND MODE</Text>
        </View>
        <View style={styles.connRow}>
          <View style={[styles.connDot, { backgroundColor: connected ? C.green : C.danger }]} />
          <Text style={[styles.connText, { color: connected ? C.green : C.danger }]}>
            {connected ? "LIVE" : "OFFLINE"}
          </Text>
        </View>
      </View>

      {/* HP strip */}
      <View style={styles.hpStrip}>
        <View style={styles.hpBlock}>
          <Text style={[styles.hpValue, { color: robotId === "robot_a" ? C.robotA : C.robotB }]}>
            {myHp}
          </Text>
          <Text style={styles.hpLabel}>MY HP</Text>
        </View>
        <View style={styles.hpDivider} />
        <View style={styles.hpBlock}>
          <Text style={[styles.hpValue, { color: C.textDim }]}>{enemyHp}</Text>
          <Text style={styles.hpLabel}>ENEMY HP</Text>
        </View>
      </View>

      {/* Action log */}
      <View style={styles.logBox}>
        {pending ? (
          <View style={styles.logRow}>
            <ActivityIndicator size="small" color={C.green} />
            <Text style={styles.logText}>Sending to AI agent…</Text>
          </View>
        ) : lastAction ? (
          <View style={styles.logRow}>
            <Text style={styles.logPrompt}>{">"}</Text>
            <Text style={styles.logText} numberOfLines={2}>
              {lastAction.action?.toString().toUpperCase()} · "{lastAction.command}"
            </Text>
          </View>
        ) : (
          <Text style={styles.logIdle}>{">"} AWAITING COMMANDS…</Text>
        )}
      </View>

      {/* Command grid */}
      <View style={styles.grid}>
        {COMMANDS.map((cmd) => (
          <TouchableOpacity
            key={cmd.label}
            style={[styles.cmdBtn, { borderColor: cmd.color }]}
            onPress={() => handleCommand(cmd.text)}
            disabled={pending || !connected}
            activeOpacity={0.7}
          >
            <Text style={[styles.cmdText, { color: cmd.color }]}>{cmd.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Voice button */}
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <TouchableOpacity
          style={[styles.voiceBtn, recording && styles.voiceBtnActive]}
          onPressIn={startRecording}
          onPressOut={stopRecording}
          activeOpacity={0.8}
        >
          <Text style={styles.voiceIcon}>{recording ? "🔴" : "🎙"}</Text>
          <Text style={styles.voiceText}>
            {recording ? "RECORDING… RELEASE TO SEND" : "HOLD TO SPEAK"}
          </Text>
        </TouchableOpacity>
      </Animated.View>
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
  sideBadgeText: { color: "#000", fontWeight: "900", fontSize: 9, letterSpacing: 1 },
  title: { color: C.textPrimary, fontSize: 12, fontWeight: "900", letterSpacing: 2 },
  connRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  connDot: { width: 6, height: 6, borderRadius: 3 },
  connText: { fontFamily: MONO, fontSize: 9, fontWeight: "800", letterSpacing: 1 },

  hpStrip: {
    flexDirection: "row",
    backgroundColor: "#050510",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
  },
  hpBlock: { flex: 1, alignItems: "center", gap: 2 },
  hpDivider: { width: 1, height: 28, backgroundColor: C.border },
  hpValue: { fontFamily: MONO, fontSize: 22, fontWeight: "900" },
  hpLabel: { fontFamily: MONO, color: C.textDim, fontSize: 8, letterSpacing: 2 },

  logBox: {
    backgroundColor: "#050510",
    borderRadius: 8,
    padding: 10,
    minHeight: 36,
    justifyContent: "center",
  },
  logRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  logPrompt: { fontFamily: MONO, color: C.green, fontSize: 12 },
  logText: { fontFamily: MONO, color: C.textSecondary, fontSize: 11, flex: 1 },
  logIdle: { fontFamily: MONO, color: C.textDim, fontSize: 11 },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  cmdBtn: {
    width: "31%",
    borderWidth: 1.5,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: C.bgAccent,
  },
  cmdText: { fontFamily: MONO, fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },

  voiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: C.bgAccent,
    borderRadius: 10,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  voiceBtnActive: {
    backgroundColor: "#1a0010",
    borderColor: C.danger,
    shadowColor: C.danger,
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 5,
  },
  voiceIcon: { fontSize: 20 },
  voiceText: { fontFamily: MONO, color: C.textSecondary, fontSize: 10, letterSpacing: 1 },
});
