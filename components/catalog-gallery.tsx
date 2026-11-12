import { useEffect, useMemo, useState } from "react";
import {
  Image,
  ScrollView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F } from "@/lib/studio-theme";
import { CATALOG_DESIGNS, type CatalogDesign } from "@/lib/catalog-inspiration";
import { filterCatalog, INSPIRATION_CATEGORIES } from "@/lib/inspiration-utils";
import { SmallButton } from "./studio-ui";
import {
  DEFAULT_CATALOG_FILTERS,
  catalogDesignSelectionFilters,
  filterCatalogByChoices,
  catalogFilterSummary,
  type CatalogFilters,
} from "@/shared/catalog-filters";
import { catalogDisplayTitle } from "@/shared/catalog-labels";

export function CatalogGallery({
  onUse,
  selectedId,
  filters,
  onFiltersChange,
}: {
  onUse: (item: CatalogDesign) => void;
  selectedId?: string;
  filters: CatalogFilters;
  onFiltersChange: (filters: CatalogFilters) => void;
}) {
  const category = filters.category;
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(12);
  const { width } = useWindowDimensions();
  const filtered = useMemo(
    () =>
      filterCatalog(
        filterCatalogByChoices(
          CATALOG_DESIGNS,
          catalogDesignSelectionFilters(filters),
        ),
        category,
        query,
      ),
    [category, filters.artStyle, filters.colorMix, query, CATALOG_DESIGNS],
  );
  useEffect(() => {
    setVisible(12);
  }, [category, filters.artStyle, filters.colorMix, query]);
  const cardWidth = width < 600 ? "47%" : width < 1080 ? "31%" : "23%";

  return (
    <View style={s.gallery}>
      <View style={s.header}>
        <View style={s.intro}>
          <Text style={s.eyebrow}>OUR ARTISTS. YOUR INK MOMENT.</Text>
          <Text accessibilityRole="header" style={s.title}>
            FIND A LITTLE <Text style={s.serif}>spark.</Text>
          </Text>
          <Text style={s.copy}>
            A simple family-friendly edit from our artists’ catalog. Pick a
            friendly motif and your tattoo inks. No dense ornament or mandalas.
          </Text>
        </View>
        <View style={s.count}>
          <Feather name="layers" size={18} color={C.text} />
          <Text style={s.countNumber}>{CATALOG_DESIGNS.length}</Text>
          <Text style={s.countLabel}>SIMPLE FAMILY DESIGNS</Text>
        </View>
      </View>
      <View style={s.search}>
        <Feather name="search" size={18} color={C.text} />
        <TextInput
          accessibilityLabel="Search tattoo inspiration"
          placeholder="Try heart, flower, balloon…"
          placeholderTextColor={C.muted}
          value={query}
          onChangeText={setQuery}
          style={s.searchInput}
          autoCorrect={false}
        />
        {!!query && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear inspiration search"
            onPress={() => setQuery("")}
            style={{ padding: 10 }}
          >
            <Feather name="x" size={16} color={C.text} />
          </Pressable>
        )}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        contentContainerStyle={[
          s.filters,
          { flexWrap: "nowrap", paddingBottom: 10 },
        ]}
      >
        {[
          { id: "all", label: "All collections" },
          ...INSPIRATION_CATEGORIES,
        ].map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityState={{ selected: category === item.id }}
            onPress={() => onFiltersChange({ ...filters, category: item.id })}
            style={[s.filter, category === item.id && s.filterActive]}
          >
            <Text
              style={[s.filterText, category === item.id && { color: C.dark }]}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <Text accessibilityLiveRegion="polite" style={s.resultsCount}>
        {filtered.length} {filtered.length === 1 ? "design" : "designs"} to
        explore{query ? ` for “${query.trim()}”` : ""}
      </Text>
      <Text style={[s.resultsCount, { marginTop: 0 }]}>
        {catalogFilterSummary(filters)}
      </Text>
      {filters.colorMix !== "any" && (
        <Text style={[s.resultsCount, { marginTop: 0 }]}>
          These thumbnails show catalog originals. Your color version is created
          when you choose a design.
        </Text>
      )}
      <View style={s.cards}>
        {filtered.slice(0, visible).map((item) => (
          <View
            key={item.id}
            style={[
              s.card,
              { width: cardWidth },
              selectedId === item.id && { borderColor: C.text },
            ]}
          >
            <View style={s.artFrame}>
              <Image
                source={item.art}
                accessibilityLabel={`${catalogDisplayTitle(item)}, original Oh My Ink catalog artwork`}
                resizeMode="contain"
                style={s.art}
              />
              {selectedId === item.id && (
                <View style={s.selected}>
                  <Feather name="check" size={13} color={C.dark} />
                </View>
              )}
            </View>
            <View style={s.cardBody}>
              <Text style={s.designName}>{catalogDisplayTitle(item)}</Text>
              <Text style={s.collection}>{item.collection}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Choose original catalog design ${catalogDisplayTitle(item)}`}
                onPress={() => onUse(item)}
                style={({ pressed }) => [
                  s.useButton,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text style={s.useText}>Choose this design</Text>
                <Feather name="arrow-up-right" size={16} color={C.dark} />
              </Pressable>
            </View>
          </View>
        ))}
      </View>
      {filtered.length === 0 && (
        <View style={s.empty}>
          <Feather name="search" size={28} color={C.text} />
          <Text style={s.copy}>
            No sparks for that search yet. Try a different word or explore
            another collection.
          </Text>
          <SmallButton
            text="Show all designs"
            onPress={() => {
              setQuery("");
              onFiltersChange({ ...DEFAULT_CATALOG_FILTERS });
            }}
            icon="refresh-cw"
          />
        </View>
      )}
      {visible < filtered.length && (
        <View style={s.more}>
          <SmallButton
            text={`Explore ${Math.min(12, filtered.length - visible)} more designs`}
            onPress={() => setVisible((value) => value + 12)}
            icon="plus"
          />
        </View>
      )}
      <View style={s.note}>
        <Feather name="info" size={14} color={C.blue} />
        <Text style={s.noteText}>
          The catalog original stays untouched. A color version keeps its
          contours and lettering, with color inside enclosed shapes too. Our
          artists can help you choose a piece suited to live drawing. Mandalas
          are excluded.
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  gallery: {
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingTop: 36,
    paddingBottom: 18,
    marginTop: 32,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 22,
    marginBottom: 24,
  },
  intro: { flex: 1, minWidth: 220, maxWidth: 700 },
  eyebrow: {
    color: C.text,
    fontFamily: F.bold,
    fontSize: 10,
    letterSpacing: 1.1,
    lineHeight: 17,
    marginBottom: 10,
  },
  title: { fontFamily: F.heading, color: C.text, fontSize: 34 },
  serif: { fontFamily: F.serif, color: C.blue, fontSize: 34 },
  copy: {
    fontFamily: F.body,
    fontSize: 13,
    lineHeight: 21,
    color: C.muted,
    marginTop: 12,
  },
  count: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: C.panel,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 2,
    paddingVertical: 12,
    paddingHorizontal: 15,
  },
  countNumber: { fontFamily: F.heading, fontSize: 23, color: C.text },
  countLabel: {
    fontFamily: F.bold,
    fontSize: 9,
    color: C.muted,
    letterSpacing: 1,
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: 15,
    backgroundColor: C.panel,
  },
  searchInput: {
    fontFamily: F.body,
    color: C.text,
    fontSize: 13,
    minHeight: 52,
    flex: 1,
  },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 18 },
  filter: {
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.panel,
    borderRadius: 2,
    paddingHorizontal: 13,
    paddingVertical: 11,
    minHeight: 44,
    justifyContent: "center",
  },
  filterActive: { backgroundColor: C.yellow, borderColor: C.yellow },
  filterText: { fontFamily: F.bold, fontSize: 10, color: C.text },
  resultsCount: {
    fontFamily: F.body,
    fontSize: 11,
    color: C.muted,
    marginVertical: 18,
  },
  cards: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 15,
  },
  card: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 2,
    overflow: "hidden",
    backgroundColor: C.panel,
  },
  artFrame: { backgroundColor: "#fff", aspectRatio: 1, padding: 16 },
  art: { width: "100%", height: "100%" },
  selected: {
    position: "absolute",
    right: 9,
    top: 9,
    width: 24,
    height: 24,
    backgroundColor: C.yellow,
    borderRadius: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { padding: 12 },
  designName: {
    fontFamily: F.bold,
    fontSize: 12,
    lineHeight: 18,
    color: C.text,
    minHeight: 36,
  },
  collection: {
    fontFamily: F.body,
    fontSize: 10,
    color: C.muted,
    lineHeight: 16,
    marginTop: 4,
    minHeight: 32,
  },
  useButton: {
    minHeight: 44,
    marginTop: 12,
    backgroundColor: C.yellow,
    borderRadius: 2,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  useText: { fontFamily: F.bold, fontSize: 10, color: C.dark },
  more: { alignItems: "center", marginTop: 24 },
  empty: { gap: 12, alignItems: "center", padding: 24 },
  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 25,
  },
  noteText: {
    flex: 1,
    fontFamily: F.body,
    fontSize: 11,
    lineHeight: 18,
    color: C.muted,
  },
});
