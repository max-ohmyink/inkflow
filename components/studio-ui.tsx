import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, R } from "@/lib/studio-theme";
import Head from "expo-router/head";

export type StudioTab = "create" | "library" | "settings";
export function StudioHeader({
  status,
  historyCount,
  inHistory,
  onHistory,
  onNew,
}: {
  /** Optional live/offline badge shown beside the brand. */
  status?: React.ReactNode;
  /** Number of designs saved on this device. */
  historyCount: number;
  /** True on the History page, where the button becomes "New design". */
  inHistory: boolean;
  onHistory: () => void;
  onNew: () => void;
}) {
  return (
    <View style={s.header}>
      <Head>
        <title>AI Tattoo</title>
      </Head>
      <View style={s.brand}>
        <Text style={s.brandLabel}>Bloomberg Day 2026</Text>
        {status}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          inHistory
            ? "New design"
            : `History, ${historyCount} saved design${historyCount === 1 ? "" : "s"}`
        }
        onPress={inHistory ? onNew : onHistory}
        style={({ pressed }) => [s.headerButton, pressed && { opacity: 0.8 }]}
      >
        <Feather name={inHistory ? "plus" : "clock"} size={16} color={C.dark} />
        <Text style={s.headerButtonText}>
          {inHistory ? "New design" : "History"}
        </Text>
        {!inHistory && historyCount > 0 && (
          <View style={s.headerBadge}>
            <Text style={s.headerBadgeText}>{historyCount}</Text>
          </View>
        )}
      </Pressable>
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
const s = StyleSheet.create({
  header: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.dark,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    // The brand wraps on narrow screens while the Create pill stays top-right.
    flexWrap: "nowrap",
    gap: 18,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    flexShrink: 1,
  },
  logoField: {
    backgroundColor: C.dark,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  brandDivider: { width: 1, height: 40, backgroundColor: C.dark },
  headerButton: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    backgroundColor: C.white,
    borderColor: C.dark,
    borderWidth: 2,
    borderRadius: R.pill,
  },
  headerButtonText: { fontFamily: F.bold, color: C.dark, fontSize: 14 },
  headerBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: R.pill,
    backgroundColor: C.yellow,
    borderColor: C.dark,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBadgeText: { fontFamily: F.bold, color: C.dark, fontSize: 11 },
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
  step: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  stepNumber: {
    backgroundColor: C.yellow,
    borderColor: C.dark,
    borderWidth: 2,
    borderRadius: R.pill,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberText: { color: C.text, fontSize: 12, fontFamily: F.mono },
  stepTitle: { color: C.text, fontSize: 16, fontFamily: F.bold },
  stepNote: {
    marginLeft: "auto",
    fontFamily: F.body,
    fontSize: 10,
    color: C.muted,
  },
  // Big, rounded "sticker" button that is easy for small hands to hit.
  primary: {
    minHeight: 64,
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: C.yellow,
    borderColor: C.dark,
    borderWidth: 2,
    borderRadius: R.control,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    shadowColor: C.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  primaryText: { color: C.dark, fontSize: 17, fontFamily: F.bold },
  small: {
    minHeight: 46,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderColor: C.dark,
    borderWidth: 2,
    borderRadius: R.pill,
    alignItems: "center",
    flexDirection: "row",
    gap: 9,
    justifyContent: "center",
    backgroundColor: C.white,
  },
  smallText: { color: C.text, fontFamily: F.bold, fontSize: 12 },
});
