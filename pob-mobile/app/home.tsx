import { useRef, useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, Animated, ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter, Href } from "expo-router";
import { PublicKey }    from "@solana/web3.js";
import { RobotFace }    from "../components/RobotFace";
import { WalletButton } from "../components/WalletButton";
import { useWallet }    from "../hooks/useWallet";
import { useRobot }     from "../hooks/useRobot";
import { BRIDGE_BASE_URL } from "../lib/constants";
import { toast } from "../components/Toast";
import { C, MONO, SANS_900 } from "../lib/theme";

// ── Competition type ──────────────────────────────────────────────────────────

type Member = { wallet: string; alias: string; share: number };
type CompMeta = {
  battleId: number;
  name: string;
  location: string;
  creator: string;
  isTeam: boolean;
  teamName?: string;
  members?: Member[];
  status: "waiting" | "active" | "finished";
  viewerCount: number;
};

type RawComp = {
  battle_id: number;
  name: string;
  location: string;
  creator?: string;
  is_team: boolean;
  team_name?: string;
  members?: Member[];
  status: string;
  viewer_count: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

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
      width: 7, height: 7, borderRadius: 3.5,
      backgroundColor: color, opacity: op,
    }} />
  );
}

// ── My Robot section ──────────────────────────────────────────────────────────

