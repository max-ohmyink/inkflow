import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, R, type MediumId, type StyleId } from "@/lib/studio-theme";
import { PrimaryButton, StepLabel } from "./studio-ui";
import { ChoicePicker } from "./choice-picker";
import { TattooInkPicker } from "./tattoo-ink-picker";
import { TATTOO_INKS, validateTattooInkIds } from "@/shared/tattoo-inks";
import { isDisallowedInstantDrawConcept } from "@/shared/instant-draw";
import {
  CATALOG_COLOR_OPTIONS,
  CATALOG_STYLE_OPTIONS,
  DEFAULT_CATALOG_FILTERS,
  MAX_VARIATIONS,
  MIN_VARIATIONS,
  catalogFinderFilters,
  type CatalogFilters,
} from "@/shared/catalog-filters";

/** The art styles the guest can pick; Fine Line (first) is the default look. */
const PICKABLE_STYLE_IDS = [
  "fine_line",
  "traditional",
  "neo_traditional",
  "blackwork",
  "engraving",
  "tribal",
  "watercolor",
  "japanese",
] as const;
const STYLE_CHOICES = PICKABLE_STYLE_IDS.map((id) =>
  CATALOG_STYLE_OPTIONS.find((option) => option.id === id)!,
);
const isPickableStyle = (style: string) =>
  (PICKABLE_STYLE_IDS as readonly string[]).includes(style);

/** The form starts at one design; the server's own default (4) only applies to old clients. */
const FORM_DEFAULT_VARIATIONS = 1;
const chosenVariations = (filters: CatalogFilters) =>
  filters.variations ?? FORM_DEFAULT_VARIATIONS;

/** Blackwork is black ink only, so any previously chosen ink colors are dropped. */
function withoutInkColors(filters: CatalogFilters): CatalogFilters {
  const { inkColors: _inkColors, ...rest } = filters;
  return { ...rest, colorMix: "any" };
}

