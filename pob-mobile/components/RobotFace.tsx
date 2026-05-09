import { useEffect, useRef } from "react";
import { Animated, View, Text, StyleSheet } from "react-native";
import { C } from "../lib/theme";

interface Props {
  size?: number;
  primaryColor?: string;
  accentColor?: string;
  label?: string;
  animated?: boolean;
}

export function RobotFace({
  size = 80,
  primaryColor = C.purple,
  accentColor = C.green,
  label,
  animated: shouldAnimate = false,
}: Props) {
  const eyeOpacity = useRef(new Animated.Value(1)).current;
  const antOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!shouldAnimate) return;

    Animated.loop(
      Animated.sequence([
        Animated.timing(eyeOpacity, { toValue: 0.35, duration: 850, useNativeDriver: true }),
        Animated.timing(eyeOpacity, { toValue: 1,    duration: 850, useNativeDriver: true }),
        Animated.delay(300),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(antOpacity, { toValue: 0.4,  duration: 600, useNativeDriver: true }),
        Animated.timing(antOpacity, { toValue: 1,    duration: 600, useNativeDriver: true }),
        Animated.delay(1200),
      ])
    ).start();
  }, [shouldAnimate]);

  const s = size;

  return (
    <View style={{ alignItems: "center" }}>

      {/* ── Antenna ────────────────────────────────── */}
      <Animated.View style={[
        styles.antennaTip,
        {
          width:  s * 0.10,
          height: s * 0.10,
          borderRadius: 2,
          backgroundColor: primaryColor,
          opacity: antOpacity,
          shadowColor: primaryColor,
        },
      ]} />
      <View style={{
        width: 2,
        height: s * 0.20,
        backgroundColor: primaryColor,
        opacity: 0.6,
        marginBottom: -1,
      }} />

      {/* ── Head ───────────────────────────────────── */}
      <View style={[
        styles.head,
        {
          width:  s,
          height: s * 0.88,
          borderRadius: s * 0.09,
          borderColor: primaryColor,
          shadowColor: primaryColor,
        },
      ]}>

        {/* Top circuit line */}
        <View style={[
          styles.circuitLine,
          {
            backgroundColor: primaryColor,
            marginTop: s * 0.09,
            marginHorizontal: s * 0.08,
            opacity: 0.45,
          },
        ]} />

        {/* Eyes */}
        <View style={{
          flexDirection: "row",
          justifyContent: "space-between",
          paddingHorizontal: s * 0.11,
          marginTop: s * 0.09,
        }}>
          {[0, 1].map((i) => (
            <Animated.View key={i} style={[
              styles.eye,
              {
                width:  s * 0.24,
                height: s * 0.15,
                backgroundColor: primaryColor,
                opacity: eyeOpacity,
                shadowColor: primaryColor,
              },
            ]} />
          ))}
        </View>

        {/* Nose sensor */}
        <View style={{ alignItems: "center", marginTop: s * 0.07 }}>
          <View style={{
            width:  s * 0.09,
            height: s * 0.06,
            backgroundColor: accentColor,
            borderRadius: 1,
            opacity: 0.75,
          }} />
        </View>

        {/* Mouth grille — 3 horizontal lines */}
        <View style={{
          marginTop: s * 0.07,
          paddingHorizontal: s * 0.1,
          gap: 3,
        }}>
          {([1, 0.55, 0.28] as number[]).map((op, i) => (
            <View key={i} style={{
              height: 1.5,
              backgroundColor: accentColor,
              opacity: op,
              borderRadius: 1,
            }} />
          ))}
        </View>

        {/* Bottom accent line */}
        <View style={[
          styles.circuitLine,
          {
            position: "absolute",
            bottom: s * 0.09,
            left: s * 0.08,
            right: s * 0.08,
            backgroundColor: primaryColor,
            opacity: 0.3,
          },
        ]} />
      </View>

      {/* Robot label */}
      {label ? (
        <Text style={[
          styles.label,
          { color: primaryColor, fontSize: s * 0.16, marginTop: s * 0.08 },
        ]}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  antennaTip: {
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 6,
    marginBottom: 0,
  },
  head: {
    backgroundColor: C.bgCard,
    borderWidth: 1.5,
    overflow: "hidden",
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  circuitLine: {
    height: 1.5,
    borderRadius: 1,
  },
  eye: {
    borderRadius: 2,
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 6,
  },
  label: {
    fontWeight: "900",
    letterSpacing: 4,
  },
});