function MyRobotSection() {
  const router = useRouter();
  const { publicKey, connect, disconnect, connecting, isWebPreview } = useWallet();
  const { robot, loading } = useRobot(publicKey);

  return (
    <View style={styles.section}>
      <View style={styles.sectionRow}>
        <Text style={styles.sectionLabel}>MY ROBOT</Text>
        <View style={styles.sectionLine} />
      </View>

      {!publicKey ? (
        <View style={styles.robotCard}>
          <Text style={styles.hintText}>Connect wallet to register your robot</Text>
          <WalletButton
            publicKey={publicKey}
            connecting={connecting}
            isWebPreview={isWebPreview}
            onConnect={connect}
            onDisconnect={disconnect}
          />
        </View>
      ) : loading ? (
        <View style={styles.robotCard}>
          <ActivityIndicator color={C.purple} />
        </View>
      ) : robot ? (
        <TouchableOpacity
          style={[styles.robotCard, styles.robotCardActive]}
          onPress={() => router.push("/robot" as Href)}
          activeOpacity={0.8}
        >
          <View style={styles.robotTop}>
            <RobotFace size={48} primaryColor={C.purple} accentColor={C.green} animated />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.robotName}>{robot.name}</Text>
              <View style={styles.robotStats}>
                <Text style={[styles.statChip, { color: C.danger }]}>ATK {robot.attack}</Text>
                <Text style={[styles.statChip, { color: C.teal }]}>DEF {robot.defense}</Text>
                <Text style={[styles.statChip, { color: C.waiting }]}>SPD {robot.speed}</Text>
              </View>
            </View>
            <View style={styles.robotRecord}>
              <Text style={[styles.recordNum, { color: C.green }]}>{robot.wins}W</Text>
              <Text style={[styles.recordNum, { color: C.danger }]}>{robot.losses}L</Text>
            </View>
          </View>
          <Text style={styles.robotCta}>Tap to manage  ·  ENTER a battle below</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.robotCard}
          onPress={() => router.push("/robot" as Href)}
          activeOpacity={0.8}
        >
          <Text style={styles.hintText}>No robot registered yet</Text>
          <View style={styles.forgeBtn}>
            <Text style={styles.forgeBtnText}>⚔ FORGE YOUR ROBOT</Text>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Competition card ──────────────────────────────────────────────────────────

function CompetitionCard({
  comp, onJoin, publicKey, onStarted,
}: {
  comp: CompMeta;
  onJoin: () => void;
  publicKey: PublicKey | null;
  onStarted: () => void;
}) {
  const isActive   = comp.status === "active";
  const isFinished = comp.status === "finished";
  const statusClr  = isActive ? C.live : isFinished ? C.finished : C.waiting;
  const statusLbl  = isActive ? "LIVE" : isFinished ? "ENDED" : "WAITING";
  const visibleMembers = (comp.members ?? []).filter((m) => m.alias || m.wallet);
  const isCreator = !!publicKey && publicKey.toBase58() === comp.creator;

  const [starting, setStarting] = useState(false);
  const [startErr, setStartErr] = useState<string | null>(null);

  const handleStart = async () => {
    if (!publicKey) return;
    setStarting(true);
    setStartErr(null);
    try {
      const resp = await fetch(
        `${BRIDGE_BASE_URL}/api/competition/${comp.battleId}/start?creator=${publicKey.toBase58()}`,
        { method: "POST" }
      );
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        setStartErr(data.detail ?? data.error ?? "Start failed");
      } else {
        onStarted();
      }
    } catch {
      setStartErr("Bridge unreachable");
    } finally {
      setStarting(false);
    }
  };

  return (
    <View style={[styles.compCard, isActive && { borderColor: C.purple + "80" }]}>
      {/* Top row */}
      <View style={styles.compTop}>
        <View style={{ flex: 1, gap: 5 }}>
          <View style={styles.compTitleRow}>
            <Text style={styles.compName} numberOfLines={1}>{comp.name}</Text>
            {comp.isTeam && (
              <View style={styles.teamBadge}>
                <Text style={styles.teamBadgeText}>TEAM</Text>
              </View>
            )}
          </View>
          <Text style={styles.compLocation}>📍 {comp.location}</Text>
          {comp.isTeam && comp.teamName ? (
            <Text style={styles.compTeamName}>{comp.teamName}</Text>
          ) : null}
        </View>
        <View style={styles.statusChip}>
          {isActive ? <PulsingDot color={statusClr} /> : (
            <View style={[styles.staticDot, { backgroundColor: statusClr }]} />
          )}
          <Text style={[styles.statusTxt, { color: statusClr }]}>{statusLbl}</Text>
        </View>
      </View>

      {/* Member chips */}
      {visibleMembers.length > 0 && (
        <View style={styles.memberRow}>
          {visibleMembers.map((m, i) => (
            <View key={i} style={styles.memberChip}>
              <Text style={styles.memberAlias} numberOfLines={1}>
                {m.alias || (m.wallet ? m.wallet.slice(0, 4) + "…" + m.wallet.slice(-4) : "?")}
              </Text>
              <Text style={styles.memberShare}>{m.share}%</Text>
            </View>
          ))}
          {comp.viewerCount > 0 && (
            <View style={[styles.memberChip, { borderColor: C.border }]}>
              <Text style={styles.memberAlias}>👁 {comp.viewerCount}</Text>
            </View>
          )}
        </View>
      )}

      {/* Creator: start battle */}
      {isCreator && comp.status === "waiting" && (
        <View style={{ gap: 4 }}>
          <TouchableOpacity
            style={[styles.startBtn, starting && { opacity: 0.5 }]}
            onPress={handleStart}
            disabled={starting}
            activeOpacity={0.8}
          >
            {starting
              ? <ActivityIndicator color={C.danger} size="small" />
              : <Text style={styles.startBtnText}>⚔ INICIAR BATALLA</Text>
            }
          </TouchableOpacity>
          {startErr && <Text style={styles.startErrTxt}>{startErr}</Text>}
        </View>
      )}

      {/* Join button */}
      <TouchableOpacity
        style={[
          styles.joinBtn,
          isActive ? styles.joinBtnLive : isFinished ? styles.joinBtnEnded : styles.joinBtnWait,
        ]}
        onPress={onJoin}
        disabled={isFinished}
        activeOpacity={0.75}
      >
        <Text style={[
          styles.joinBtnText,
          { color: isFinished ? C.textDim : isActive ? C.green : C.purple },
        ]}>
          {isFinished ? "ENDED" : isActive ? "▶ JOIN LIVE" : "◎ ENTER ARENA"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Home screen ───────────────────────────────────────────────────────────────

type CompFilter = "all" | "active" | "waiting" | "finished";

const COMP_FILTERS: { key: CompFilter; label: string }[] = [
  { key: "all",      label: "ALL"     },
  { key: "active",   label: "● LIVE"  },
  { key: "waiting",  label: "◎ WAIT"  },
  { key: "finished", label: "○ ENDED" },
];

export default function HomeScreen() {
  const router = useRouter();
  const { publicKey } = useWallet();
  const [competitions, setCompetitions] = useState<CompMeta[]>([]);
  const [loadingComps, setLoadingComps] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<CompFilter>("all");
  const prevStatusRef = useRef<Map<number, string> | null>(null);

  const loadCompetitions = useCallback(async () => {
    try {
      const resp = await fetch(`${BRIDGE_BASE_URL}/api/competitions`);
      if (resp.ok) {
        const data: RawComp[] = await resp.json();
        // Notify when a competition transitions waiting → active (skip first load)
        if (prevStatusRef.current !== null) {
          data.forEach((c) => {
            if (prevStatusRef.current?.get(c.battle_id) === "waiting" && c.status === "active") {
              toast.info(`⚔ ${c.name} is now LIVE!`, "Battle started");
            }
          });
        }
        const newMap = new Map<number, string>();
        data.forEach((c) => newMap.set(c.battle_id, c.status));
        prevStatusRef.current = newMap;

        setCompetitions(
          data.map((c) => ({
            battleId: c.battle_id,
            name: c.name,
            location: c.location,
            creator: c.creator ?? "",
            isTeam: c.is_team,
            teamName: c.team_name,
            members: c.members,
            status: c.status as CompMeta["status"],
            viewerCount: c.viewer_count,
          }))
        );
      }
    } catch {
      /* bridge offline — keep current list */
    }
    setLoadingComps(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadCompetitions();
    const id = setInterval(loadCompetitions, 5000);
    return () => clearInterval(id);
  }, [loadCompetitions]);

  const onRefresh = () => {
    setRefreshing(true);
    loadCompetitions();
  };

  const handleJoin = (battleId: number) => {
    router.push({
      pathname: "/battle/[id]",
      params: { id: battleId },
    } as Href);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C.purple}
          />
        }
      >
        {/* My Robot */}
        <MyRobotSection />

        {/* Live arenas section */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>LIVE ARENAS</Text>
          <View style={styles.sectionLine} />
          <TouchableOpacity
            style={styles.toolsBtn}
            onPress={() => router.push("/resources" as Href)}
            activeOpacity={0.8}
          >
            <Text style={styles.toolsBtnText}>🛠</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.histBtn}
            onPress={() => router.push("/history" as Href)}
            activeOpacity={0.8}
          >
            <Text style={styles.histBtnText}>📜</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.rankBtn}
            onPress={() => router.push("/leaderboard" as Href)}
            activeOpacity={0.8}
          >
            <Text style={styles.rankBtnText}>🏆</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => router.push("/compete" as Href)}
            activeOpacity={0.8}
          >
            <Text style={styles.createBtnText}>+ CREATE</Text>
          </TouchableOpacity>
        </View>

        {/* Filter chips */}
        {!loadingComps && competitions.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {COMP_FILTERS.map(({ key, label }) => {
              const count = key === "all"
                ? competitions.length
                : competitions.filter((c) => c.status === key).length;
              const isActive = filter === key;
              const chipColor =
                key === "active"   ? C.live     :
                key === "waiting"  ? C.waiting  :
                key === "finished" ? C.finished :
                C.purple;
              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.filterChip,
                    isActive
                      ? { borderColor: chipColor, backgroundColor: chipColor + "25" }
                      : { borderColor: C.border, backgroundColor: "transparent" },
                  ]}
                  onPress={() => setFilter(key)}
                  activeOpacity={0.75}
                >
                  <Text style={[
                    styles.filterChipText,
                    { color: isActive ? chipColor : C.textDim },
                  ]}>
                    {label}
                  </Text>
                  {count > 0 && (
                    <Text style={[styles.filterCount, { color: isActive ? chipColor : C.textDim, opacity: isActive ? 0.8 : 0.4 }]}>
                      {count}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {loadingComps ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={C.purple} size="small" />
            <Text style={styles.loadingTxt}>SCANNING ARENA…</Text>
          </View>
        ) : (() => {
          const visible = filter === "all"
            ? competitions
            : competitions.filter((c) => c.status === filter);
          return visible.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>⚔</Text>
              <Text style={styles.emptyTitle}>
                {competitions.length === 0
                  ? "NO ACTIVE COMPETITIONS"
                  : `NO ${filter.toUpperCase()} COMPETITIONS`}
              </Text>
              {competitions.length === 0 ? (
                <Text style={styles.emptyHint}>
                  Tap + CREATE above to open a new arena stream
                </Text>
              ) : (
                <TouchableOpacity onPress={() => setFilter("all")} activeOpacity={0.7}>
                  <Text style={styles.showAllTxt}>
                    Show all {competitions.length} competitions →
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <>
              {visible.map((c) => (
                <CompetitionCard
                  key={c.battleId}
                  comp={c}
                  onJoin={() => handleJoin(c.battleId)}
                  publicKey={publicKey}
                  onStarted={loadCompetitions}
                />
              ))}
            </>
          );
        })()}

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.solDots}>
            {([C.purple, C.teal, C.green] as string[]).map((c, i) => (
              <View key={i} style={[styles.dot, { backgroundColor: c }]} />
            ))}
          </View>
          <Text style={styles.footerTxt}>SOLANA DEVNET · POB v1.0</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.bg },
  scroll:  { flex: 1 },
  content: { padding: 20, paddingBottom: 48, gap: 14 },

  section: { gap: 10 },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionLabel: {
    fontFamily: MONO, color: C.textDim,
    fontSize: 9, fontWeight: "800", letterSpacing: 4,
  },
  sectionLine: { flex: 1, height: 1, backgroundColor: C.border },

  rankBtn: {
    borderWidth: 1, borderColor: C.waiting + "60",
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
    backgroundColor: C.waiting + "15",
  },
  rankBtnText: { fontSize: 12 },

  histBtn: {
    borderWidth: 1, borderColor: C.teal + "60",
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
    backgroundColor: C.teal + "15",
  },
  histBtnText: { fontSize: 12 },

  toolsBtn: {
    borderWidth: 1, borderColor: C.border,
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
    backgroundColor: C.bgAccent,
  },
  toolsBtnText: { fontSize: 12 },

  createBtn: {
    borderWidth: 1, borderColor: C.purple + "80",
    borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: C.purple + "22",
  },
  createBtnText: {
    fontFamily: MONO, color: C.purple,
    fontSize: 9, fontWeight: "900", letterSpacing: 2,
  },

  // My Robot card
  robotCard: {
    backgroundColor: C.bgCard, borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
    padding: 16, gap: 12, alignItems: "center",
  },
  robotCardActive: {
    borderColor: C.purple,
    shadowColor: C.purple, shadowOpacity: 0.2,
    shadowRadius: 8, elevation: 4,
  },
  robotTop:   { flexDirection: "row", alignItems: "center", gap: 14, width: "100%" },
  robotName:  { color: C.textPrimary, fontSize: 16, fontFamily: SANS_900, letterSpacing: 2 },
  robotStats: { flexDirection: "row", gap: 8 },
  statChip:   { fontFamily: MONO, fontSize: 10, fontWeight: "700" },
  robotRecord:{ alignItems: "center", gap: 2 },
  recordNum:  { fontFamily: MONO, fontSize: 12, fontWeight: "900" },
  hintText:   { color: C.textDim, fontSize: 12, fontFamily: MONO },
  robotCta:   { fontFamily: MONO, color: C.textDim, fontSize: 9, letterSpacing: 1 },
  forgeBtn:   {
    backgroundColor: C.purple, borderRadius: 8,
    paddingVertical: 10, paddingHorizontal: 24,
  },
  forgeBtnText: { color: "#fff", fontFamily: SANS_900, fontSize: 12, letterSpacing: 2 },

  // Competition card
  compCard: {
    backgroundColor: C.bgCard, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
    padding: 16, gap: 12,
  },
  compTop:     { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  compTitleRow:{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  compName:    { color: C.textPrimary, fontSize: 15, fontFamily: SANS_900, letterSpacing: 1, flex: 1 },
  compLocation:{ fontFamily: MONO, color: C.textDim, fontSize: 10 },
  compTeamName:{ fontFamily: MONO, color: C.purple, fontSize: 10, letterSpacing: 1 },

  teamBadge: {
    borderWidth: 1, borderColor: C.purple + "80",
    borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2,
    backgroundColor: C.purple + "22",
  },
  teamBadgeText: { fontFamily: MONO, color: C.purple, fontSize: 8, fontWeight: "900", letterSpacing: 1 },

  statusChip: { flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 0 },
  staticDot:  { width: 7, height: 7, borderRadius: 3.5 },
  statusTxt:  { fontFamily: MONO, fontSize: 9, fontWeight: "800", letterSpacing: 2 },

  memberRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  memberChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderWidth: 1, borderColor: C.border, borderRadius: 20,
    paddingHorizontal: 9, paddingVertical: 4,
    backgroundColor: C.bgAccent,
  },
  memberAlias: { fontFamily: MONO, color: C.textSecondary, fontSize: 9 },
  memberShare: { fontFamily: MONO, color: C.waiting, fontSize: 9, fontWeight: "700" },

  startBtn: {
    borderRadius: 10, paddingVertical: 12, alignItems: "center",
    borderWidth: 1, borderColor: C.danger + "70",
    backgroundColor: C.danger + "20",
  },
  startBtnText: { fontFamily: MONO, color: C.danger, fontWeight: "900", fontSize: 11, letterSpacing: 3 },
  startErrTxt:  { fontFamily: MONO, color: C.danger, fontSize: 9, textAlign: "center" },

  joinBtn: {
    borderRadius: 10, paddingVertical: 12, alignItems: "center",
    borderWidth: 1,
  },
  joinBtnLive:  { backgroundColor: C.green + "22",  borderColor: C.green + "60"  },
  joinBtnWait:  { backgroundColor: C.purple + "22", borderColor: C.purple + "60" },
  joinBtnEnded: { backgroundColor: C.bgAccent,      borderColor: C.border        },
  joinBtnText:  { fontFamily: MONO, fontWeight: "900", fontSize: 11, letterSpacing: 3 },

  // Filter chips
  filterRow:      { flexDirection: "row", gap: 8, paddingVertical: 2 },
  filterChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderWidth: 1, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  filterChipText: { fontFamily: MONO, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  filterCount:    { fontFamily: MONO, fontSize: 8, fontWeight: "700" },

  // Loading / empty
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 24, justifyContent: "center" },
  loadingTxt: { fontFamily: MONO, color: C.textDim, fontSize: 10, letterSpacing: 2 },
  emptyBox:   { alignItems: "center", paddingVertical: 32, gap: 10 },
  emptyIcon:  { fontSize: 36, opacity: 0.2 },
  emptyTitle: { fontFamily: MONO, color: C.textDim, fontSize: 10, letterSpacing: 4 },
  emptyHint:  { color: C.textDim, fontSize: 11, textAlign: "center", paddingHorizontal: 32 },
  showAllTxt: { fontFamily: MONO, color: C.purple, fontSize: 11, letterSpacing: 1 },

  // Footer
  footer:    { alignItems: "center", paddingTop: 28, gap: 8 },
  solDots:   { flexDirection: "row", gap: 6 },
  dot:       { width: 5, height: 5, borderRadius: 2.5 },
  footerTxt: { fontFamily: MONO, color: C.textDim, fontSize: 9, letterSpacing: 4 },
});
