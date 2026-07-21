import { useRef, useEffect, useCallback, useState } from "react";
import { useLocalSearchParams, Stack } from "expo-router";
import {
  View, Text, ScrollView, StyleSheet,
  Animated, ActivityIndicator,
  TouchableOpacity, Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { BattleEvent } from "../../hooks/useBattle";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useBattle }    from "../../hooks/useBattle";
import { useWallet }    from "../../hooks/useWallet";
import { useRobot }     from "../../hooks/useRobot";
import { HPBar }        from "../../components/HPBar";
import { BetPanel }     from "../../components/BetPanel";
import { ClaimPanel }   from "../../components/ClaimPanel";
import { RobotFace }    from "../../components/RobotFace";
import { CommandPanel } from "../../components/CommandPanel";
import { BRIDGE_BASE_URL } from "../../lib/constants";
import { C, MONO, SANS_900 } from "../../lib/theme";

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

/* ── Event feed line ────────────────────────────────────────────────── */
const EVENT_COLOR: Record<BattleEvent["kind"], string> = {
  damage: C.danger,
  action: C.teal,
  system: C.finished,
  result: C.live,
};

function EventLine({ evt }: { evt: BattleEvent }) {
  const op = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(op, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }, []);
  const hh = new Date(evt.ts).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  return (
    <Animated.View style={[styles.eventLine, { opacity: op }]}>
      <Text style={[styles.eventKind, { color: EVENT_COLOR[evt.kind] }]}>
        {evt.kind === "damage" ? "DMG" : evt.kind === "action" ? "ACT" : evt.kind === "result" ? "WIN" : "SYS"}
      </Text>
      <Text style={styles.eventTs}>{hh}</Text>
      <Text style={[styles.eventMsg, { color: evt.kind === "result" ? EVENT_COLOR.result : undefined }]}>
        {evt.text}
      </Text>
    </Animated.View>
  );
}

/* ── Stats comparison ────────────────────────────────────────────────── */
type Stats   = { atk: number; def: number; spd: number };
type Profile = { wins: number; losses: number; categories: string[] };

const STAT_KEYS: { key: keyof Stats; label: string; color: string }[] = [
  { key: "atk", label: "ATK", color: C.danger  },
  { key: "def", label: "DEF", color: C.teal    },
  { key: "spd", label: "SPD", color: C.waiting },
];

function WinRate({ wins, losses, align }: { wins: number; losses: number; align: "left" | "right" }) {
  const rate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : null;
  const row = (
    <View style={styles.wlRow}>
      <Text style={styles.wlW}>{wins}W</Text>
      <Text style={styles.wlL}>{losses}L</Text>
      {rate !== null && <Text style={styles.wlRate}>{rate}%</Text>}
    </View>
  );
  return align === "right"
    ? <View style={{ alignItems: "flex-end" }}>{row}</View>
    : row;
}

