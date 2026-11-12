import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F } from "@/lib/studio-theme";
import Head from "expo-router/head";

export type StudioTab = "create" | "library" | "settings";
export function StudioHeader({
  tab,
  onTab,
  wide,
}: {
  tab: StudioTab;
  onTab: (tab: StudioTab) => void;
  wide: boolean;
}) {
  return (
    <View style={[s.header, !wide && { flexWrap: "wrap", gap: 18 }]}>
      <Head>
        <title>Oh My Ink - Live AI Tattoo Experience</title>
      </Head>
      <View style={s.brand}>
        <View style={s.logoField}>
          <Image
            source={require("@/assets/brand/ohmyink-logo.png")}
            accessibilityLabel="Oh My Ink"
            style={{ width: wide ? 146 : 122, height: 42 }}
            resizeMode="contain"
          />
        </View>
        <View style={s.brandDivider} />
        <View style={{ flexShrink: 1, maxWidth: 230 }}>
          <Text style={s.brandLabel}>Bloomberg Day 2026</Text>
          <Text style={s.brandSub}>OH MY INK · LIVE TATTOO EXPERIENCE</Text>
        </View>
      </View>
      <View style={[s.nav, !wide && { width: "100%" }]}>
        {(["create", "library", "settings"] as StudioTab[]).map((item) => (
          <Pressable
            key={item}
            onPress={() => onTab(item)}
            accessibilityRole="tab"
            accessibilityState={{ selected: item === tab }}
            style={({ pressed }) => [
              s.navItem,
              item === tab && s.navActive,
              !wide && { flex: 1, paddingHorizontal: 8 },
              pressed && { opacity: 0.75 },
            ]}
          >
            <Feather
              name={
                item === "create"
                  ? "edit-3"
                  : item === "library"
                    ? "grid"
                    : "sliders"
              }
              size={15}
              color={C.text}
            />
            <Text style={s.navText}>
              {item === "create"
                ? "Create"
                : item === "library"
                  ? "My designs"
                  : "Artist settings"}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
export function StepLabel({
  number,
  title,
  note,
}: {
  number: string;
  title: string;
  note?: string;
}) {
  return (
    <View style={s.step}>
      <View style={s.stepNumber}>
        <Text style={s.stepNumberText}>{number}</Text>
      </View>
      <Text style={s.stepTitle}>{title}</Text>
      {note && <Text style={s.stepNote}>{note}</Text>}
    </View>
  );
}
export function PrimaryButton({
  text,
  onPress,
  disabled,
  icon = "arrow-right",
}: {
  text: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Feather>["name"];
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.primary,
        disabled && { opacity: 0.45 },
        pressed &&
          !disabled && { opacity: 0.85, transform: [{ scale: 0.995 }] },
      ]}
    >
      <Text style={s.primaryText}>{text}</Text>
      <Feather name={icon} size={20} color={C.dark} />
    </Pressable>
  );
}
export function SmallButton({
  text,
  onPress,
  icon,
}: {
  text: string;
  onPress: () => void;
  icon?: React.ComponentProps<typeof Feather>["name"];
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        s.small,
        pressed && { backgroundColor: C.cream },
      ]}
    >
      {icon && <Feather name={icon} size={15} color={C.text} />}
      <Text style={s.smallText}>{text}</Text>
    </Pressable>
  );
}
export function StudioFooter() {
  return (
    <View style={s.footer}>
      <Text style={s.footerText}>TOGETHER, MAKE YOUR MARK.</Text>
      <Text style={s.footerRight}>Oh My Ink - Live AI Tattoo Experience</Text>
    </View>
  );
}
const s = StyleSheet.create({
  header: {
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: C.dark,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 18,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 16, flexShrink: 1 },
  logoField: {
    backgroundColor: C.dark,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  brandDivider: { width: 1, height: 40, backgroundColor: C.dark },
  brandLabel: {
    fontFamily: F.heading,
    color: C.text,
    fontSize: 21,
    lineHeight: 27,
  },
  brandSub: {
    color: C.muted,
    fontFamily: F.mono,
    fontSize: 8,
    letterSpacing: 1.25,
    marginTop: 5,
    lineHeight: 14,
  },
  nav: { flexDirection: "row", gap: 4 },
  navItem: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "transparent",
  },
  navActive: { backgroundColor: C.yellow, borderColor: C.dark },
  navText: { color: C.text, fontFamily: F.bold, fontSize: 12 },
  step: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  stepNumber: {
    backgroundColor: C.pink,
    borderColor: C.dark,
    borderWidth: 1,
    borderRadius: 3,
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberText: { color: C.text, fontSize: 12, fontFamily: F.mono },
  stepTitle: { color: C.text, fontSize: 15, fontFamily: F.bold },
  stepNote: {
    marginLeft: "auto",
    fontFamily: F.body,
    fontSize: 10,
    color: C.muted,
  },
  primary: {
    minHeight: 58,
    paddingHorizontal: 22,
    paddingVertical: 16,
    backgroundColor: C.yellow,
    borderColor: C.dark,
    borderWidth: 1,
    borderRadius: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  },
  primaryText: { color: C.dark, fontSize: 15, fontFamily: F.bold },
  small: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderColor: C.dark,
    borderWidth: 1,
    borderRadius: 4,
    alignItems: "center",
    flexDirection: "row",
    gap: 9,
    justifyContent: "center",
    backgroundColor: C.white,
  },
  smallText: { color: C.text, fontFamily: F.bold, fontSize: 12 },
  footer: {
    borderTopWidth: 1,
    borderTopColor: C.dark,
    paddingVertical: 26,
    marginTop: 28,
    gap: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  footerText: {
    color: C.text,
    fontSize: 10,
    letterSpacing: 1.75,
    fontFamily: F.mono,
  },
  footerRight: { color: C.muted, fontFamily: F.body, fontSize: 10 },
});
