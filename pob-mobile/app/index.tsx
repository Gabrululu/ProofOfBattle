import { useEffect, useRef, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, ScrollView,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Href } from "expo-router";
import { C, MONO, SANS_900 } from "../lib/theme";

const BOOT_DURATION = 2200;
const BLOCKS = 12;

const BOOT_LINES = [
  { delay: 0,    color: C.textDim,  text: "POBIOS v1.0  ·  PROOF OF BATTLE SYSTEMS" },
  { delay: 300,  color: C.textDim,  text: "SOLANA DEVNET  ·  9MFZtJ…MxCP" },
  { delay: 600,  color: C.teal,     text: "> LOADING VIRTUALS G.A.M.E. AGENT ... [OK]" },
  { delay: 900,  color: C.teal,     text: "> ELEVENLABS STT/TTS ONLINE ........... [OK]" },
  { delay: 1200, color: C.teal,     text: "> WEBOTS SIMULATION READY ............. [OK]" },
  { delay: 1500, color: C.green,    text: "> ALL SYSTEMS GO — ARENA ONLINE ✓" },
];

const FEATURES = [
  { icon: "⛓", label: "ON-CHAIN RECORD", color: C.purple },
  { icon: "🎙", label: "VOICE COMMANDS",  color: C.teal   },
  { icon: "🤖", label: "AI AGENT (ARES)", color: C.green  },
];

// ── Phase 1: boot screen (mirrors the web's LoadingScreen) ───────────────────

function BootScreen({ progress }: { progress: number }) {
  const filled = Math.round((progress / 100) * BLOCKS);
  return (
    <View style={boot.wrap}>
      <View style={boot.tether} />
      <Text style={boot.mark}>⌬PB</Text>
      <Text style={boot.title}>PROOF OF BATTLE{"\n"}IS INITIALIZING</Text>

      <View style={boot.blocksRow}>
        {Array.from({ length: BLOCKS }).map((_, i) => (
          <View
            key={i}
            style={[
              boot.block,
              i < filled && boot.blockFilled,
            ]}
          />
        ))}
      </View>
      <Text style={boot.pct}>▲ {progress}%</Text>

      <Text style={boot.caption}>BOOTING ARENA SYSTEMS…</Text>
    </View>
  );
}

// ── Phase 2: landing hero (mirrors the web's marketing hero) ─────────────────

function BootLine({ text, color, delay }: { text: string; color: string; delay: number }) {
  const op = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(op, { toValue: 1, duration: 250, delay, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.Text
      style={[landing.bootLine, { color, opacity: op }]}
      numberOfLines={1}
      ellipsizeMode="tail"
    >
      {text}
    </Animated.Text>
  );
}

export default function LandingScreen() {
  const router   = useRouter();
  const [progress, setProgress] = useState(0);
  const [phase, setPhase]       = useState<"boot" | "landing">("boot");
  const [ready, setReady]       = useState(false);

  const heroOp   = useRef(new Animated.Value(0)).current;
  const heroY    = useRef(new Animated.Value(16)).current;
  const btnScale = useRef(new Animated.Value(1)).current;

  // Drive the boot progress bar, then hand off to the landing hero.
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const p = Math.min(100, Math.round(((Date.now() - start) / BOOT_DURATION) * 100));
      setProgress(p);
      if (p >= 100) {
        clearInterval(id);
        setTimeout(() => setPhase("landing"), 300);
      }
    }, 60);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (phase !== "landing") return;
    Animated.parallel([
      Animated.timing(heroOp, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(heroY,  { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => setReady(true), 500);
    return () => clearTimeout(t);
  }, [phase]);

  const handleEnter = () => {
    Animated.sequence([
      Animated.timing(btnScale, { toValue: 0.93, duration: 80, useNativeDriver: true }),
      Animated.timing(btnScale, { toValue: 1,    duration: 80, useNativeDriver: true }),
    ]).start(() => router.replace("/home" as Href));
  };

  if (phase === "boot") {
    return (
      <SafeAreaView style={landing.safe}>
        <BootScreen progress={progress} />
      </SafeAreaView>
    );
  }

  return (
    <View style={landing.bg}>
      <Image
        source={require("../assets/ares-mecha.jpg")}
        contentFit="cover"
        style={landing.bgImage}
      />
      <View style={landing.scrim} />
      <SafeAreaView style={landing.safeOverlay}>
        <ScrollView
          contentContainerStyle={landing.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Title */}
          <Animated.View style={[landing.titleBlock, { opacity: heroOp, transform: [{ translateY: heroY }] }]}>
            <Text style={landing.titleLine1}>PROOF OF</Text>
            <Text style={landing.titleLine2}>BATTLE</Text>
            <Text style={landing.tagline}>Robot combat · On-chain truth · AI at the wheel</Text>
          </Animated.View>

          {/* Feature pills */}
          <Animated.View style={[landing.features, { opacity: heroOp }]}>
            {FEATURES.map((f) => (
              <View key={f.label} style={[landing.pill, { borderColor: f.color + "55" }]}>
                <Text style={landing.pillIcon}>{f.icon}</Text>
                <Text style={[landing.pillLabel, { color: f.color }]}>{f.label}</Text>
              </View>
            ))}
          </Animated.View>

          {/* Terminal boot log */}
          <Animated.View style={[landing.terminal, { opacity: heroOp }]}>
            {BOOT_LINES.map((l) => (
              <BootLine key={l.text} {...l} />
            ))}
          </Animated.View>

          {/* Spacer pushes CTA down on tall screens, without ever clipping it */}
          <View style={{ flex: 1, minHeight: 12 }} />

          {/* CTA */}
          <Animated.View style={{ transform: [{ scale: btnScale }], width: "100%" }}>
            <TouchableOpacity
              style={[landing.enterBtn, !ready && landing.enterBtnDim]}
              onPress={handleEnter}
              disabled={!ready}
              activeOpacity={0.85}
            >
              <Text style={landing.enterBtnText}>
                {ready ? "ENTER ARENA →" : "LOADING…"}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Network badge */}
          <View style={landing.netRow}>
            <View style={landing.netDot} />
            <Text style={landing.netLabel}>SOLANA DEVNET</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ── Boot screen styles ────────────────────────────────────────────────────────

const boot = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 20,
  },
  tether: { width: 1, height: 40, backgroundColor: C.purple + "b0" },
  mark: {
    fontFamily: MONO, color: C.purple, fontSize: 22, fontWeight: "900",
    marginTop: -8,
    textShadowColor: C.purple, textShadowRadius: 12, textShadowOffset: { width: 0, height: 0 },
  },
  title: {
    fontFamily: SANS_900, color: C.purple, fontSize: 30, textAlign: "center",
    letterSpacing: 1, lineHeight: 34, textTransform: "uppercase",
    textShadowColor: C.purple, textShadowRadius: 18, textShadowOffset: { width: 0, height: 0 },
  },
  blocksRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 4, maxWidth: 280 },
  block: {
    width: 16, height: 16, borderWidth: 1, borderColor: C.purple,
  },
  blockFilled: {
    backgroundColor: C.purple,
    shadowColor: C.purple, shadowOpacity: 0.7, shadowRadius: 6, elevation: 4,
  },
  pct: { fontFamily: MONO, color: C.purple, fontSize: 12, letterSpacing: 1 },
  caption: { fontFamily: MONO, color: C.purple + "cc", fontSize: 10, letterSpacing: 3, position: "absolute", bottom: 24 },
});

