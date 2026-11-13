import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, type MediumId, type StyleId } from "@/lib/studio-theme";
import { PrimaryButton, StepLabel } from "./studio-ui";
import { ChoicePicker } from "./choice-picker";
import { TattooInkPicker } from "./tattoo-ink-picker";
import { TATTOO_INKS, validateTattooInkIds } from "@/shared/tattoo-inks";
import { isDisallowedInstantDrawConcept } from "@/shared/instant-draw";
import {
  CATALOG_STYLE_OPTIONS,
  CATALOG_COLOR_OPTIONS,
  DEFAULT_CATALOG_FILTERS,
  catalogFinderFilters,
  type CatalogFilters,
} from "@/shared/catalog-filters";

export function StudioForm({
  onGenerate,
  busy,
  offline,
  externalError,
  initialQuery,
  filters,
  onFiltersChange,
}: {
  onGenerate: (
    concept: string,
    style: StyleId,
    medium: MediumId,
    filters?: CatalogFilters,
  ) => void;
  busy: boolean;
  offline?: boolean;
  externalError?: string;
  initialQuery?: string;
  filters: CatalogFilters;
  onFiltersChange: (filters: CatalogFilters) => void;
}) {
  const [concept, setConcept] = useState(initialQuery || "");
  const [touched, setTouched] = useState(false);
  const input = useRef<TextInput>(null);
  const disallowed = isDisallowedInstantDrawConcept(concept);
  const finderFilters = catalogFinderFilters(filters);
  const styleOptions = CATALOG_STYLE_OPTIONS;
  const submit = () => {
    setTouched(true);
    if (disallowed || busy) return;
    const query = concept.trim() || "Surprise me";
    onGenerate(query, "fine_line", "blackwork", finderFilters);
  };
  return (
    <View style={s.form}>
      <StepLabel number="01" title="Find your tattoo" />
      <Text style={s.label}>Generate your tattoo live!</Text>
      <Text style={s.copy}>
        Describe a simple, family-friendly idea and AI will create tattoo
        designs in your chosen style.
      </Text>
      <View
        style={[s.inputBox, touched && disallowed && { borderColor: C.red }]}
      >
        <Feather name="search" color={C.accentInk} size={19} />
        <TextInput
          ref={input}
          accessibilityLabel="Your tattoo prompt"
          value={concept}
          onChangeText={setConcept}
          placeholder="A heart, a flower, a friendly animal…"
          placeholderTextColor="#72726F"
          maxLength={160}
          style={s.input}
          onSubmitEditing={submit}
          returnKeyType="search"
        />
      </View>
      <Text style={s.smallCopy}>
        Leave the prompt blank for a surprise that fits your choices.
      </Text>
      {touched && disallowed && (
        <Text accessibilityRole="alert" style={s.error}>
          Mandala designs aren’t part of this experience. Try another theme.
        </Text>
      )}
      {!!externalError && (
        <Text accessibilityRole="alert" style={s.error}>
          {externalError}
        </Text>
      )}
      <View style={s.suggestions}>
        {["Hearts", "Flowers", "Animals", "Stars"].map((idea) => (
          <Pressable
            key={idea}
            accessibilityRole="button"
            onPress={() => setConcept(idea)}
            style={s.suggestion}
          >
            <Text style={s.suggestionText}>{idea}</Text>
            <Feather name="plus" size={11} color={C.muted} />
          </Pressable>
        ))}
      </View>
      <View style={s.options}>
        <View style={s.choiceColumn}>
          <ChoicePicker
            label="Art style"
            value={filters.artStyle}
            options={styleOptions}
            fallbackLabel={
              filters.artStyle === "any" ? "Any art style" : "Saved style"
            }
            onChange={(artStyle) =>
              onFiltersChange({
                ...filters,
                artStyle: artStyle as CatalogFilters["artStyle"],
              })
            }
          />
        </View>
        <View style={s.choiceColumn}>
          <TattooInkPicker
            inks={TATTOO_INKS}
            selected={filters.inkColors || []}
            legacyLabel={
              filters.colorMix !== "any" && filters.colorMix !== "custom"
                ? CATALOG_COLOR_OPTIONS.find(
                    (option) => option.id === filters.colorMix,
                  )?.label
                : undefined
            }
            onChange={(ids) => {
              const { inkColors: previous, ...base } = filters;
              onFiltersChange(
                ids.length
                  ? {
                      ...base,
                      colorMix: "custom",
                      inkColors: validateTattooInkIds(ids),
                    }
                  : { ...base, colorMix: "any" },
              );
            }}
          />
        </View>
        <Text style={[s.smallCopy, { width: "100%" }]}>
          Choose up to 3 of your tattoo inks for filled shapes. Simple contours
          stay clear; the untouched original is kept separately. Selected-ink
          fills do not need AI coloring.
        </Text>
      </View>
      {filters.artStyle === "watercolor" && (
        <Text style={s.smallCopy}>
          Watercolor is a digital color-wash look. Your artist may simplify it
          for live drawing; selected-ink versions use flat fills, not watercolor
          texture.
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          onFiltersChange({
            ...DEFAULT_CATALOG_FILTERS,
            category: filters.category,
          })
        }
        style={{ paddingVertical: 6 }}
      >
        <Text style={s.reset}>Reset options</Text>
      </Pressable>
      <PrimaryButton
        text={
          busy
            ? "Preparing your tattoo…"
            : offline
              ? "You’re offline — reconnect to continue"
              : "Generate my tattoo"
        }
        onPress={submit}
        disabled={busy || offline}
        icon="arrow-right"
      />
      <Text style={s.underText}>
        Created live by AI, in your chosen style and colors.
      </Text>
      <View style={s.footer}>
        <Feather name="heart" size={13} color={C.accentInk} />
        <Text style={s.footerText}>
          Simple lines. No mandalas. A little you, without the forever.
        </Text>
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  form: { gap: 13, paddingTop: 3 },
  label: { fontFamily: F.heading, color: C.text, fontSize: 28, lineHeight: 34 },
  copy: { fontFamily: F.body, color: C.muted, fontSize: 12, lineHeight: 20 },
  smallCopy: {
    fontFamily: F.body,
    color: C.muted,
    fontSize: 10,
    lineHeight: 18,
  },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.panel,
    borderRadius: 7,
    minHeight: 62,
    paddingHorizontal: 18,
  },
  input: {
    flex: 1,
    color: C.text,
    fontFamily: F.body,
    fontSize: 15,
    paddingVertical: 18,
  },
  error: { color: C.red, fontFamily: F.body, fontSize: 12, lineHeight: 20 },
  suggestions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  suggestion: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 5,
    paddingHorizontal: 11,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  suggestionText: { fontFamily: F.body, color: C.muted, fontSize: 11 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 13 },
  choiceColumn: { flex: 1, minWidth: 150 },
  reset: { color: C.accentInk, fontFamily: F.bold, fontSize: 10 },
  underText: {
    fontFamily: F.body,
    color: C.muted,
    fontSize: 10,
    textAlign: "center",
    lineHeight: 18,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingTop: 20,
    flexDirection: "row",
    gap: 8,
  },
  footerText: {
    flex: 1,
    fontFamily: F.body,
    color: C.muted,
    fontSize: 10,
    lineHeight: 18,
  },
});
