import { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, ActivityIndicator, RefreshControl,
} from "react-native";
import { Stack } from "expo-router";
import { BRIDGE_BASE_URL } from "../lib/constants";
import { C, MONO } from "../lib/theme";

interface RobotEntry {
  owner: string;
  name: string;
  attack: number;
  defense: number;
  speed: number;
  wins: number;
  losses: number;
  hp: number;
  is_active: boolean;
  categories?: string[];
}

const MEDAL = ["🥇", "🥈", "🥉"];

function StatRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={sty.statRow}>
      <Text style={sty.statLabel}>{label}</Text>
      <View style={sty.barBg}>
        <View style={[sty.barFill, { width: `${value}%` as unknown as number, backgroundColor: color }]} />
      </View>
      <Text style={[sty.statValue, { color }]}>{value}</Text>
    </View>
  );
}

function RobotCard({ entry, rank }: { entry: RobotEntry; rank: number }) {
  const winRate = entry.wins + entry.losses > 0
    ? Math.round((entry.wins / (entry.wins + entry.losses)) * 100)
    : 0;

  const borderColor =
    rank === 0 ? "#B8860B" :
    rank === 1 ? "#888" :
    rank === 2 ? "#8B4513" :
    C.border;

  return (
    <View style={[sty.card, { borderColor }]}>
      {/* Top row: rank + name + record */}
      <View style={sty.cardTop}>
        <Text style={sty.medal}>
          {MEDAL[rank] ?? (
            <Text style={sty.rankNum}>#{rank + 1}</Text>
          )}
        </Text>
        <View style={{ flex: 1, gap: 3 }}>
          <View style={sty.nameRow}>
            <Text style={sty.robotName} numberOfLines={1}>{entry.name}</Text>
            {entry.is_active && (
              <View style={sty.activeBadge}>
                <Text style={sty.activeBadgeText}>ACTIVE</Text>
              </View>
            )}
          </View>
          <Text style={sty.ownerText} numberOfLines={1}>
            {entry.owner.slice(0, 6)}…{entry.owner.slice(-6)}
          </Text>
        </View>
        <View style={sty.record}>
          <View style={sty.recordRow}>
            <Text style={[sty.recordNum, { color: C.green }]}>{entry.wins}</Text>
            <Text style={sty.recordLbl}>W</Text>
            <Text style={[sty.recordNum, { color: C.danger }]}>{entry.losses}</Text>
            <Text style={sty.recordLbl}>L</Text>
          </View>
          <Text style={sty.winRate}>{winRate}%</Text>
        </View>
      </View>

      {/* Stats */}
      <View style={sty.statsBlock}>
        <StatRow label="ATK" value={entry.attack}  color={C.danger}  />
        <StatRow label="DEF" value={entry.defense} color={C.teal}    />
        <StatRow label="SPD" value={entry.speed}   color={C.waiting} />
      </View>

      {/* Categories */}
      {entry.categories && entry.categories.length > 0 && (
        <View style={sty.catRow}>
          {entry.categories.map((cat) => (
            <View key={cat} style={sty.catChip}>
              <Text style={sty.catChipText}>{cat}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default function LeaderboardScreen() {
  const [entries, setEntries] = useState<RobotEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const resp = await fetch(`${BRIDGE_BASE_URL}/api/leaderboard`);
      if (resp.ok) setEntries(await resp.json());
    } catch {
      /* bridge offline */
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 15_000);
    return () => clearInterval(id);
  }, [fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  return (
    <SafeAreaView style={sty.safe}>
      <Stack.Screen options={{ title: "LEADERBOARD" }} />

      <ScrollView
        style={sty.scroll}
        contentContainerStyle={sty.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.purple} />
        }
      >
        {loading ? (
          <View style={sty.centerBox}>
            <ActivityIndicator color={C.purple} />
            <Text style={sty.loadingTxt}>LOADING RANKINGS…</Text>
          </View>
        ) : entries.length === 0 ? (
          <View style={sty.centerBox}>
            <Text style={sty.emptyIcon}>🏆</Text>
            <Text style={sty.emptyTitle}>NO ROBOTS YET</Text>
            <Text style={sty.emptyHint}>
              Register your robot to appear in the rankings.
            </Text>
          </View>
        ) : (
          <>
            <View style={sty.headerRow}>
              <Text style={sty.headerLabel}>RANK</Text>
              <View style={sty.headerLine} />
              <Text style={sty.headerCount}>{entries.length} ROBOTS</Text>
            </View>
            {entries.map((e, idx) => (
              <RobotCard key={e.owner} entry={e} rank={idx} />
            ))}
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const sty = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.bg },
  scroll:  { flex: 1 },
  content: { padding: 16, gap: 10, paddingBottom: 48 },

  centerBox: { alignItems: "center", paddingTop: 64, gap: 12 },
  loadingTxt: { fontFamily: MONO, color: C.textDim, fontSize: 10, letterSpacing: 3 },
  emptyIcon:  { fontSize: 40, opacity: 0.3 },
  emptyTitle: { fontFamily: MONO, color: C.textDim, fontSize: 11, letterSpacing: 4 },
  emptyHint:  { color: C.textDim, fontSize: 12, textAlign: "center", paddingHorizontal: 32 },

  headerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  headerLabel: { fontFamily: MONO, color: C.textDim, fontSize: 9, fontWeight: "800", letterSpacing: 4 },
  headerLine:  { flex: 1, height: 1, backgroundColor: C.border },
  headerCount: { fontFamily: MONO, color: C.textDim, fontSize: 9, letterSpacing: 2 },

  card: {
    backgroundColor: C.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },

  cardTop:   { flexDirection: "row", alignItems: "center", gap: 10 },
  medal:     { fontSize: 22, width: 32, textAlign: "center" },
  rankNum:   { fontFamily: MONO, color: C.textDim, fontSize: 13, fontWeight: "900" },
  nameRow:   { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  robotName: { color: C.textPrimary, fontSize: 15, fontWeight: "900", letterSpacing: 1.5, flex: 1 },
  ownerText: { fontFamily: MONO, color: C.textDim, fontSize: 9 },

  activeBadge: {
    borderWidth: 1, borderColor: C.green + "80",
    borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2,
    backgroundColor: C.green + "20",
  },
  activeBadgeText: { fontFamily: MONO, color: C.green, fontSize: 7, fontWeight: "900", letterSpacing: 1 },

  record:    { alignItems: "flex-end", gap: 2 },
  recordRow: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  recordNum: { fontFamily: MONO, fontSize: 18, fontWeight: "900" },
  recordLbl: { fontFamily: MONO, color: C.textDim, fontSize: 9 },
  winRate:   { fontFamily: MONO, color: C.textDim, fontSize: 9 },

  statsBlock: { gap: 6 },
  statRow:    { flexDirection: "row", alignItems: "center", gap: 8 },
  statLabel:  { fontFamily: MONO, color: C.textDim, fontSize: 9, width: 24, letterSpacing: 1 },
  barBg:      { flex: 1, height: 5, backgroundColor: C.bgAccent, borderRadius: 3, overflow: "hidden" },
  barFill:    { height: "100%", borderRadius: 3 },
  statValue:  { fontFamily: MONO, fontSize: 10, fontWeight: "700", width: 24, textAlign: "right" },

  catRow:    { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  catChip: {
    borderWidth: 1, borderColor: C.purple + "60",
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: C.purple + "15",
  },
  catChipText: { fontFamily: MONO, color: C.purple, fontSize: 8, fontWeight: "700", letterSpacing: 0.5 },
});
