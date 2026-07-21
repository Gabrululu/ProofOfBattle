import { View, Text, StyleSheet } from "react-native";
import { C, MONO, SANS_900 } from "../lib/theme";

interface Props {
  label: string;
  hp: number;
  color: string;
  align?: "left" | "right";
}

export function HPBar({ label, hp, color, align = "left" }: Props) {
  const pct   = Math.max(0, Math.min(100, hp));
  const isLow = pct <= 25;
  const barColor = isLow ? C.danger : color;
  const filled = Math.round(pct / 10);   // 0–10 segments

  return (
    <View style={[styles.wrap, align === "right" && styles.wrapRight]}>

      {/* Label row */}
      <View style={[styles.labelRow, align === "right" && styles.labelRowRight]}>
        <Text style={[styles.label, { color }]}>{label}</Text>
        <Text style={[styles.hpVal, { color: isLow ? C.danger : C.textSecondary }]}>
          {String(hp).padStart(3, "0")} HP
        </Text>
      </View>

      {/* Segmented bar — terminal block characters */}
      <View style={[styles.bar, align === "right" && styles.barRight]}>
        {Array.from({ length: 10 }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.seg,
              {
                backgroundColor: i < filled ? barColor : "transparent",
                borderColor:     i < filled ? barColor : C.border,
                shadowColor:     barColor,
                shadowOpacity:   i < filled ? 0.55 : 0,
                shadowRadius:    4,
              },
            ]}
          />
        ))}
      </View>

      {/* Terminal readout */}
      <Text style={[styles.readout, align === "right" && styles.readoutRight]}>
        {barColor === C.danger ? "! LOW INTEGRITY" : `${pct}%`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:          { flex: 1 },
  wrapRight:     { alignItems: "flex-end" },

  labelRow:      { flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
  labelRowRight: { flexDirection: "row-reverse" },

  label: { fontSize: 9, fontFamily: SANS_900, letterSpacing: 3 },
  hpVal: { fontFamily: MONO, fontSize: 11, fontWeight: "700" },

  bar:      { flexDirection: "row", gap: 2 },
  barRight: { flexDirection: "row-reverse" },

  seg: {
    flex:         1,
    height:       10,
    borderRadius: 1,
    borderWidth:  1,
  },

  readout:      { fontFamily: MONO, color: C.textDim, fontSize: 8, marginTop: 3, letterSpacing: 1 },
  readoutRight: { textAlign: "right" },
});
