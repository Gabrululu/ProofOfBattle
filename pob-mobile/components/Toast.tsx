import { useEffect, useRef, useState } from "react";
import {
  Animated, Text, StyleSheet, View, TouchableOpacity,
} from "react-native";
import { C, MONO, SANS_700, SANS_900 } from "../lib/theme";

export type ToastKind = "success" | "error" | "info";

interface ToastMessage {
  id:   number;
  text: string;
  sub?: string;
  kind: ToastKind;
}

// ── Singleton emitter ─────────────────────────────────────────────────────────
type Listener = (msg: ToastMessage) => void;
const listeners = new Set<Listener>();
let nextId = 0;

export const toast = {
  success: (text: string, sub?: string) =>
    emit({ id: nextId++, text, sub, kind: "success" }),
  error:   (text: string, sub?: string) =>
    emit({ id: nextId++, text, sub, kind: "error" }),
  info:    (text: string, sub?: string) =>
    emit({ id: nextId++, text, sub, kind: "info" }),
};

function emit(msg: ToastMessage) {
  listeners.forEach((fn) => fn(msg));
}

// ── Individual toast item ─────────────────────────────────────────────────────
const KIND_COLOR: Record<ToastKind, string> = {
  success: C.green,
  error:   C.danger,
  info:    C.teal,
};
const KIND_ICON: Record<ToastKind, string> = {
  success: "✓",
  error:   "✕",
  info:    "●",
};

function ToastItem({
  msg,
  onDone,
}: {
  msg: ToastMessage;
  onDone: (id: number) => void;
}) {
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const color      = KIND_COLOR[msg.kind];

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 14, stiffness: 180 }),
      Animated.timing(opacity,   { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    const hide = () =>
      Animated.parallel([
        Animated.timing(translateY, { toValue: -80, duration: 250, useNativeDriver: true }),
        Animated.timing(opacity,    { toValue: 0,   duration: 250, useNativeDriver: true }),
      ]).start(() => onDone(msg.id));

    const t = setTimeout(hide, 3200);
    return () => clearTimeout(t);
  }, []);

  return (
    <Animated.View style={[styles.item, { opacity, transform: [{ translateY }], borderLeftColor: color }]}>
      <View style={[styles.iconBox, { backgroundColor: color + "22" }]}>
        <Text style={[styles.icon, { color }]}>{KIND_ICON[msg.kind]}</Text>
      </View>
      <View style={styles.textBox}>
        <Text style={styles.text} numberOfLines={2}>{msg.text}</Text>
        {msg.sub ? <Text style={styles.sub} numberOfLines={1}>{msg.sub}</Text> : null}
      </View>
    </Animated.View>
  );
}

// ── Container — place once at the top of your render tree ────────────────────
export function ToastContainer() {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const fn: Listener = (msg) =>
      setMessages((prev) => [...prev.slice(-2), msg]); // max 3 visible
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);

  const remove = (id: number) =>
    setMessages((prev) => prev.filter((m) => m.id !== id));

  if (messages.length === 0) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {messages.map((m) => (
        <ToastItem key={m.id} msg={m} onDone={remove} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position:  "absolute",
    top:       56,
    left:      16,
    right:     16,
    zIndex:    9999,
    gap:       8,
    pointerEvents: "none",
  },
  item: {
    flexDirection:   "row",
    alignItems:      "center",
    backgroundColor: C.bgCard,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     C.border,
    borderLeftWidth: 3,
    padding:         14,
    gap:             12,
    shadowColor:     "#000",
    shadowOpacity:   0.5,
    shadowRadius:    12,
    elevation:       12,
  },
  iconBox: {
    width:        32,
    height:       32,
    borderRadius: 8,
    alignItems:   "center",
    justifyContent: "center",
  },
  icon:    { fontSize: 14, fontFamily: SANS_900 },
  textBox: { flex: 1, gap: 2 },
  text:    { color: C.textPrimary, fontSize: 13, fontFamily: SANS_700, lineHeight: 18 },
  sub:     { fontFamily: MONO, color: C.textDim, fontSize: 9.5 },
});
