import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F } from "@/lib/studio-theme";

export type ChoiceOption = {
  id: string;
  label: string;
  count?: number;
  swatches?: readonly string[];
};
export function CatalogChoice({
  label,
  value,
  options,
  onChange,
  fallbackLabel = "Choose an option",
}: {
  label: string;
  value: string;
  options: readonly ChoiceOption[];
  onChange: (id: string) => void;
  fallbackLabel?: string;
}) {
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState("");
  const { height } = useWindowDimensions();
  const selected = options.find((option) => option.id === value);
  const shown = options.filter((option) =>
    option.label.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label || fallbackLabel}`}
        accessibilityState={{ expanded: open }}
        onPress={() => {
          setSearch("");
          setOpen(true);
        }}
        style={s.trigger}
      >
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={s.value}>{selected?.label || fallbackLabel}</Text>
          {selected?.count !== undefined && (
            <Text style={s.count}>
              {selected.count} catalog{" "}
              {selected.count === 1 ? "design" : "designs"}
            </Text>
          )}
        </View>
        {selected?.swatches && <Swatches colors={selected.swatches} />}
        <Feather name="chevron-down" size={17} color={C.text} />
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={s.overlay}>
          <Pressable
            style={[StyleSheet.absoluteFill, s.scrim]}
            accessibilityLabel="Close options"
            onPress={() => setOpen(false)}
          />
          <View
            accessibilityViewIsModal
            style={[s.dialog, { maxHeight: Math.min(650, height * 0.83) }]}
          >
            <View style={s.header}>
              <Text accessibilityRole="header" style={s.title}>
                Choose {label.toLowerCase()}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close options"
                onPress={() => setOpen(false)}
                style={s.closeButton}
              >
                <Feather name="x" color={C.text} size={21} />
              </Pressable>
            </View>
            {options.length > 8 && (
              <TextInput
                accessibilityLabel={`Search ${label.toLowerCase()} options`}
                value={search}
                onChangeText={setSearch}
                placeholder="Search collections…"
                placeholderTextColor={C.muted}
                style={s.search}
                autoCorrect={false}
              />
            )}
            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={{ flexShrink: 1 }}
            >
              {shown.map((option) => (
                <Pressable
                  key={option.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: value === option.id }}
                  onPress={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                  style={[s.option, value === option.id && s.active]}
                >
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={s.optionText}>{option.label}</Text>
                    {option.count !== undefined && (
                      <Text style={s.count}>
                        {option.count} matching catalog{" "}
                        {option.count === 1 ? "design" : "designs"}
                      </Text>
                    )}
                  </View>
                  {option.swatches && <Swatches colors={option.swatches} />}
                  <Feather
                    name={value === option.id ? "check-circle" : "circle"}
                    size={18}
                    color={value === option.id ? C.blue : C.muted}
                  />
                </Pressable>
              ))}
              {!shown.length && (
                <Text style={[s.count, { padding: 20 }]}>
                  No collections match that search.
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
function Swatches({ colors }: { colors: readonly string[] }) {
  return (
    <View style={{ flexDirection: "row", gap: 3 }}>
      {colors.map((color) => (
        <View
          key={color}
          style={{
            width: 11,
            height: 11,
            borderRadius: 6,
            backgroundColor: color,
            borderWidth: 1,
            borderColor: C.line,
          }}
        />
      ))}
    </View>
  );
}
const s = StyleSheet.create({
  field: { gap: 8 },
  label: {
    color: C.text,
    fontFamily: F.bold,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 64,
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 2,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  value: { color: C.text, fontFamily: F.body, fontSize: 13, lineHeight: 19 },
  count: { color: C.muted, fontFamily: F.body, fontSize: 10, lineHeight: 17 },
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
  },
  scrim: { backgroundColor: "rgba(17,17,17,0.28)" },
  dialog: {
    backgroundColor: C.panel,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 2,
    width: "100%",
    maxWidth: 540,
    padding: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  closeButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: C.text, fontFamily: F.heading, fontSize: 23, flex: 1 },
  search: {
    backgroundColor: C.raised,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 2,
    padding: 13,
    marginBottom: 12,
    color: C.text,
    fontFamily: F.body,
    fontSize: 14,
  },
  option: {
    minHeight: 61,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderColor: "transparent",
    borderWidth: 1,
    borderRadius: 2,
    marginBottom: 5,
  },
  active: { backgroundColor: C.raised, borderColor: C.blue },
  optionText: {
    color: C.text,
    fontFamily: F.body,
    fontSize: 13,
    lineHeight: 20,
  },
});
