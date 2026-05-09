import { useRef, useEffect } from "react";
import { useLocalSearchParams, Stack } from "expo-router";
import {
  View, Text, ScrollView, StyleSheet,
  SafeAreaView, Animated, ActivityIndicator,
} from "react-native";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useBattle }    from "../../hooks/useBattle";
import { useWallet }    from "../../hooks/useWallet";
import { HPBar }        from "../../components/HPBar";
import { BetPanel }     from "../../components/BetPanel";
import { ClaimPanel }   from "../../components/ClaimPanel";
import { WalletButton } from "../../components/WalletButton";
import { RobotFace }    from "../../components/RobotFace";
import { C, MONO }      from "../../lib/theme";

const STATUS = [
  { label: "STANDBY",  color: C.waiting  },
  { label: "ACTIVE",   color: C.live     },
  { label: "RESOLVED", color: C.finished },
] as const;

/* ── Pulsing live indicator ─────────────────────────────────────────── */
function LivePulse() {
  const scale = useRef(new Animated.Value(1)).current;
  const op    = useRef(new Animated.Value(0.8)).current;
  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.timing(scale, { toValue: 1.6, duration: 800, useNativeDriver: true }),
        Animated.timing(op,    { toValue: 0,   duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <View style={{ width: 8, height: 8 }}>
      <Animated.View style={{
        ...StyleSheet.absoluteFillObject,
        borderRadius: 4,
        backgroundColor: C.live,
        transform: [{ scale }],
        opacity: op,
      }} />
      <View style={{
        ...StyleSheet.absoluteFillObject,
        borderRadius: 4,
        backgroundColor: C.live,
      }} />
    </View>
  );
}

/* ── Terminal event log line ────────────────────────────────────────── */
function EventLine({ text }: { text: string }) {
  const op = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(op, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [text]);
  return (
    <Animated.View style={[styles.eventLine, { opacity: op }]}>
      <Text style={styles.eventPrompt}>{">"}</Text>
      <Text style={styles.eventMsg}>{text}</Text>
    </Animated.View>
  );
}

/* ── Stat box ────────────────────────────────────────────────────────── */
function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, color ? { color } : undefined]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/* ── Main screen ─────────────────────────────────────────────────────── */
export default function BattleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const battleId = parseInt(id ?? "1", 10);
  const { battle, loading } = useBattle(battleId);
  const { publicKey, connect, disconnect, connecting, isWebPreview } = useWallet();

  const status = STATUS[battle.status] ?? { label: "UNKNOWN", color: C.textDim };
  const isLive = battle.status === 1;

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ title: `BATTLE://${String(battleId).padStart(3, "0")}` }} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* ── Header strip ─────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.statusRow}>
            {isLive ? <LivePulse /> : (
              <View style={[styles.staticDot, { backgroundColor: status.color }]} />
            )}
            <Text style={[styles.statusLabel, { color: status.color }]}>
              {status.label}
            </Text>
          </View>
          <Text style={styles.serialTxt}>
            C:\ARENAS\BATTLE_{String(battleId).padStart(3, "0")}
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={C.purple} />
            <Text style={styles.loadingTxt}>LOADING BATTLE STATE…</Text>
          </View>
        ) : (
          <>
            {/* ── Arena ──────────────────────────────────────────── */}
            <View style={styles.arena}>
              {/* Robot A */}
              <View style={styles.robotCol}>
                <RobotFace
                  size={68}
                  primaryColor={C.robotA}
                  accentColor={C.robotB}
                  label="A"
                  animated={isLive}
                />
              </View>

              {/* VS divider */}
              <View style={styles.vsDivider}>
                <View style={[styles.vsDivLine, { backgroundColor: C.robotA }]} />
                <View style={styles.vsBox}>
                  <Text style={styles.vsText}>VS</Text>
                </View>
                <View style={[styles.vsDivLine, { backgroundColor: C.robotB }]} />
              </View>

              {/* Robot B */}
              <View style={styles.robotCol}>
                <RobotFace
                  size={68}
                  primaryColor={C.robotB}
                  accentColor={C.robotA}
                  label="B"
                  animated={isLive}
                />
              </View>
            </View>

            {/* ── HP bars ────────────────────────────────────────── */}
            <View style={styles.hpSection}>
              <Text style={styles.sysLabel}>INTEGRITY CHECK</Text>
              <View style={styles.hpRow}>
                <HPBar label="UNIT-A" hp={battle.hpA} color={C.robotA} align="left"  />
                <View style={{ width: 16 }} />
                <HPBar label="UNIT-B" hp={battle.hpB} color={C.robotB} align="right" />
              </View>
            </View>

            {/* ── Terminal event log ─────────────────────────────── */}
            <View style={styles.terminalBox}>
              <View style={styles.terminalHeader}>
                <View style={[styles.termDot, { backgroundColor: C.danger  }]} />
                <View style={[styles.termDot, { backgroundColor: C.waiting }]} />
                <View style={[styles.termDot, { backgroundColor: C.live    }]} />
                <Text style={styles.termTitle}>BATTLE.LOG</Text>
              </View>
              <View style={styles.terminalBody}>
                {battle.lastEvent ? (
                  <EventLine text={battle.lastEvent} />
                ) : (
                  <Text style={styles.termIdle}>
                    {">"} AWAITING COMBAT EVENTS…
                  </Text>
                )}
                <Text style={styles.termCursor}>{"█"}</Text>
              </View>
            </View>

            {/* ── On-chain stats ─────────────────────────────────── */}
            <View style={styles.statsSection}>
              <Text style={styles.sysLabel}>ON-CHAIN STATE</Text>
              <View style={styles.statsRow}>
                <StatBox
                  label="POOL → A"
                  value={`${(battle.totalBetsA / LAMPORTS_PER_SOL).toFixed(3)} SOL`}
                  color={C.robotA}
                />
                <StatBox
                  label="TOTAL POOL"
                  value={`${((battle.totalBetsA + battle.totalBetsB) / LAMPORTS_PER_SOL).toFixed(3)} SOL`}
                  color={C.teal}
                />
                <StatBox
                  label="POOL → B"
                  value={`${(battle.totalBetsB / LAMPORTS_PER_SOL).toFixed(3)} SOL`}
                  color={C.robotB}
                />
              </View>
            </View>

            {/* ── Wallet ─────────────────────────────────────────── */}
            <View style={styles.walletRow}>
              <WalletButton
                publicKey={publicKey}
                connecting={connecting}
                isWebPreview={isWebPreview}
                onConnect={connect}
                onDisconnect={disconnect}
              />
            </View>

            {/* ── Bet panel ──────────────────────────────────────── */}
            {isLive && (
              <BetPanel
                battleId={battleId}
                publicKey={publicKey}
                totalBetsA={battle.totalBetsA}
                totalBetsB={battle.totalBetsB}
              />
            )}

            {/* ── Claim winnings ─────────────────────────────────── */}
            {battle.status === 2 && battle.winner !== 255 && publicKey && (
              <ClaimPanel
                battleId={battleId}
                publicKey={publicKey}
                winner={battle.winner}
              />
            )}

            {/* ── Winner ─────────────────────────────────────────── */}
            {battle.status === 2 && battle.winner !== 255 && (
              <View style={[
                styles.winnerCard,
                { borderColor: battle.winner === 0 ? C.robotA : C.robotB },
              ]}>
                <RobotFace
                  size={56}
                  primaryColor={battle.winner === 0 ? C.robotA : C.robotB}
                  accentColor={battle.winner === 0 ? C.robotB : C.robotA}
                  label={battle.winner === 0 ? "A" : "B"}
                />
                <View style={styles.winnerText}>
                  <Text style={[
                    styles.winnerTitle,
                    { color: battle.winner === 0 ? C.robotA : C.robotB },
                  ]}>
                    UNIT-{battle.winner === 0 ? "A" : "B"} VICTORIOUS
                  </Text>
                  <Text style={styles.winnerSub}>
                    {">"} WINNINGS DISTRIBUTED ON-CHAIN
                  </Text>
                </View>
              </View>
            )}
          </>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerTxt}>SOLANA DEVNET · POB v1.0</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.bg },
  scroll:  { flex: 1 },
  content: { padding: 16, paddingBottom: 48, gap: 12 },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  staticDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: {
    fontFamily: MONO,
    fontSize:   11,
    fontWeight: "800",
    letterSpacing: 3,
  },
  serialTxt: {
    fontFamily: MONO,
    color:   C.textDim,
    fontSize: 9,
    letterSpacing: 0.5,
  },

  // Loading
  loadingBox: { alignItems: "center", paddingVertical: 60, gap: 14 },
  loadingTxt: { fontFamily: MONO, color: C.textDim, fontSize: 11, letterSpacing: 2 },

  // Arena
  arena: {
    flexDirection:   "row",
    alignItems:      "center",
    backgroundColor: C.bgCard,
    borderRadius:    14,
    borderWidth:     1,
    borderColor:     C.border,
    padding:         20,
  },
  robotCol:  { flex: 1, alignItems: "center" },
  vsDivider: { paddingHorizontal: 8, alignItems: "center", gap: 4 },
  vsDivLine: { width: 1, height: 20, opacity: 0.4 },
  vsBox:     { padding: 4 },
  vsText: {
    color:      C.textDim,
    fontSize:   14,
    fontWeight: "900",
    letterSpacing: 3,
  },

  // HP
  hpSection: {
    backgroundColor: C.bgCard,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     C.border,
    padding:         16,
    gap:             12,
  },
  hpRow: { flexDirection: "row" },
  sysLabel: {
    fontFamily: MONO,
    color:      C.textDim,
    fontSize:   8,
    fontWeight: "800",
    letterSpacing: 4,
  },

  // Terminal log
  terminalBox: {
    backgroundColor: "#050510",
    borderRadius:    10,
    borderWidth:     1,
    borderColor:     C.border,
    overflow:        "hidden",
  },
  terminalHeader: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             6,
    paddingHorizontal: 12,
    paddingVertical:   8,
    backgroundColor: C.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  termDot:   { width: 8, height: 8, borderRadius: 4 },
  termTitle: {
    fontFamily: MONO,
    color:      C.textDim,
    fontSize:   9,
    letterSpacing: 3,
    marginLeft: 4,
  },
  terminalBody: { padding: 14, minHeight: 56, gap: 4 },
  eventLine: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  eventPrompt: { fontFamily: MONO, color: C.green,  fontSize: 12 },
  eventMsg:    { fontFamily: MONO, color: C.textSecondary, fontSize: 12, flex: 1 },
  termIdle: {
    fontFamily: MONO,
    color:      C.textDim,
    fontSize:   11,
    letterSpacing: 0.5,
  },
  termCursor: {
    fontFamily: MONO,
    color:      C.green,
    fontSize:   12,
    opacity:    0.7,
  },

  // Stats
  statsSection: { gap: 8 },
  statsRow: { flexDirection: "row", gap: 8 },
  statBox: {
    flex:            1,
    backgroundColor: C.bgCard,
    borderRadius:    10,
    padding:         12,
    alignItems:      "center",
    borderWidth:     1,
    borderColor:     C.border,
    gap:             4,
  },
  statValue: {
    fontFamily: MONO,
    fontSize:   13,
    fontWeight: "700",
    color:      C.textPrimary,
  },
  statLabel: {
    fontFamily: MONO,
    color:      C.textDim,
    fontSize:   7,
    letterSpacing: 2,
    fontWeight: "800",
  },

  // Wallet
  walletRow: { alignItems: "center" },

  // Winner
  winnerCard: {
    backgroundColor: C.bgCard,
    borderRadius:    14,
    borderWidth:     2,
    padding:         28,
    flexDirection:   "row",
    alignItems:      "center",
    gap:             20,
    shadowOpacity:   0.25,
    shadowRadius:    20,
    elevation:       8,
  },
  winnerText:  { flex: 1, gap: 8 },
  winnerTitle: { fontSize: 20, fontWeight: "900", letterSpacing: 2 },
  winnerSub:   {
    fontFamily: MONO,
    color:      C.textSecondary,
    fontSize:   10,
    letterSpacing: 1,
  },

  // Footer
  footer:    { alignItems: "center", paddingTop: 24 },
  footerTxt: {
    fontFamily: MONO,
    color:      C.textDim,
    fontSize:   9,
    letterSpacing: 3,
  },
});