// ── Landing hero styles ───────────────────────────────────────────────────────

const landing = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  bg:   { flex: 1, overflow: "hidden", position: "relative" },
  bgImage: { flex: 1, width: "100%", height: "100%" },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(4,6,15,0.42)" },
  safeOverlay: { ...StyleSheet.absoluteFillObject, flex: 1 },

  scroll: {
    flexGrow: 1,
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 20,
    gap: 20,
  },

  // Title
  titleBlock: { alignItems: "center", gap: 10 },
  titleLine1: {
    color: C.textPrimary, fontSize: 40, fontFamily: SANS_900,
    textAlign: "center", letterSpacing: 4, lineHeight: 44, textTransform: "uppercase",
  },
  titleLine2: {
    color: C.purple, fontSize: 46, fontFamily: SANS_900,
    textAlign: "center", letterSpacing: 4, lineHeight: 50, textTransform: "uppercase",
    textShadowColor: C.purple + "80", textShadowRadius: 20, textShadowOffset: { width: 0, height: 0 },
  },
  tagline: {
    fontFamily: MONO, color: C.textSecondary, fontSize: 11,
    letterSpacing: 1, textAlign: "center", marginTop: 4,
  },

  // Features
  features: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 },
  pill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1, borderRadius: 20,
    paddingVertical: 5, paddingHorizontal: 12,
    backgroundColor: "rgba(11,17,36,0.85)",
  },
  pillIcon:  { fontSize: 12 },
  pillLabel: { fontFamily: MONO, fontSize: 9, fontWeight: "800", letterSpacing: 1 },

  // Terminal
  terminal: {
    width: "100%",
    backgroundColor: "rgba(11,17,36,0.85)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    borderLeftWidth: 2,
    borderLeftColor: C.green,
    padding: 12,
    gap: 3,
    overflow: "hidden",
  },
  bootLine: { fontFamily: MONO, fontSize: 9.5, letterSpacing: 0.3 },

  // CTA
  enterBtn: {
    backgroundColor: C.purple,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
    shadowColor: C.purple,
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  enterBtnDim: { backgroundColor: C.bgAccent, shadowOpacity: 0 },
  enterBtnText: {
    color: "#fff", fontFamily: SANS_900, fontSize: 16, letterSpacing: 4,
  },

  // Network
  netRow:   { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  netDot:   { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green },
  netLabel: { fontFamily: MONO, color: C.textDim, fontSize: 9, letterSpacing: 3 },
});
