import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { C, MONO, SANS_900 } from "../lib/theme";

type ResourceLink = { icon: string; title: string; desc: string; url: string };

const SECTIONS: { label: string; items: ResourceLink[] }[] = [
  {
    label: "GETTING STARTED",
    items: [
      {
        icon: "🧭",
        title: "RobotCombatWiki — Getting Started",
        desc: "Beginner-friendly hub covering weight classes, weapon types, and your first build.",
        url: "https://robotcombatwiki.com/wiki/GettingStarted",
      },
      {
        icon: "🔧",
        title: "SparkFun — How to Build a Combat Robot",
        desc: "Classic build guide, from insect-class antweights up to heavier weight classes.",
        url: "https://news.sparkfun.com/2763",
      },
    ],
  },
  {
    label: "CALCULATORS & TOOLS",
    items: [
      {
        icon: "📐",
        title: "RobotCombatWiki — Online Tools",
        desc: "Drivetrain, weapon and LiPo calculators used across the combat robotics community.",
        url: "https://robotcombatwiki.com/wiki/OnlineTools",
      },
      {
        icon: "🌀",
        title: "SpinCalc — Spinner Kinetic Energy Calculator",
        desc: "Estimate weapon mass, MOI and spin-up time — good inspiration for tuning ATK.",
        url: "https://runamok.tech/AskAaron/tools.html",
      },
      {
        icon: "⚙️",
        title: "Just 'Cuz Robotics — Spinner Calculator",
        desc: "Motors, ESCs and tip-speed math for weapon builds.",
        url: "https://justcuzrobotics.com/pages/spinner-calculator-combined",
      },
      {
        icon: "🧮",
        title: "Combat Robotics NZ — Tools & Calculators",
        desc: "Drivetrain speed and pushing-power calculators — a good reference for balancing DEF vs. SPD.",
        url: "https://combatrobotics.co.nz/pages/tools-calculators",
      },
    ],
  },
  {
    label: "COMMUNITY",
    items: [
      {
        icon: "💬",
        title: "Robot Fighting — Forum Guide",
        desc: "Directory of active combat robotics forums and communities to swap build notes.",
        url: "https://www.robotfighting.org/robot-fighting-forum/",
      },
    ],
  },
];

function ResourceCard({ item }: { item: ResourceLink }) {
  return (
    <TouchableOpacity
      style={sty.card}
      onPress={() => Linking.openURL(item.url)}
      activeOpacity={0.75}
    >
      <Text style={sty.cardIcon}>{item.icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={sty.cardTitle}>{item.title}</Text>
        <Text style={sty.cardDesc}>{item.desc}</Text>
      </View>
      <Text style={sty.cardArrow}>↗</Text>
    </TouchableOpacity>
  );
}

export default function ResourcesScreen() {
  return (
    <SafeAreaView style={sty.safe}>
      <Stack.Screen options={{ title: "BUILDER RESOURCES" }} />
      <ScrollView contentContainerStyle={sty.content}>
        <Text style={sty.intro}>
          Real tools used by combat-robot builders — for inspiration when you tune
          your fighter's ATK / DEF / SPD in Proof of Battle.
        </Text>

        {SECTIONS.map((section) => (
          <View key={section.label} style={sty.section}>
            <Text style={sty.sectionLabel}>{section.label}</Text>
            {section.items.map((item) => (
              <ResourceCard key={item.url} item={item} />
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const sty = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.bg },
  content: { padding: 20, gap: 20, paddingBottom: 48 },

  intro: { color: C.textSecondary, fontSize: 12, lineHeight: 18 },

  section:      { gap: 8 },
  sectionLabel: { fontFamily: MONO, color: C.textDim, fontSize: 9, fontWeight: "800", letterSpacing: 3 },

  card: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.bgCard, borderRadius: 12, borderWidth: 1, borderColor: C.border,
    padding: 14,
  },
  cardIcon:  { fontSize: 20 },
  cardTitle: { color: C.textPrimary, fontFamily: SANS_900, fontSize: 12, letterSpacing: 0.5 },
  cardDesc:  { color: C.textDim, fontSize: 10, marginTop: 2, lineHeight: 14 },
  cardArrow: { color: C.textDim, fontSize: 14 },
});
