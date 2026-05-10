import { useEffect, useRef, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, Animated, Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { RobotFace } from "../components/RobotFace";
import { C, MONO } from "../lib/theme";

const { width: W } = Dimensions.get("window");

const BOOT_LINES = [
  { delay: 0,    color: C.textDim,  text: "POBIOS v1.0  ·  PROOF OF BATTLE SYSTEMS" },
  { delay: 300,  color: C.textDim,  text: "SOLANA DEVNET  ·  9MFZtJ…MxCP" },
  { delay: 600,  color: C.teal,     text: "> LOADING VIRTUALS G.A.M.E. AGENT ... [OK]" },
  { delay: 900,  color: C.teal,     text: "> ELEVENLABS STT/TTS ONLINE ........... [OK]" },
  { delay: 1200, color: C.teal,     text: "> WEBOTS SIMULATION READY ............. [OK]" },
  { delay: 1500, color: C.green,    text: "> ALL SYSTEMS GO — ARENA ONLINE ✓" },
];

function BootLine({ text, color, delay }: { text: string; color: string; delay: number }) {
  const op = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(op, {
      toValue: 1, duration: 250, delay, useNativeDriver: true,
    }).start();
  }, []);
  return (
    <Animated.Text style={[styles.bootLine, { color, opacity: op }]}>
      {text}
    </Animated.Text>
  );
}

function GlowRing({ size, color, delay }: { size: number; color: string; delay: number }) {
  const scale = useRef(new Animated.Value(0.85)).current;
  const op    = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.08, duration: 1600, delay, useNativeDriver: true }),
          Animated.timing(op,    { toValue: 0.15, duration: 1600, delay, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 0.85, duration: 1600, useNativeDriver: true }),
          Animated.timing(op,    { toValue: 0.6,  duration: 1600, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View style={{
      position: "absolute",
      width: size, height: size, borderRadius: size / 2,
      borderWidth: 1.5, borderColor: color,
      opacity: op, transform: [{ scale }],
    }} />
  );
}

const FEATURES = [
  { icon: "⛓", label: "ON-CHAIN RECORD", color: C.purple },
  { icon: "🎙", label: "VOICE COMMANDS",  color: C.teal   },
  { icon: "🤖", label: "AI AGENT (ARES)", color: C.green  },
];

export default function LandingScreen() {
  const router   = useRouter();
  const heroOp   = useRef(new Animated.Value(0)).current;
  const heroY    = useRef(new Animated.Value(24)).current;
  const btnScale = useRef(new Animated.Value(1)).current;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroOp, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(heroY,  { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start();

    const t = setTimeout(() => setReady(true), 1700);
    return () => clearTimeout(t);
  }, []);

  const handleEnter = () => {
    Animated.sequence([
      Animated.timing(btnScale, { toValue: 0.93, duration: 80, useNativeDriver: true }),
      Animated.timing(btnScale, { toValue: 1,    duration: 80, useNativeDriver: true }),
    ]).start(() => router.replace("/home"));
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        {/* Robot hero with glow rings */}
        <Animated.View style={[styles.heroWrap, { opacity: heroOp, transform: [{ translateY: heroY }] }]}>
          <GlowRing size={200} color={C.purple} delay={0}   />
          <GlowRing size={260} color={C.teal}   delay={400} />
          <GlowRing size={320} color={C.green}  delay={800} />
          <RobotFace size={120} primaryColor={C.purple} accentColor={C.green} animated />
        </Animated.View>

        {/* Title */}
        <Animated.View style={[styles.titleBlock, { opacity: heroOp, transform: [{ translateY: heroY }] }]}>
          <Text style={styles.title}>PROOF{"\n"}OF BATTLE</Text>
          <Text style={styles.tagline}>Robot combat · On-chain truth · AI at the wheel</Text>
        </Animated.View>

        {/* Feature pills */}
        <View style={styles.features}>
          {FEATURES.map((f) => (
            <View key={f.label} style={[styles.pill, { borderColor: f.color + "55" }]}>
              <Text style={styles.pillIcon}>{f.icon}</Text>
              <Text style={[styles.pillLabel, { color: f.color }]}>{f.label}</Text>
            </View>
          ))}
        </View>

        {/* Terminal boot */}
        <View style={styles.terminal}>
          {BOOT_LINES.map((l) => (
            <BootLine key={l.text} {...l} />
          ))}
        </View>

        {/* CTA */}
        <Animated.View style={{ transform: [{ scale: btnScale }], width: "100%" }}>
          <TouchableOpacity
            style={[styles.enterBtn, !ready && styles.enterBtnDim]}
            onPress={handleEnter}
            disabled={!ready}
            activeOpacity={0.85}
          >
            <Text style={styles.enterBtnText}>
              {ready ? "ENTER ARENA →" : "INITIALIZING…"}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Network badge */}
        <View style={styles.netRow}>
          <View style={styles.netDot} />
          <Text style={styles.netLabel}>SOLANA DEVNET</Text>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: C.bg },
  container: {
    flex: 1,
    alignItems:     "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 24,
  },

  // Hero
  heroWrap: {
    width: 320, height: 320,
    alignItems: "center", justifyContent: "center",
  },

  // Title
  titleBlock: { alignItems: "center", gap: 10 },
  title: {
    color:      C.textPrimary,
    fontSize:   44,
    fontWeight: "900",
    textAlign:  "center",
    letterSpacing: 10,
    lineHeight:    50,
  },
  tagline: {
    fontFamily: MONO,
    color:      C.textSecondary,
    fontSize:   11,
    letterSpacing: 1,
    textAlign:  "center",
  },

  // Features
  features: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 },
  pill: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           6,
    borderWidth:   1,
    borderRadius:  20,
    paddingVertical:   5,
    paddingHorizontal: 12,
    backgroundColor:   "#0C0C1A",
  },
  pillIcon:  { fontSize: 12 },
  pillLabel: { fontFamily: MONO, fontSize: 9, fontWeight: "800", letterSpacing: 1 },

  // Terminal
  terminal: {
    width:           "100%",
    backgroundColor: C.bgCard,
    borderRadius:    8,
    borderWidth:     1,
    borderColor:     C.border,
    borderLeftWidth: 2,
    borderLeftColor: C.green,
    padding:         12,
    gap:             3,
  },
  bootLine: { fontFamily: MONO, fontSize: 9.5, letterSpacing: 0.3 },

  // CTA
  enterBtn: {
    backgroundColor: C.purple,
    borderRadius:    14,
    paddingVertical: 18,
    alignItems:      "center",
    shadowColor:     C.purple,
    shadowOpacity:   0.5,
    shadowRadius:    16,
    elevation:       8,
  },
  enterBtnDim: { backgroundColor: "#2A1A4A", shadowOpacity: 0 },
  enterBtnText: {
    color:      "#fff",
    fontWeight: "900",
    fontSize:   16,
    letterSpacing: 4,
  },

  // Network
  netRow:  { flexDirection: "row", alignItems: "center", gap: 6 },
  netDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green },
  netLabel:{ fontFamily: MONO, color: C.textDim, fontSize: 9, letterSpacing: 3 },
});
