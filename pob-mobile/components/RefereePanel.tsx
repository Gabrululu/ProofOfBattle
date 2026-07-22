import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { BRIDGE_BASE_URL } from "../lib/constants";
import { toast } from "./Toast";
import { C, MONO, SANS_900 } from "../lib/theme";

interface Props {
  battleId: number;
  creator: string;
  nameA: string;
  nameB: string;
}

// Shown only to the competition's creator when mode === "physical". Reports
// damage / declares the winner via the bridge, which relays it over the same
// arena WebSocket an online (Webots-driven) battle would use.
export function RefereePanel({ battleId, creator, nameA, nameB }: Props) {
  const [damage, setDamage] = useState("10");
  const [loading, setLoading] = useState<"a" | "b" | "resolve" | null>(null);

  const reportHit = async (side: 0 | 1) => {
    setLoading(side === 0 ? "a" : "b");
    try {
      const resp = await fetch(`${BRIDGE_BASE_URL}/api/competition/${battleId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creator, side, damage: parseInt(damage) || 10 }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    } catch (e: unknown) {
      toast.error("Report failed", e instanceof Error ? e.message : "Bridge unreachable.");
    } finally {
      setLoading(null);
    }
  };

  const declareWinner = async (winner: 0 | 1) => {
    setLoading("resolve");
    try {
      const resp = await fetch(`${BRIDGE_BASE_URL}/api/competition/${battleId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creator, winner }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    } catch (e: unknown) {
      toast.error("Resolve failed", e instanceof Error ? e.message : "Bridge unreachable.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <View style={sty.panel}>
      <Text style={sty.title}>REFEREE PANEL</Text>

      <View style={sty.damageRow}>
        <Text style={sty.damageLabel}>DAMAGE</Text>
        <TextInput
          style={sty.damageInput}
          value={damage}
          onChangeText={setDamage}
          keyboardType="number-pad"
          maxLength={3}
        />
      </View>

      <View style={sty.row}>
        <TouchableOpacity style={[sty.btn, { borderColor: C.robotA }]} onPress={() => reportHit(0)} disabled={loading !== null}>
          {loading === "a" ? <ActivityIndicator color={C.robotA} size="small" /> : <Text style={[sty.btnText, { color: C.robotA }]}>HIT {nameA}</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={[sty.btn, { borderColor: C.robotB }]} onPress={() => reportHit(1)} disabled={loading !== null}>
          {loading === "b" ? <ActivityIndicator color={C.robotB} size="small" /> : <Text style={[sty.btnText, { color: C.robotB }]}>HIT {nameB}</Text>}
        </TouchableOpacity>
      </View>

      <View style={sty.row}>
        <TouchableOpacity style={[sty.btn, { borderColor: C.green }]} onPress={() => declareWinner(0)} disabled={loading !== null}>
          {loading === "resolve" ? <ActivityIndicator color={C.green} size="small" /> : <Text style={[sty.btnText, { color: C.green }]}>{nameA} WINS</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={[sty.btn, { borderColor: C.green }]} onPress={() => declareWinner(1)} disabled={loading !== null}>
          {loading === "resolve" ? <ActivityIndicator color={C.green} size="small" /> : <Text style={[sty.btnText, { color: C.green }]}>{nameB} WINS</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const sty = StyleSheet.create({
  panel: {
    backgroundColor: C.bgCard, borderRadius: 14,
    borderWidth: 1, borderColor: C.waiting + "60", padding: 16, gap: 12,
  },
  title: { fontFamily: MONO, color: C.waiting, fontSize: 11, fontWeight: "900", letterSpacing: 3 },
  damageRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  damageLabel: { fontFamily: MONO, color: C.textDim, fontSize: 9, letterSpacing: 1 },
  damageInput: {
    width: 56, backgroundColor: C.bg, borderRadius: 8, borderWidth: 1,
    borderColor: C.border, padding: 8, color: C.textPrimary,
    fontFamily: MONO, fontSize: 13, textAlign: "center",
  },
  row: { flexDirection: "row", gap: 8 },
  btn: {
    flex: 1, borderWidth: 1, borderRadius: 10,
    paddingVertical: 12, alignItems: "center", backgroundColor: C.bg,
  },
  btnText: { fontFamily: SANS_900, fontSize: 10, letterSpacing: 1 },
});