export function StudioForm({
  onGenerate,
  busy,
  offline,
  externalError,
  initialQuery,
  filters,
  onFiltersChange,
  wide = true,
}: {
  /** Kept for callers; the pickers wrap on their own on narrow screens. */
  wide?: boolean;
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
  const [focused, setFocused] = useState(false);
  const input = useRef<TextInput>(null);
  const disallowed = isDisallowedInstantDrawConcept(concept);
  const blackOnly =
    filters.artStyle === "blackwork" || filters.artStyle === "engraving";
  const finderFilters = {
    ...catalogFinderFilters(blackOnly ? withoutInkColors(filters) : filters),
    variations: chosenVariations(filters),
  };
  const submit = () => {
    setTouched(true);
    if (disallowed || busy) return;
    const query = concept.trim() || "Surprise me";
    onGenerate(query, "fine_line", "blackwork", finderFilters);
  };
  return (
    <View style={s.form}>
      {/* 1. What this card is for. */}
      <View style={s.section}>
        <StepLabel number="01" title="Find your tattoo" />
        <Text style={s.label}>Generate your tattoo live!</Text>
      </View>
      {/* 2. The idea, with its errors right under it. */}
      <View style={s.section}>
        <View
          style={[
            s.inputBox,
            focused && s.inputBoxFocused,
            touched && disallowed && { borderColor: C.red },
          ]}
        >
          <Feather name="search" color={C.accentInk} size={21} />
          <TextInput
            ref={input}
            accessibilityLabel="Your tattoo prompt"
            value={concept}
            onChangeText={setConcept}
            placeholder="A happy cat, a rainbow, a smiling sun…"
            placeholderTextColor="#72726F"
            maxLength={160}
            style={s.input}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onSubmitEditing={submit}
            returnKeyType="search"
          />
        </View>
        {touched && disallowed && (
          <Text accessibilityRole="alert" style={s.error}>
            Let’s try a different idea.
          </Text>
        )}
        {!!externalError && (
          <Text accessibilityRole="alert" style={s.error}>
            {externalError}
          </Text>
        )}
      </View>
      {/* 3. Options, with Reset beside them so it clearly belongs to the pickers. */}
      <View style={s.section}>
        <View style={s.optionsHeader}>
          <Text style={s.optionsTitle}>Options</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              onFiltersChange({
                ...DEFAULT_CATALOG_FILTERS,
                category: filters.category,
              })
            }
            hitSlop={8}
            style={{ paddingVertical: 4 }}
          >
            <Text style={s.reset}>Reset options</Text>
          </Pressable>
        </View>
        <View style={s.options}>
          {/* Keeps half width when Blackwork hides Color mix, so the layout doesn't jump. */}
          <View
            style={[s.choiceColumn, wide && blackOnly && { maxWidth: "50%" }]}
          >
            <ChoicePicker
              label="Art style"
              value={
                isPickableStyle(filters.artStyle)
                  ? filters.artStyle
                  : "fine_line"
              }
              options={STYLE_CHOICES}
              fallbackLabel="Fine Line"
              onChange={(artStyle) => {
                const next = artStyle as CatalogFilters["artStyle"];
                onFiltersChange({
                  ...(next === "blackwork" || next === "engraving"
                    ? withoutInkColors(filters)
                    : filters),
                  artStyle: next,
                });
              }}
            />
          </View>
          {!blackOnly && (
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
                  const { inkColors: _previous, ...base } = filters;
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
          )}
        </View>
        <View style={s.tuning}>
          <View style={s.variations}>
            <Text style={s.variationsLabel}>Variations</Text>
            <View style={s.variationButtons}>
              {Array.from(
                { length: MAX_VARIATIONS - MIN_VARIATIONS + 1 },
                (_, i) => MIN_VARIATIONS + i,
              ).map((count) => {
                const active = count === chosenVariations(filters);
                return (
                  <Pressable
                    key={count}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active, selected: active }}
                    accessibilityLabel={`${count} ${count === 1 ? "variation" : "different variations"}`}
                    onPress={() => {
                      const { variations: _previous, ...rest } = filters;
                      onFiltersChange({ ...rest, variations: count });
                    }}
                    style={[s.variationButton, active && s.variationButtonOn]}
                  >
                    <Text style={s.variationText}>{count}</Text>
                  </Pressable>
                );
              })}
              <Text style={s.variationHint}>
                {chosenVariations(filters) === 1
                  ? "1 design"
                  : `${chosenVariations(filters)} different designs`}
              </Text>
            </View>
          </View>
        </View>
      </View>
      {/* 4. The one primary action, last in the card. */}
      <PrimaryButton
        text={
          busy
            ? "Preparing your tattoo…"
            : offline
              ? "You’re offline"
              : "Generate my tattoo"
        }
        onPress={submit}
        disabled={busy || offline}
        icon="arrow-right"
      />
    </View>
  );
}
const s = StyleSheet.create({
  form: { gap: 28, paddingTop: 3 },
  section: { gap: 10 },
  optionsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  optionsTitle: {
    fontFamily: F.bold,
    color: C.dark,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  label: { fontFamily: F.heading, color: C.text, fontSize: 32, lineHeight: 38 },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 2,
    borderColor: C.dark,
    backgroundColor: C.panel,
    borderRadius: R.control,
    minHeight: 66,
    paddingHorizontal: 20,
  },
  inputBoxFocused: { borderColor: C.yellow },
  input: {
    flex: 1,
    color: C.text,
    fontFamily: F.body,
    fontSize: 17,
    paddingVertical: 18,
    // Web: no browser focus rectangle; the rounded box around the input shows focus instead.
    ...({ outlineStyle: "none", outlineWidth: 0 } as object),
  },
  error: { color: C.red, fontFamily: F.bold, fontSize: 14, lineHeight: 20 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 13 },
  choiceColumn: { flex: 1, minWidth: 150 },
  tuning: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 28,
    rowGap: 14,
    marginTop: 4,
  },
  variations: { gap: 8 },
  variationsLabel: { fontFamily: F.bold, color: C.text, fontSize: 12 },
  variationButtons: { flexDirection: "row", alignItems: "center", gap: 8 },
  variationButton: {
    width: 48,
    height: 48,
    borderRadius: R.pill,
    borderWidth: 2,
    borderColor: C.dark,
    backgroundColor: C.white,
    alignItems: "center",
    justifyContent: "center",
  },
  variationButtonOn: { backgroundColor: C.yellow },
  variationText: { fontFamily: F.heading, color: C.dark, fontSize: 18 },
  variationHint: {
    fontFamily: F.body,
    color: C.dark,
    fontSize: 13,
    marginLeft: 6,
    flexShrink: 1,
  },
  reset: {
    color: C.accentInk,
    fontFamily: F.bold,
    fontSize: 12,
    textDecorationLine: "underline",
  },
});
