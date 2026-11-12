import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, type MediumId, type StyleId } from "@/lib/studio-theme";
import { PrimaryButton, StepLabel } from "./studio-ui";
import { CatalogChoice } from "./catalog-choice";
import { TattooInkPicker } from "./tattoo-ink-picker";
import { TATTOO_INKS, validateTattooInkIds } from "@/shared/tattoo-inks";
import { CATALOG_DESIGNS } from "@/lib/catalog-inspiration";
import type { InspirationPreset } from "@/lib/inspiration-utils";
import { isDisallowedInstantDrawConcept } from "@/shared/instant-draw";
import {
  CATALOG_STYLE_OPTIONS,
  CATALOG_COLOR_OPTIONS,
  DEFAULT_CATALOG_FILTERS,
  catalogFinderFilters,
  catalogDesignSelectionFilters,
  filterCatalogByChoices,
  type CatalogFilters,
} from "@/shared/catalog-filters";

export function StudioForm({
  onGenerate,
  busy,
  inspiration,
  onBrowseInspiration,
  inspirationCount,
  externalError,
  initialQuery,
  filters,
  onFiltersChange,
}: {
  onGenerate: (
    concept: string,
    style: StyleId,
    medium: MediumId,
    catalogId?: string,
    filters?: CatalogFilters,
  ) => void;
  busy: boolean;
  inspiration?: InspirationPreset | null;
  onBrowseInspiration?: () => void;
  inspirationCount?: number;
  externalError?: string;
  initialQuery?: string;
  filters: CatalogFilters;
  onFiltersChange: (filters: CatalogFilters) => void;
}) {
  const [concept, setConcept] = useState(initialQuery || "");
  const [touched, setTouched] = useState(false);
  const input = useRef<TextInput>(null);
  const disallowed = isDisallowedInstantDrawConcept(concept);
  useEffect(() => {
    if (!inspiration) return;
    setConcept(inspiration.title);
    setTouched(false);
  }, [inspiration?.id, inspiration?.version]);
  const finderFilters = catalogFinderFilters(filters);
  const choices = useMemo(
    () => ({
      styles: CATALOG_STYLE_OPTIONS.map((option) => ({
        ...option,
        count: filterCatalogByChoices(CATALOG_DESIGNS, {
          ...catalogDesignSelectionFilters(catalogFinderFilters(filters)),
          artStyle: option.id,
        }).length,
      })),
      colors: CATALOG_COLOR_OPTIONS.map((option) => ({
        ...option,
        count: filterCatalogByChoices(CATALOG_DESIGNS, {
          ...catalogDesignSelectionFilters(catalogFinderFilters(filters)),
        }).length,
      })),
      count: filterCatalogByChoices(
        CATALOG_DESIGNS,
        catalogDesignSelectionFilters(catalogFinderFilters(filters)),
      ).length,
    }),
    [filters.category, filters.artStyle, filters.colorMix],
  );
  const submit = () => {
    setTouched(true);
    if (disallowed || busy) return;
    const query = concept.trim() || "Surprise me";
    onGenerate(
      query,
      "fine_line",
      "blackwork",
      query === inspiration?.title ? inspiration.id : undefined,
      finderFilters,
    );
  };
  return (
    <View style={s.form}>
      <StepLabel number="01" title="Find your tattoo" />
      <Text style={s.label}>Generate your tattoo live!</Text>
      <Text style={s.copy}>
        Simple, family-friendly ideas from our artists’ catalog come first. If
        there’s no suitable design in your chosen style, AI can explore it next.
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
          <CatalogChoice
            label="Art style"
            value={filters.artStyle}
            options={choices.styles}
            fallbackLabel={
              filters.artStyle === "any" ? "Catalog match" : "Saved style"
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
      <View style={s.availability}>
        <Text
          accessibilityLiveRegion="polite"
          style={[s.availabilityText, choices.count === 0 && { color: C.red }]}
        >
          {choices.count} catalog{" "}
          {choices.count === 1 ? "design fits" : "designs fit"} these choices in
          the family-friendly edit
        </Text>
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
      </View>
      {choices.count === 0 && (
        <Text accessibilityLiveRegion="polite" style={s.smallCopy}>
          No catalog designs in this art style yet. AI can create your idea
          instead.
        </Text>
      )}
      <PrimaryButton
        text={busy ? "Preparing your tattoo…" : "Generate my tattoo"}
        onPress={submit}
        disabled={busy}
        icon="arrow-right"
      />
      <Text style={s.underText}>
        Catalog first. AI only when no suitable match is found. Your chosen
        colors.
      </Text>
      {!!onBrowseInspiration && (
        <Pressable
          accessibilityRole="button"
          onPress={onBrowseInspiration}
          style={s.browse}
        >
          <Feather name="grid" size={15} color={C.accentInk} />
          <Text style={s.browseText}>
            Explore {inspirationCount || "our"} catalog designs
          </Text>
          <Feather name="arrow-down" size={13} color={C.accentInk} />
        </Pressable>
      )}
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
  availability: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 7,
  },
  availabilityText: {
    fontFamily: F.body,
    color: C.muted,
    fontSize: 10,
    lineHeight: 18,
  },
  reset: { color: C.accentInk, fontFamily: F.bold, fontSize: 10 },
  underText: {
    fontFamily: F.body,
    color: C.muted,
    fontSize: 10,
    textAlign: "center",
    lineHeight: 18,
  },
  browse: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  browseText: { fontFamily: F.bold, fontSize: 12, color: C.accentInk },
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
