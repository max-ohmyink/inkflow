import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F } from "@/lib/studio-theme";
import { PrimaryButton } from "./studio-ui";
import { isTattooInkId, tattooInkDisplayHex } from "../shared/tattoo-inks";

type Ink = { id: string; name: string; hex: string };
function displayInkHex(ink: Ink): string {
  return isTattooInkId(ink.id) ? tattooInkDisplayHex(ink.id) : ink.hex;
}
export function TattooInkPicker({
  inks,
  selected,
  onChange,
  legacyLabel,
}: {
  inks: readonly Ink[];
  selected: readonly string[];
  onChange: (ids: string[]) => void;
  legacyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const chosen = inks.filter((ink) => selected.includes(ink.id));
  const summary = chosen.length
    ? chosen.map((ink) => ink.name).join(" + ")
    : legacyLabel || "Original colors";
  const toggle = (id: string) => {
    if (selected.includes(id))
      onChange(selected.filter((value) => value !== id));
    else if (selected.length < 3) onChange([...selected, id]);
  };
  return (
    <View>
      <Text style={s.label}>Color mix</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Choose tattoo inks: ${summary}`}
        onPress={() => setOpen(true)}
        style={s.control}
      >
        <View style={{ flex: 1, gap: 8 }}>
          <View style={{ flexDirection: "row", gap: 5 }}>
            {(chosen.length
              ? chosen
              : [{ id: "original", name: "Original", hex: C.dark }]
            ).map((ink) => (
              <View
                key={ink.id}
                style={[s.dot, { backgroundColor: displayInkHex(ink) }]}
              />
            ))}
          </View>
          <Text numberOfLines={2} style={s.value}>
            {summary}
          </Text>
        </View>
        <Feather name="chevron-down" size={16} color={C.text} />
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={s.backdrop}>
          <View style={s.dialog} accessibilityViewIsModal>
            <View style={s.top}>
              <View style={{ flex: 1 }}>
                <Text style={s.title}>Choose your tattoo inks</Text>
                <Text style={s.copy}>
                  Pick up to 3 colors. Simple lines stay clear.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close ink choices"
                onPress={() => setOpen(false)}
                style={s.close}
              >
                <Feather name="x" size={22} color={C.text} />
              </Pressable>
            </View>
            <ScrollView
              style={{ maxHeight: 430 }}
              contentContainerStyle={{ gap: 18, paddingBottom: 8 }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityState={{
                  selected: !selected.length && !legacyLabel,
                }}
                onPress={() => onChange([])}
                style={[
                  s.original,
                  !selected.length &&
                    !legacyLabel && { backgroundColor: C.yellow },
                ]}
              >
                <Feather name="image" size={17} color={C.text} />
                <Text style={s.originalText}>Keep original colors</Text>
                <Feather
                  name={
                    !selected.length && !legacyLabel ? "check-circle" : "circle"
                  }
                  size={18}
                  color={C.text}
                />
              </Pressable>
              <View style={s.grid}>
                {inks.map((ink) => {
                  const active = selected.includes(ink.id);
                  const limited = selected.length >= 3 && !active;
                  return (
                    <Pressable
                      key={ink.id}
                      accessibilityRole="checkbox"
                      accessibilityLabel={ink.name}
                      accessibilityState={{
                        checked: active,
                        disabled: limited,
                      }}
                      disabled={limited}
                      onPress={() => toggle(ink.id)}
                      style={[
                        s.swatch,
                        active && {
                          backgroundColor: C.cream,
                          borderColor: C.dark,
                        },
                        limited && { opacity: 0.5 },
                      ]}
                    >
                      <View
                        style={[
                          s.largeDot,
                          { backgroundColor: displayInkHex(ink) },
                        ]}
                      >
                        {active && (
                          <View style={s.check}>
                            <Feather name="check" size={10} color={C.dark} />
                          </View>
                        )}
                      </View>
                      <Text style={s.name}>{ink.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text accessibilityLiveRegion="polite" style={s.copy}>
                {selected.length === 3
                  ? "Three inks chosen. Remove one to choose another."
                  : `${selected.length} of 3 inks selected.`}
              </Text>
              <Text style={s.note}>
                Brighter screen colors are used for digital previews. Physical
                inks may look different; our artist can confirm the real colors.
                Original photographed reference values are kept separately.
              </Text>
            </ScrollView>
            <PrimaryButton
              text="Use these colors"
              onPress={() => setOpen(false)}
              icon="check"
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
export function RequestedInkSummary({
  inks,
  selected,
}: {
  inks: readonly Ink[];
  selected?: readonly string[];
}) {
  const chosen = inks.filter((ink) => selected?.includes(ink.id));
  if (!chosen.length) return null;
  return (
    <View style={s.receipt}>
      <Text style={s.receiptLabel}>REQUESTED TATTOO INKS</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
        {chosen.map((ink) => (
          <View
            key={ink.id}
            style={{ flexDirection: "row", alignItems: "center", gap: 7 }}
          >
            <View style={[s.dot, { backgroundColor: displayInkHex(ink) }]} />
            <Text style={s.value}>{ink.name}</Text>
          </View>
        ))}
      </View>
      <Text style={s.note}>
        Requested colors—not a confirmation that a color version was generated.
      </Text>
    </View>
  );
}
const s = StyleSheet.create({
  label: { fontFamily: F.bold, color: C.text, fontSize: 12, marginBottom: 8 },
  control: {
    minHeight: 67,
    borderColor: C.dark,
    borderWidth: 1,
    borderRadius: 4,
    backgroundColor: C.white,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderColor: "#00000030",
    borderWidth: 1,
  },
  value: { color: C.text, fontFamily: F.medium, fontSize: 11, lineHeight: 16 },
  backdrop: {
    flex: 1,
    backgroundColor: "#00000075",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  dialog: {
    backgroundColor: C.white,
    width: "100%",
    maxWidth: 570,
    maxHeight: "94%",
    borderColor: C.dark,
    borderWidth: 1,
    borderRadius: 8,
    padding: 22,
    gap: 20,
  },
  top: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  title: { color: C.text, fontFamily: F.heading, fontSize: 23, lineHeight: 28 },
  copy: {
    color: C.muted,
    fontFamily: F.body,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 5,
  },
  close: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  original: {
    minHeight: 48,
    borderColor: C.dark,
    borderWidth: 1,
    borderRadius: 4,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  originalText: { flex: 1, color: C.text, fontFamily: F.bold, fontSize: 12 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
  },
  swatch: {
    width: "23%",
    minHeight: 80,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 4,
    paddingVertical: 9,
    paddingHorizontal: 3,
    gap: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  largeDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderColor: "#00000025",
    borderWidth: 1,
  },
  check: {
    backgroundColor: C.white,
    borderColor: C.dark,
    borderWidth: 1,
    borderRadius: 7,
    width: 14,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    right: -4,
    bottom: -3,
  },
  name: {
    color: C.text,
    fontFamily: F.body,
    fontSize: 10,
    lineHeight: 13,
    textAlign: "center",
  },
  note: { color: C.muted, fontFamily: F.body, fontSize: 10, lineHeight: 17 },
  receipt: {
    width: "100%",
    backgroundColor: C.cream,
    padding: 18,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 4,
    gap: 11,
  },
  receiptLabel: {
    color: C.text,
    fontFamily: F.mono,
    fontSize: 9,
    letterSpacing: 1.5,
  },
});
