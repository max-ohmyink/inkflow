import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, R } from "@/lib/studio-theme";
import {
  absoluteAsset,
  getStencil,
  type SavedJob,
  type StencilJob,
} from "@/lib/stencil-client";
import { formatHistoryDate, guestArtworkUrl } from "@/lib/guest-experience";
import { CATALOG_STYLE_OPTIONS } from "@/shared/catalog-filters";

type CardState =
  | { kind: "loading" }
  | { kind: "ready"; job: StencilJob }
  | { kind: "working" }
  | { kind: "failed" }
  | { kind: "gone" };

const MAX_PARALLEL = 3;

/** Art style label for the chip; hidden for "any" and styles that are no longer offered. */
function styleLabel(record: SavedJob): string | undefined {
  return CATALOG_STYLE_OPTIONS.find(
    (option) => option.id === record.filters?.artStyle,
  )?.label;
}

/**
 * Loads each saved design’s current state, a few at a time, so cards fill in as they arrive.
 * The parent hands over a new `records` array whenever the list reloads, so a record is fetched once
 * per id and an in-flight result is never dropped just because the array identity changed.
 */
function useCardStates(records: SavedJob[]): Record<string, CardState> {
  const [states, setStates] = useState<Record<string, CardState>>({});
  const requested = useRef(new Set<string>());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const queue = records.filter((record) => !requested.current.has(record.id));
    queue.forEach((record) => requested.current.add(record.id));
    const worker = async () => {
      for (;;) {
        const record = queue.shift();
        if (!record) return;
        let next: CardState;
        try {
          const job = await getStencil(record);
          next =
            job.status === "ready"
              ? { kind: "ready", job }
              : job.status === "failed"
                ? { kind: "failed" }
                : { kind: "working" };
        } catch {
          next = { kind: "gone" };
        }
        if (!mounted.current) return;
        setStates((current) => ({ ...current, [record.id]: next }));
      }
    };
    for (let i = 0; i < Math.min(MAX_PARALLEL, queue.length); i += 1) worker();
  }, [records]);
  return states;
}

function Placeholder({
  icon,
  title,
  busy,
}: {
  icon?: React.ComponentProps<typeof Feather>["name"];
  title: string;
  busy?: boolean;
}) {
  return (
    <View style={s.placeholder}>
      {busy ? (
        <ActivityIndicator color={C.blue} />
      ) : (
        <Feather name={icon ?? "image"} size={26} color={C.muted} />
      )}
      <Text style={s.placeholderText}>{title}</Text>
    </View>
  );
}

function Mosaic({ job, concept }: { job: StencilJob; concept: string }) {
  const options = job.options.slice(0, 4);
  const single = options.length === 1;
  return (
    <View style={s.mosaic}>
      {options.map((option, index) => (
        <View key={option.id} style={[s.tile, single && s.tileFull]}>
          <Image
            source={{ uri: absoluteAsset(guestArtworkUrl(option)) }}
            resizeMode="contain"
            style={s.tileImage}
            accessibilityLabel={`${concept}, variation ${index + 1}`}
          />
        </View>
      ))}
    </View>
  );
}

