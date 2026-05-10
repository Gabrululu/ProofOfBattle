import { useRef, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, Animated, ActivityIndicator,
} from "react-native";
import { useRouter, Href } from "expo-router";
import { RobotFace }  from "../components/RobotFace";
import { WalletButton } from "../components/WalletButton";
import { useWallet }  from "../hooks/useWallet";
import { useRobot }   from "../hooks/useRobot";
import { C, MONO }    from "../lib/theme";

const BATTLES = [
  { id: 1, sublabel: "Arena Alpha", status: "ACTIVE"  as const },
  { id: 2, sublabel: "Beta Ring",   status: "WAITING" as const },
];

function PulsingDot({ color }: { color: string }) {
  const op = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(op, { toValue: 0.2, duration: 550, useNativeDriver: true }),
        Animated.timing(op, { toValue: 1,   duration: 550, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={{
      width: 6, height: 6, borderRadius: 3,
      backgroundColor: color, opacity: op,
      shadowColor: color, shadowOpacity: 0.9, shadowRadius: 4,
    }} />
  );
}

function TerminalBoot() {
  const op = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(op, { toValue: 1, duration: 600, delay: 200, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={[styles.terminal, { opacity: op }]}>
      <Text style={styles.termLine}>
        <Text style={{ color: C.textDim }}>POBIOS v1.0 © 2025 PROOF OF BATTLE</Text>
      </Text>
      <Text style={styles.termLine}>
        <Text style={{ color: C.textDim }}>SOLANA DEVNET  ·  PROGRAM: </Text>
        <Text style={{ color: C.teal }}>7xStH3…ZG2S</Text>
      </Text>
      <Text style={[styles.termLine, { marginTop: 4 }]}>
        <Text style={{ color: C.green }}>{">"} </Text>
        <Text style={{ color: C.textSecondary }}>ARENA ONLINE  </Text>
        <Text style={{ color: C.green }}>[OK]</Text>
      </Text>
    </Animated.View>
  );
}

function MyRobotSection() {
  const router = useRouter();
  const { publicKey, connect, disconnect, connecting, isWebPreview } = useWallet();
  const { robot, loading } = useRobot(publicKey);

  return (
    <View style={styles.myRobotSection}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>MY ROBOT</Text>
        <View style={styles.sectionLine} />
      </View>

      {!publicKey ? (
        <View style={styles.myRobotCard}>
          <Text style={styles.myRobotHint}>Connect wallet to register your robot</Text>
          <WalletButton
            publicKey={publicKey}
            connecting={connecting}
            isWebPreview={isWebPreview}
            onConnect={connect}
            onDisconnect={disconnect}
          />
        </View>
      ) : loading ? (
        <View style={styles.myRobotCard}>
          <ActivityIndicator color={C.purple} />
        </View>
      ) : robot ? (
        <TouchableOpacity
          style={[styles.myRobotCard, styles.myRobotCardActive]}
          onPress={() => router.push("/robot" as Href)}
          activeOpacity={0.8}
        >
          <View style={styles.myRobotTop}>
            <RobotFace size={48} primaryColor={C.purple} accentColor={C.green} animated />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.myRobotName}>{robot.name}</Text>
              <View style={styles.myRobotStats}>
                <Text style={[styles.statChip, { color: C.danger }]}>ATK {robot.attack}</Text>
                <Text style={[styles.statChip, { color: C.teal }]}>DEF {robot.defense}</Text>
                <Text style={[styles.statChip, { color: C.waiting }]}>SPD {robot.speed}</Text>
              </View>
            </View>
            <View style={styles.myRobotRecord}>
              <Text style={[styles.recordNum, { color: C.green }]}>{robot.wins}W</Text>
              <Text style={[styles.recordNum, { color: C.danger }]}>{robot.losses}L</Text>
            </View>
          </View>
          <Text style={styles.myRobotCta}>Tap to view → ENTER BATTLE</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.myRobotCard}
          onPress={() => router.push("/robot" as Href)}
          activeOpacity={0.8}
        >
          <Text style={styles.myRobotHint}>No robot registered yet</Text>
          <View style={styles.forgeBtn}>
            <Text style={styles.forgeBtnText}>⚔ FORGE YOUR ROBOT</Text>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* Hero */}
        <View style={styles.hero}>
          <RobotFace size={96} primaryColor={C.purple} accentColor={C.green} animated />
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>PROOF{"\n"}OF BATTLE</Text>
            <Text style={styles.heroSub}>Robot battles · On-chain stakes</Text>
          </View>
        </View>

        {/* BIOS-style terminal boot */}
        <TerminalBoot />

        {/* My Robot */}
        <MyRobotSection />

        {/* Section header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>LIVE ARENAS</Text>
          <View style={styles.sectionLine} />
        </View>

        {/* Battle cards */}
        {BATTLES.map((b) => {
          const isActive  = b.status === "ACTIVE";
          const statusClr = isActive ? C.live : C.waiting;
          return (
            <TouchableOpacity
              key={b.id}
              style={[styles.card, isActive && { borderColor: C.robotA }]}
              activeOpacity={0.75}
              onPress={() =>
                router.push({
                  pathname: "/battle/[id]",
                  params:   { id: b.id },
                } as Href)
              }
            >
              {/* Top — robot preview */}
              <View style={styles.cardArena}>
                <RobotFace size={38} primaryColor={C.robotA} accentColor={C.robotB} />
                <View style={styles.cardCenter}>
                  <Text style={styles.cardVs}>VS</Text>
                  <Text style={styles.cardSerial}>BATTLE://{String(b.id).padStart(3, "0")}</Text>
                </View>
                <RobotFace size={38} primaryColor={C.robotB} accentColor={C.robotA} />
              </View>

              {/* Bottom — info strip */}
              <View style={styles.cardInfo}>
                <View>
                  <Text style={styles.cardTitle}>{b.sublabel}</Text>
                  <Text style={styles.cardPath}>
                    C:\ARENAS\{b.sublabel.toUpperCase().replace(" ", "_")}
                  </Text>
                </View>
                <View style={styles.statusChip}>
                  {isActive && <PulsingDot color={statusClr} />}
                  <Text style={[styles.statusTxt, { color: statusClr }]}>
                    {b.status}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.solDots}>
            {([C.purple, C.teal, C.green] as string[]).map((c, i) => (
              <View key={i} style={[styles.dot, { backgroundColor: c }]} />
            ))}
          </View>
          <Text style={styles.footerTxt}>SOLANA DEVNET</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.bg },
  scroll:  { flex: 1 },
  content: { padding: 20, paddingBottom: 48, gap: 14 },

  // Hero
  hero:      { alignItems: "center", paddingVertical: 32, gap: 20 },
  heroText:  { alignItems: "center", gap: 8 },
  heroTitle: {
    color:      C.textPrimary,
    fontSize:   42,
    fontWeight: "900",
    textAlign:  "center",
    letterSpacing: 8,
    lineHeight:    46,
  },
  heroSub: {
    fontFamily: MONO,
    color:      C.textSecondary,
    fontSize:   11,
    letterSpacing: 2,
  },

  // Terminal
  terminal: {
    backgroundColor: C.bgCard,
    borderRadius:    8,
    borderWidth:     1,
    borderColor:     C.border,
    borderLeftWidth: 2,
    borderLeftColor: C.green,
    padding:         14,
    gap:             4,
  },
  termLine: { fontFamily: MONO, fontSize: 10, letterSpacing: 0.5 },

  // Section
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  sectionLabel:  {
    fontFamily: MONO,
    color:      C.textDim,
    fontSize:   9,
    fontWeight: "800",
    letterSpacing: 4,
  },
  sectionLine: { flex: 1, height: 1, backgroundColor: C.border },

  // Card
  card: {
    backgroundColor: C.bgCard,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     C.border,
    overflow:        "hidden",
  },
  cardArena: {
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "space-between",
    paddingVertical: 22,
    paddingHorizontal: 24,
    backgroundColor: C.bgAccent,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  cardCenter: { alignItems: "center", gap: 4 },
  cardVs: {
    color:      C.textDim,
    fontSize:   16,
    fontWeight: "900",
    letterSpacing: 4,
  },
  cardSerial: {
    fontFamily: MONO,
    color:      C.textDim,
    fontSize:   8,
    letterSpacing: 1,
  },
  cardInfo: {
    flexDirection:   "row",
    justifyContent:  "space-between",
    alignItems:      "center",
    padding:         14,
    paddingHorizontal: 18,
  },
  cardTitle: {
    color:      C.textPrimary,
    fontSize:   14,
    fontWeight: "700",
    letterSpacing: 1,
  },
  cardPath: {
    fontFamily: MONO,
    color:      C.textDim,
    fontSize:   9,
    marginTop:  3,
  },
  statusChip: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusTxt:  {
    fontFamily: MONO,
    fontSize:   9,
    fontWeight: "800",
    letterSpacing: 2,
  },

  // Footer
  footer:    { alignItems: "center", paddingTop: 28, gap: 8 },
  solDots:   { flexDirection: "row", gap: 6 },
  dot:       { width: 5, height: 5, borderRadius: 2.5 },
  footerTxt: {
    fontFamily: MONO,
    color:      C.textDim,
    fontSize:   9,
    letterSpacing: 4,
  },

  // My Robot section
  myRobotSection: { gap: 10 },
  myRobotCard: {
    backgroundColor: C.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    gap: 12,
    alignItems: "center",
  },
  myRobotCardActive: {
    borderColor: C.purple,
    shadowColor: C.purple,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  myRobotTop:   { flexDirection: "row", alignItems: "center", gap: 14, width: "100%" },
  myRobotName:  { color: C.textPrimary, fontSize: 16, fontWeight: "900", letterSpacing: 2 },
  myRobotStats: { flexDirection: "row", gap: 8 },
  statChip:     { fontFamily: MONO, fontSize: 10, fontWeight: "700" },
  myRobotRecord:{ alignItems: "center", gap: 2 },
  recordNum:    { fontFamily: MONO, fontSize: 12, fontWeight: "900" },
  myRobotHint:  { color: C.textDim, fontSize: 12, fontFamily: MONO },
  myRobotCta:   { fontFamily: MONO, color: C.textDim, fontSize: 9, letterSpacing: 1 },
  forgeBtn: {
    backgroundColor: C.purple,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  forgeBtnText: { color: "#fff", fontWeight: "900", fontSize: 12, letterSpacing: 2 },
});
