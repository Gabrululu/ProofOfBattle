import { useState, useCallback, useEffect } from "react";
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from "react-native";
import { useRouter, Href } from "expo-router";
import { useWallet } from "../hooks/useWallet";
import { BRIDGE_BASE_URL } from "../lib/constants";
import { C, MONO, SANS_900 } from "../lib/theme";

type BattleRecord = {
  battle_id: number;
  name: string;
  location: string;
  status: "waiting" | "active" | "finished";
  robot_a_name: string;
  robot_b_name: string;
  robot_a_attack?: number;
  robot_a_defense?: number;
  robot_a_speed?: number;
  robot_b_attack?: number;
  robot_b_defense?: number;
  robot_b_speed?: number;
};

const STATUS_COLOR: Record<string, string> = {
  active:   C.live,
  waiting:  C.waiting,
  finished: C.finished,
};
const STATUS_LABEL: Record<string, string> = {
  active:   "LIVE",
  waiting:  "WAITING",
  finished: "ENDED",
};

export default function HistoryScreen() {
  const router = useRouter();
  const { publicKey } = useWallet();
  const [battles, setBattles] = useState<BattleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!publicKey) return;
    setLoading(true);
    try {
      const resp = await fetch(
        `${BRIDGE_BASE_URL}/api/battles/history/${publicKey.toBase58()}`
      );
      if (resp.ok) {
        const data: BattleRecord[] = await resp.json();
        setBattles(data);
      }
    } catch {
      /* bridge offline */
    }
    setLoading(false);
    setRefreshing(false);
  }, [publicKey]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory();
  };

  if (!publicKey) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>📜</Text>
          <Text style={styles.emptyTitle}>CONNECT WALLET{"\n"}TO VIEW HISTORY</Text>
        </View>
      </SafeAreaView>
    );
  }

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
        {loading && !refreshing ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={C.purple} size="small" />
            <Text style={styles.loadingTxt}>LOADING…</Text>
          </View>
        ) : battles.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>📜</Text>
            <Text style={styles.emptyTitle}>NO BATTLES YET</Text>
            <Text style={styles.emptyHint}>
              Create a competition to start your battle history
            </Text>
          </View>
        ) : (
          battles.map((b) => {
            const statusClr = STATUS_COLOR[b.status] ?? C.textDim;
            const statusLbl = STATUS_LABEL[b.status] ?? b.status.toUpperCase();
            const canView   = b.status !== "waiting";
            return (
              <View key={b.battle_id} style={styles.card}>
                {/* Top row */}
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardName} numberOfLines={1}>{b.name}</Text>
                    <Text style={styles.cardLocation}>
                      📍 {b.location} · ID {b.battle_id}
                    </Text>
                  </View>
                  <View style={[styles.statusChip, { borderColor: statusClr + "60" }]}>
                    <Text style={[styles.statusTxt, { color: statusClr }]}>
                      {statusLbl}
                    </Text>
                  </View>
                </View>

                {/* Combatants */}
                <View style={styles.vsRow}>
                  <Text style={styles.vsNameA} numberOfLines={1}>{b.robot_a_name}</Text>
                  <Text style={styles.vsLabel}>VS</Text>
                  <Text style={styles.vsNameB} numberOfLines={1}>{b.robot_b_name}</Text>
                </View>

                {/* Stats */}
                {b.robot_a_attack != null && (
                  <View style={styles.statsRow}>
                    <Text style={[styles.statsTxt, { color: C.robotA + "99" }]}>
                      A: {b.robot_a_attack}·{b.robot_a_defense}·{b.robot_a_speed}
                    </Text>
                    <Text style={[styles.statsTxt, { color: C.robotB + "99" }]}>
                      B: {b.robot_b_attack}·{b.robot_b_defense}·{b.robot_b_speed}
                    </Text>
                  </View>
                )}

                {/* View button */}
                <TouchableOpacity
                  style={[
                    styles.viewBtn,
                    b.status === "active"   ? styles.viewBtnLive  :
                    b.status === "finished" ? styles.viewBtnEnded :
                    styles.viewBtnWait,
                  ]}
                  onPress={() =>
                    router.push({
                      pathname: "/battle/[id]",
                      params: { id: b.battle_id },
                    } as Href)
                  }
                  disabled={!canView}
                  activeOpacity={0.8}
                >
                  <Text style={[
                    styles.viewBtnText,
                    {
                      color: b.status === "active"   ? C.green   :
                             b.status === "finished" ? C.textDim :
                             C.border,
                    },
                  ]}>
                    {b.status === "active"   ? "▶ JOIN LIVE"    :
                     b.status === "finished" ? "◎ VIEW REPLAY"  :
                     "◎ NOT STARTED"}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.bg },
  scroll:  { flex: 1 },
  content: { padding: 20, paddingBottom: 48, gap: 12 },

  loadingRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 40, justifyContent: "center",
  },
  loadingTxt: { fontFamily: MONO, color: C.textDim, fontSize: 10, letterSpacing: 2 },

  emptyBox: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingVertical: 80, gap: 12,
  },
  emptyIcon:  { fontSize: 48, opacity: 0.2 },
  emptyTitle: {
    fontFamily: MONO, color: C.textDim,
    fontSize: 11, letterSpacing: 4, textAlign: "center",
  },
  emptyHint: {
    color: C.textDim, fontSize: 11,
    textAlign: "center", paddingHorizontal: 32,
  },

  card: {
    backgroundColor: C.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    gap: 10,
  },
  cardTop:     { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  cardName:    { color: C.textPrimary, fontSize: 14, fontFamily: SANS_900, letterSpacing: 1 },
  cardLocation:{ fontFamily: MONO, color: C.textDim, fontSize: 9, marginTop: 2 },

  statusChip: {
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  statusTxt: { fontFamily: MONO, fontSize: 8, fontWeight: "800", letterSpacing: 2 },

  vsRow:   { flexDirection: "row", alignItems: "center", gap: 8 },
  vsNameA: {
    flex: 1, fontFamily: MONO,
    color: C.robotA, fontSize: 10, fontWeight: "700",
  },
  vsLabel: {
    fontFamily: MONO, color: C.textDim,
    fontSize: 8, letterSpacing: 2,
  },
  vsNameB: {
    flex: 1, fontFamily: MONO,
    color: C.robotB, fontSize: 10, fontWeight: "700",
    textAlign: "right",
  },

  statsRow: { flexDirection: "row", gap: 16 },
  statsTxt: { fontFamily: MONO, fontSize: 9 },

  viewBtn: {
    borderRadius: 10, paddingVertical: 10,
    alignItems: "center", borderWidth: 1,
  },
  viewBtnLive:  { backgroundColor: C.green  + "15", borderColor: C.green  + "50" },
  viewBtnEnded: { backgroundColor: C.bgAccent,      borderColor: C.border        },
  viewBtnWait:  { backgroundColor: C.bgAccent,      borderColor: C.border        },
  viewBtnText:  { fontFamily: MONO, fontWeight: "900", fontSize: 10, letterSpacing: 2 },
});