function HistoryCard({
  record,
  state,
  width,
  onOpen,
  onDelete,
  selecting,
  selected,
  onToggle,
}: {
  record: SavedJob;
  state: CardState;
  width: string;
  onOpen: () => void;
  onDelete: () => void;
  /** Multi-select mode: the card is toggled instead of opened. */
  selecting: boolean;
  selected: boolean;
  onToggle: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const ready = state.kind === "ready";
  const label = styleLabel(record);
  return (
    <View
      style={[
        s.card,
        { width: width as `${number}%` },
        selected && s.cardSelected,
      ]}
    >
      <Pressable
        accessibilityRole={selecting ? "checkbox" : "button"}
        accessibilityState={selecting ? { checked: selected } : undefined}
        accessibilityLabel={
          selecting
            ? `Select design: ${record.concept}`
            : `Open design: ${record.concept}`
        }
        disabled={!selecting && !ready}
        onPress={selecting ? onToggle : onOpen}
        style={s.imageArea}
      >
        {selecting && (
          <View style={[s.checkbox, selected && s.checkboxOn]}>
            {selected && <Feather name="check" size={16} color={C.dark} />}
          </View>
        )}
        {state.kind === "ready" ? (
          <Mosaic job={state.job} concept={record.concept} />
        ) : state.kind === "loading" ? (
          <Placeholder busy title="Loading…" />
        ) : state.kind === "working" ? (
          <Placeholder busy title="Still drawing…" />
        ) : state.kind === "failed" ? (
          <Placeholder icon="alert-circle" title="Couldn’t be created" />
        ) : (
          <Placeholder icon="cloud-off" title="No longer available" />
        )}
      </Pressable>

      <Text numberOfLines={2} style={s.prompt}>
        {record.concept}
      </Text>

      <View style={s.metaRow}>
        <View style={s.meta}>
          <Feather name="calendar" size={14} color={C.muted} />
          <Text style={s.metaText}>{formatHistoryDate(record.createdAt)}</Text>
        </View>
        <View style={s.chips}>
          {label && (
            <View style={s.chip}>
              <Text style={s.chipText}>{label}</Text>
            </View>
          )}
          {state.kind === "ready" && (
            <View style={[s.chip, s.chipCount]}>
              <Text style={s.chipText}>
                {state.job.options.length}{" "}
                {state.job.options.length === 1 ? "design" : "designs"}
              </Text>
            </View>
          )}
        </View>
      </View>

      {selecting ? (
        <Pressable
          accessibilityRole="button"
          onPress={onToggle}
          style={[s.button, selected ? s.buttonOpen : s.buttonLight]}
        >
          <Feather
            name={selected ? "check-square" : "square"}
            size={16}
            color={C.dark}
          />
          <Text style={s.buttonText}>{selected ? "Selected" : "Select"}</Text>
        </Pressable>
      ) : confirming ? (
        <View style={s.confirm}>
          <Text style={s.confirmText}>Delete this design?</Text>
          <View style={s.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setConfirming(false)}
              style={[s.button, s.buttonLight]}
            >
              <Text style={s.buttonText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Confirm delete: ${record.concept}`}
              onPress={onDelete}
              style={[s.button, s.buttonDanger]}
            >
              <Feather name="trash-2" size={15} color={C.white} />
              <Text style={[s.buttonText, { color: C.white }]}>Delete</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={s.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open design: ${record.concept}`}
            disabled={!ready}
            onPress={onOpen}
            style={[s.button, s.buttonOpen, !ready && { opacity: 0.45 }]}
          >
            <Text style={s.buttonText}>Open</Text>
            <Feather name="arrow-right" size={15} color={C.dark} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Delete design: ${record.concept}`}
            onPress={() => setConfirming(true)}
            style={s.trash}
          >
            <Feather name="trash-2" size={18} color={C.red} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

/** Every design created on this device: images, prompt, date, open and delete. */
export function HistoryView({
  records,
  onOpen,
  onDelete,
  onDeleteMany,
}: {
  records: SavedJob[];
  /** Receives the design’s finished job so it can be shown without another wait. */
  onOpen: (record: SavedJob, job?: StencilJob) => void;
  onDelete: (id: string) => void;
  /** Deletes several designs at once (also used by "Delete all"). */
  onDeleteMany: (ids: string[]) => void;
}) {
  const { width } = useWindowDimensions();
  const columns = width >= 920 ? 3 : width >= 600 ? 2 : 1;
  const cardWidth = columns === 3 ? "31.5%" : columns === 2 ? "48.5%" : "100%";
  const states = useCardStates(records);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<"selected" | "all" | null>(null);

  // Drop selections that no longer exist and leave select mode when nothing is left.
  useEffect(() => {
    setSelected((current) =>
      current.filter((id) => records.some((record) => record.id === id)),
    );
    if (records.length === 0) {
      setSelecting(false);
      setConfirm(null);
    }
  }, [records]);

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  const allSelected = selected.length === records.length;
  const leaveSelecting = () => {
    setSelecting(false);
    setSelected([]);
    setConfirm(null);
  };
  const runDelete = (ids: string[]) => {
    onDeleteMany(ids);
    leaveSelecting();
  };

  return (
    <View style={s.page}>
      <View style={s.head}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={s.title}>Your history</Text>
          <Text style={s.subtitle}>
            {records.length === 0
              ? "Your designs will show up here."
              : `${records.length} saved on this device`}
          </Text>
        </View>
      </View>

      {records.length > 0 && (
        <View style={s.toolbarWrap}>
          {selecting ? (
            <View style={s.toolbar}>
              <Text style={s.selectedCount}>{selected.length} selected</Text>
              <View style={s.toolGroup}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    setSelected(allSelected ? [] : records.map((r) => r.id))
                  }
                  style={s.tool}
                >
                  <Feather
                    name={allSelected ? "square" : "check-square"}
                    size={15}
                    color={C.dark}
                  />
                  <Text style={s.toolText}>
                    {allSelected ? "Clear selection" : "Select all"}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Delete selected designs"
                  disabled={selected.length === 0}
                  onPress={() => setConfirm("selected")}
                  style={[
                    s.tool,
                    s.toolDanger,
                    selected.length === 0 && { opacity: 0.4 },
                  ]}
                >
                  <Feather name="trash-2" size={15} color={C.red} />
                  <Text style={[s.toolText, { color: C.red }]}>
                    Delete selected
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={leaveSelecting}
                  style={[s.tool, s.toolPrimary]}
                >
                  <Text style={s.toolText}>Done</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={s.toolbar}>
              <View style={s.toolGroup}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setConfirm(null);
                    setSelecting(true);
                  }}
                  style={s.tool}
                >
                  <Feather name="check-square" size={15} color={C.dark} />
                  <Text style={s.toolText}>Select</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Delete all designs"
                  onPress={() => setConfirm("all")}
                  style={[s.tool, s.toolDanger]}
                >
                  <Feather name="trash-2" size={15} color={C.red} />
                  <Text style={[s.toolText, { color: C.red }]}>Delete all</Text>
                </Pressable>
              </View>
            </View>
          )}
          {confirm && (
            <View style={s.confirm} accessibilityRole="alert">
              <Text style={s.confirmText}>
                {confirm === "all"
                  ? `Delete all ${records.length} design${records.length === 1 ? "" : "s"}? This can’t be undone.`
                  : `Delete ${selected.length} selected design${selected.length === 1 ? "" : "s"}? This can’t be undone.`}
              </Text>
              <View style={s.actions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setConfirm(null)}
                  style={[s.button, s.buttonLight]}
                >
                  <Text style={s.buttonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    confirm === "all"
                      ? "Confirm delete all"
                      : "Confirm delete selected"
                  }
                  onPress={() =>
                    runDelete(
                      confirm === "all" ? records.map((r) => r.id) : selected,
                    )
                  }
                  style={[s.button, s.buttonDanger]}
                >
                  <Feather name="trash-2" size={15} color={C.white} />
                  <Text style={[s.buttonText, { color: C.white }]}>
                    {confirm === "all" ? "Delete all" : "Delete selected"}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      )}

      {records.length === 0 ? (
        <View style={s.empty}>
          <View style={s.emptyIcon}>
            <Feather name="clock" size={28} color={C.dark} />
          </View>
          <Text style={s.emptyTitle}>No designs yet</Text>
          <Text style={s.emptyText}>
            Every tattoo you create will be saved here, with its date and idea.
          </Text>
        </View>
      ) : (
        <View style={s.grid}>
          {records.map((record) => (
            <HistoryCard
              key={record.id}
              record={record}
              state={states[record.id] ?? { kind: "loading" }}
              width={cardWidth}
              onOpen={() => {
                const state = states[record.id];
                onOpen(record, state?.kind === "ready" ? state.job : undefined);
              }}
              onDelete={() => onDelete(record.id)}
              selecting={selecting}
              selected={selected.includes(record.id)}
              onToggle={() => toggle(record.id)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  page: { paddingVertical: 28, gap: 22, minHeight: 460 },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { fontFamily: F.heading, color: C.text, fontSize: 40, lineHeight: 46 },
  subtitle: { fontFamily: F.body, color: C.muted, fontSize: 14 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 20 },
  card: {
    backgroundColor: C.white,
    borderColor: C.dark,
    borderWidth: 2,
    borderRadius: R.card,
    padding: 14,
    gap: 12,
    shadowColor: C.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  imageArea: {
    aspectRatio: 1,
    width: "100%",
    backgroundColor: C.raised,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: R.control,
    overflow: "hidden",
  },
  mosaic: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    padding: 6,
  },
  tile: {
    width: "48.5%",
    height: "48.5%",
    backgroundColor: C.white,
    borderRadius: 10,
    borderColor: C.line,
    borderWidth: 1,
    overflow: "hidden",
  },
  tileFull: { width: "100%", height: "100%" },
  tileImage: { width: "100%", height: "100%" },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 16,
  },
  placeholderText: {
    fontFamily: F.bold,
    color: C.muted,
    fontSize: 13,
    textAlign: "center",
  },
  prompt: {
    fontFamily: F.heading,
    color: C.text,
    fontSize: 18,
    lineHeight: 24,
    minHeight: 24,
  },
  cardSelected: { borderColor: C.dark, backgroundColor: "#FFF3C4" },
  checkbox: {
    position: "absolute",
    top: 10,
    left: 10,
    zIndex: 2,
    width: 30,
    height: 30,
    borderRadius: 9,
    borderColor: C.dark,
    borderWidth: 2,
    backgroundColor: C.white,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: C.yellow },
  toolbarWrap: { gap: 12 },
  toolbar: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  toolGroup: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  selectedCount: { fontFamily: F.bold, color: C.text, fontSize: 16 },
  tool: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 14,
    backgroundColor: C.white,
    borderColor: C.dark,
    borderWidth: 2,
    borderRadius: R.pill,
  },
  toolDanger: { borderColor: C.red },
  toolPrimary: { backgroundColor: C.yellow },
  toolText: { fontFamily: F.bold, color: C.dark, fontSize: 13 },
  metaRow: { gap: 8 },
  meta: { flexDirection: "row", alignItems: "center", gap: 7 },
  metaText: { fontFamily: F.body, color: C.muted, fontSize: 13 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    backgroundColor: C.yellow,
    borderColor: C.dark,
    borderWidth: 1.5,
    borderRadius: R.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  chipCount: { backgroundColor: C.pink },
  chipText: { fontFamily: F.bold, color: C.dark, fontSize: 11 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  button: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 16,
    borderColor: C.dark,
    borderWidth: 2,
    borderRadius: R.pill,
  },
  buttonOpen: { flex: 1, backgroundColor: C.yellow },
  buttonLight: { flex: 1, backgroundColor: C.white },
  buttonDanger: { flex: 1, backgroundColor: C.red },
  buttonText: { fontFamily: F.bold, color: C.dark, fontSize: 14 },
  trash: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderColor: C.red,
    borderWidth: 2,
    borderRadius: R.pill,
    backgroundColor: C.white,
  },
  confirm: {
    gap: 10,
    backgroundColor: "#FDE7E4",
    borderColor: C.red,
    borderWidth: 1.5,
    borderRadius: R.control,
    padding: 12,
  },
  confirmText: { fontFamily: F.bold, color: C.red, fontSize: 14 },
  empty: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: C.white,
    borderColor: C.dark,
    borderWidth: 2,
    borderRadius: R.card,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: R.pill,
    backgroundColor: C.yellow,
    borderColor: C.dark,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontFamily: F.heading, color: C.text, fontSize: 24 },
  emptyText: {
    fontFamily: F.body,
    color: C.muted,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 380,
  },
});