function StatsComparison({
  a, b, nameA, nameB, profileA, profileB,
}: {
  a: Stats; b: Stats;
  nameA: string; nameB: string;
  profileA: Profile | null; profileB: Profile | null;
}) {
  return (
    <View style={styles.statsComp}>
      <Text style={styles.statsCompLabel}>COMBAT SPECS</Text>

      {/* Names + W/L */}
      <View style={styles.statsHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.statsName, { color: C.robotA }]} numberOfLines={1}>{nameA}</Text>
          {profileA && <WinRate wins={profileA.wins} losses={profileA.losses} align="left" />}
        </View>
        <Text style={styles.statsVs}>VS</Text>
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <Text style={[styles.statsName, { color: C.robotB }]} numberOfLines={1}>{nameB}</Text>
          {profileB && <WinRate wins={profileB.wins} losses={profileB.losses} align="right" />}
        </View>
      </View>

      {/* Mirrored bars */}
      {STAT_KEYS.map(({ key, label, color }) => (
        <View key={key} style={styles.statsCompRow}>
          <Text style={[styles.statsVal, { color }]}>{a[key]}</Text>
          <View style={styles.statsBarWrap}>
            <View style={styles.barBgLeft}>
              <View style={[styles.barFillLeft, { width: `${a[key]}%` as unknown as number, backgroundColor: color }]} />
            </View>
            <Text style={styles.statsRowLabel}>{label}</Text>
            <View style={styles.barBgRight}>
              <View style={[styles.barFillRight, { width: `${b[key]}%` as unknown as number, backgroundColor: color, opacity: 0.5 }]} />
            </View>
          </View>
          <Text style={[styles.statsVal, { color, opacity: 0.7 }]}>{b[key]}</Text>
        </View>
      ))}

      {/* Categories */}
      {((profileA?.categories?.length ?? 0) > 0 || (profileB?.categories?.length ?? 0) > 0) && (
        <View style={styles.catCompRow}>
          <View style={styles.catCompSide}>
            {(profileA?.categories ?? []).map((cat) => (
              <View key={cat} style={[styles.catTag, { borderColor: C.robotA + "60" }]}>
                <Text style={[styles.catTagText, { color: C.robotA }]}>{cat}</Text>
              </View>
            ))}
          </View>
          <View style={[styles.catCompSide, { alignItems: "flex-end" }]}>
            {(profileB?.categories ?? []).map((cat) => (
              <View key={cat} style={[styles.catTag, { borderColor: C.robotB + "60" }]}>
                <Text style={[styles.catTagText, { color: C.robotB }]}>{cat}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
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
  const { battle, loading, wsConnected } = useBattle(battleId);
  const logScrollRef = useRef<ScrollView>(null);
  const scrollToTop = useCallback(() => {
    logScrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);
  useEffect(() => { scrollToTop(); }, [battle.events.length]);
  const { publicKey } = useWallet();
  const { robot } = useRobot(publicKey);

  // Fetch competition metadata for real robot names + stats + profiles
  const [nameA, setNameA] = useState("UNIT-A");
  const [nameB, setNameB] = useState("UNIT-B");
  const [statsA, setStatsA] = useState<{ atk: number; def: number; spd: number } | null>(null);
  const [statsB, setStatsB] = useState<{ atk: number; def: number; spd: number } | null>(null);
  const [profileA, setProfileA] = useState<{ wins: number; losses: number; categories: string[] } | null>(null);
  const [profileB, setProfileB] = useState<{ wins: number; losses: number; categories: string[] } | null>(null);

  useEffect(() => {
    setStatsA(null);
    setStatsB(null);
    setProfileA(null);
    setProfileB(null);

    let rNameA = "UNIT-A";
    let rNameB = "UNIT-B";

    fetch(`${BRIDGE_BASE_URL}/api/competition/${battleId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return null;
        if (data.robot_a_name) { setNameA(data.robot_a_name); rNameA = data.robot_a_name; }
        if (data.robot_b_name) { setNameB(data.robot_b_name); rNameB = data.robot_b_name; }
        if (data.robot_a_attack != null) setStatsA({ atk: data.robot_a_attack, def: data.robot_a_defense, spd: data.robot_a_speed });
        if (data.robot_b_attack != null) setStatsB({ atk: data.robot_b_attack, def: data.robot_b_defense, spd: data.robot_b_speed });
        return fetch(`${BRIDGE_BASE_URL}/api/leaderboard`);
      })
      .then((r) => r?.ok ? r.json() : null)
      .then((entries: Array<{ name: string; wins: number; losses: number; categories?: string[] }> | null) => {
        if (!entries) return;
        const a = entries.find((e) => e.name === rNameA);
        const b = entries.find((e) => e.name === rNameB);
        if (a) setProfileA({ wins: a.wins, losses: a.losses, categories: a.categories ?? [] });
        if (b) setProfileB({ wins: b.wins, losses: b.losses, categories: b.categories ?? [] });
      })
      .catch(() => {});
  }, [battleId]);

  // Detect if the connected wallet's robot is in this battle
  const commanderSide: "robot_a" | "robot_b" | null =
    robot && battle.robotA && robot.pda === battle.robotA ? "robot_a" :
    robot && battle.robotB && robot.pda === battle.robotB ? "robot_b" :
    null;
  const isCommander = commanderSide !== null && battle.status === 1;

  const status = STATUS[battle.status] ?? { label: "UNKNOWN", color: C.textDim };
  const isLive = battle.status === 1;

  const handleShare = () => {
    Share.share({
      message: `Watch Battle #${battleId} LIVE on Proof of Battle!\nhttps://proofofbattle.app/arena/${battleId}`,
      title: `Battle #${battleId} · Proof of Battle`,
    }).catch(() => {});
  };

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
          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={handleShare}
              style={styles.shareBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.shareBtnText}>⤴ SHARE</Text>
            </TouchableOpacity>
            <View style={[styles.wsDot, { backgroundColor: wsConnected ? C.green : C.textDim }]} />
            <Text style={[styles.wsLabel, { color: wsConnected ? C.green : C.textDim }]}>
              {wsConnected ? "LIVE" : "SYNC"}
            </Text>
          </View>
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
                <HPBar label={nameA} hp={battle.hpA} color={C.robotA} align="left"  />
                <View style={{ width: 16 }} />
                <HPBar label={nameB} hp={battle.hpB} color={C.robotB} align="right" />
              </View>
            </View>

            {/* ── Combat stats comparison ─────────────────────────── */}
            {statsA && statsB && (
              <StatsComparison
                a={statsA} b={statsB}
                nameA={nameA} nameB={nameB}
                profileA={profileA} profileB={profileB}
              />
            )}

            {/* ── Live event feed ────────────────────────────────── */}
            <View style={styles.terminalBox}>
              <View style={styles.terminalHeader}>
                <View style={[styles.termDot, { backgroundColor: C.danger  }]} />
                <View style={[styles.termDot, { backgroundColor: C.waiting }]} />
                <View style={[styles.termDot, { backgroundColor: C.live    }]} />
                <Text style={styles.termTitle}>BATTLE.LOG</Text>
                {wsConnected && isLive && (
                  <View style={styles.liveChip}>
                    <Text style={styles.liveChipText}>● LIVE</Text>
                  </View>
                )}
              </View>
              <ScrollView
                ref={logScrollRef}
                style={styles.terminalScroll}
                contentContainerStyle={styles.terminalBody}
                showsVerticalScrollIndicator={false}
              >
                {battle.events.length === 0 ? (
                  <Text style={styles.termIdle}>{">"} AWAITING COMBAT EVENTS…</Text>
                ) : (
                  battle.events.map((evt) => <EventLine key={evt.id} evt={evt} />)
                )}
                <Text style={styles.termCursor}>{"█"}</Text>
              </ScrollView>
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

            {/* ── Commander panel ────────────────────────────────── */}
            {isCommander && commanderSide && (
              <CommandPanel
                arenaId={battleId}
                robotId={commanderSide}
                myHp={commanderSide === "robot_a" ? battle.hpA : battle.hpB}
                enemyHp={commanderSide === "robot_a" ? battle.hpB : battle.hpA}
              />
            )}

            {/* ── Bet panel ──────────────────────────────────────── */}
            {isLive && !isCommander && (
              <BetPanel
                battleId={battleId}
                publicKey={publicKey}
                totalBetsA={battle.totalBetsA}
                totalBetsB={battle.totalBetsB}
                nameA={nameA}
                nameB={nameB}
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
                    {battle.winner === 0 ? nameA : nameB} VICTORIOUS
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
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  wsDot:   { width: 6, height: 6, borderRadius: 3 },
  wsLabel: { fontFamily: MONO, fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  shareBtn: {
    borderWidth: 1, borderColor: C.teal + "60",
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
    backgroundColor: C.teal + "18",
  },
  shareBtnText: {
    fontFamily: MONO, color: C.teal,
    fontSize: 8, fontWeight: "900", letterSpacing: 1,
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
    fontFamily: SANS_900,
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

  // Stats comparison
  statsComp: {
    backgroundColor: C.bgCard,
    borderRadius:    10,
    borderWidth:     1,
    borderColor:     C.border,
    padding:         12,
    gap:             8,
  },
  statsCompLabel: {
    fontFamily:    MONO,
    color:         C.textDim,
    fontSize:      8,
    fontWeight:    "800",
    letterSpacing: 4,
    marginBottom:  2,
  },
  statsHeader:  { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  statsName:    { fontSize: 11, fontFamily: SANS_900, letterSpacing: 1 },
  statsVs:      { fontFamily: MONO, color: C.textDim, fontSize: 9, alignSelf: "center", paddingHorizontal: 2 },
  wlRow:        { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  wlW:          { fontFamily: MONO, color: C.green,  fontSize: 9, fontWeight: "800" },
  wlL:          { fontFamily: MONO, color: C.danger, fontSize: 9, fontWeight: "800" },
  wlRate:       { fontFamily: MONO, color: C.textDim, fontSize: 8 },

  statsCompRow:    { flexDirection: "row", alignItems: "center", gap: 6 },
  statsVal:    { fontFamily: MONO, fontSize: 11, fontWeight: "900", width: 26, textAlign: "center" },
  statsBarWrap:{ flex: 1, flexDirection: "row", alignItems: "center", gap: 4 },
  statsRowLabel:{ fontFamily: MONO, color: C.textDim, fontSize: 8, width: 24, textAlign: "center", letterSpacing: 1 },
  barBgLeft:   { flex: 1, height: 5, backgroundColor: C.bgAccent, borderRadius: 3, overflow: "hidden", flexDirection: "row", justifyContent: "flex-end" },
  barBgRight:  { flex: 1, height: 5, backgroundColor: C.bgAccent, borderRadius: 3, overflow: "hidden" },
  barFillLeft: { height: "100%", borderRadius: 3 },
  barFillRight:{ height: "100%", borderRadius: 3 },

  catCompRow:  { flexDirection: "row", gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border + "60" },
  catCompSide: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 4 },
  catTag: {
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  catTagText: { fontFamily: MONO, fontSize: 7, fontWeight: "800", letterSpacing: 0.5 },

  sysLabel: {
    fontFamily: MONO,
    color:      C.textDim,
    fontSize:   8,
    fontWeight: "800",
    letterSpacing: 4,
  },

  // Terminal log
  terminalBox: {
    backgroundColor: C.bg,
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
  terminalScroll: { maxHeight: 200 },
  terminalBody:   { padding: 12, gap: 5 },
  liveChip: {
    marginLeft: "auto",
    backgroundColor: C.green + "22",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  liveChipText: { fontFamily: MONO, color: C.green, fontSize: 8, fontWeight: "900" },
  eventLine:  { flexDirection: "row", gap: 6, alignItems: "flex-start" },
  eventKind:  { fontFamily: MONO, fontSize: 9, fontWeight: "900", width: 28, paddingTop: 1 },
  eventTs:    { fontFamily: MONO, color: C.textDim, fontSize: 9, paddingTop: 1, width: 52 },
  eventMsg:   { fontFamily: MONO, color: C.textSecondary, fontSize: 11, flex: 1, lineHeight: 16 },
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
  winnerTitle: { fontSize: 20, fontFamily: SANS_900, letterSpacing: 2 },
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
