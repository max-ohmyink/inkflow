import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { C, F, R, StyleId, MediumId } from "@/lib/studio-theme";
import {
  absoluteAsset,
  checkStudio,
  createStencil,
  getStencil,
  loadLibrary,
  loadPendingRequest,
  randomId,
  removeLocalHistory,
  removeSavedJob,
  removeSavedJobs,
  SavedJob,
  StencilJob,
  StencilOption,
  StudioRequestError,
} from "@/lib/stencil-client";
import { printStencil, PrintResult } from "@/lib/stencil-print";
import {
  PrimaryButton,
  SmallButton,
  StudioHeader,
} from "@/components/studio-ui";
import { StudioForm } from "@/components/studio-form";
import { useStudioNavigation } from "@/lib/use-studio-navigation";
import { HistoryView } from "@/components/history-view";
import { CardPattern } from "@/components/studio-backdrop";
import { GuestTattooMoment } from "@/components/guest-tattoo-moment";
import { shouldResetGuestJourney } from "@/lib/guest-experience";
import {
  DEFAULT_CATALOG_FILTERS,
  type CatalogFilters,
} from "@/shared/catalog-filters";
import {
  GenerationProgress,
  PrintConfirmation,
  StencilResults,
} from "@/components/studio-results";

type Screen = "form" | "progress" | "results" | "experience" | "print";

/** Which of the three guest steps each screen belongs to. */
const STEP_OF: Record<Screen, 1 | 2 | 3> = {
  form: 1,
  progress: 2,
  results: 3,
  experience: 3,
  print: 3,
};
/** Order used for the slide direction, including the sub-screens of step 3. */
const SCREEN_ORDER: Record<Screen, number> = {
  form: 0,
  progress: 1,
  results: 2,
  experience: 3,
  print: 4,
};
/** Each step has its own playful badge color. */
const STEPS = [
  { step: 1, n: "1", title: "TELL US YOUR IDEA", color: C.yellow },
  { step: 2, n: "2", title: "AI IS DRAWING", color: C.pink },
  { step: 3, n: "3", title: "PICK & TRY", color: C.cyan },
] as const;
export default function StudioScreen() {
  const [fontsLoaded, fontError] = useFonts({
    AvenirNextRegular: require("@/assets/fonts/event/AvenirNextPForBBG-Regular.otf"),
    AvenirNextMedium: require("@/assets/fonts/event/AvenirNextPForBBG-Medium.otf"),
    AvenirNextDemi: require("@/assets/fonts/event/AvenirNextPForBBG-Demi.otf"),
    BloombergPropUnicode: require("@/assets/fonts/event/BloombergPropUnicodeI.ttf"),
  });
  const { width: windowWidth } = useWindowDimensions();
  // The static web export is pre-rendered at width 0 and hydration does not patch styles that
  // differ, so read the real width only after mount; otherwise desktop keeps the phone layout.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const width = mounted ? windowWidth : 0;
  const insets = useSafeAreaInsets();
  const wide = width >= 920;
  const compact = width < 600;
  const [tab, changeTab] = useStudioNavigation();
  const [screen, setScreen] = useState<Screen>("form");
  const [saved, setSaved] = useState<SavedJob | null>(null);
  const [job, setJob] = useState<StencilJob | null>(null);
  const [library, setLibrary] = useState<SavedJob[]>([]);
  const [error, setError] = useState("");
  const [online, setOnline] = useState<boolean | null>(null);
  const [offline, setOffline] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [unconfirmedRequest, setUnconfirmedRequest] = useState(false);
  const [showOriginal, setShowOriginal] = useState(true);
  const [selectedOption, setSelectedOption] = useState<StencilOption | null>(
    null,
  );
  const [printing, setPrinting] = useState(false);
  const [printResult, setPrintResult] = useState<PrintResult | null>(null);
  const [sizeMm, setSizeMm] = useState(60);
  const [clearModal, setClearModal] = useState(false);
  const [retryCounter, setRetryCounter] = useState(0);
  const [catalogFilters, setCatalogFilters] = useState<CatalogFilters>({
    ...DEFAULT_CATALOG_FILTERS,
  });
  const submitLock = useRef(false);
  const lastRequest = useRef<{
    concept: string;
    style: StyleId;
    medium: MediumId;
    requestId: string;
    filters?: CatalogFilters;
  } | null>(null);
  const scroll = useRef<ScrollView>(null);

  // Steps 1–3 share one card; only its content changes, sliding in from the side it comes from.
  const step = STEP_OF[screen];
  const slide = useRef(new Animated.Value(1)).current;
  const slideFrom = useRef(1);
  const previousScreen = useRef<Screen>(screen);
  const lastStepThreeScreen = useRef<Screen>("results");
  useEffect(() => {
    if (previousScreen.current === screen) return;
    slideFrom.current =
      SCREEN_ORDER[screen] >= SCREEN_ORDER[previousScreen.current] ? 1 : -1;
    previousScreen.current = screen;
    if (STEP_OF[screen] === 3 && screen !== "print")
      lastStepThreeScreen.current = screen;
    slide.setValue(0);
    Animated.timing(slide, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [screen, slide]);
  const fullWidthStep = step === 3;
  const [formCardHeight, setFormCardHeight] = useState(0);
  const hasRequest = Boolean(submitting || saved || job || unconfirmedRequest);
  const ready = job?.status === "ready";
  // One-way steps: a finished step can never be reopened; only an available later step can be.
  // Starting over is a separate, explicit "Start a new design" action that clears the old one.
  const stepEnabled = (target: 1 | 2 | 3) =>
    target > step && (target === 2 ? hasRequest : ready);
  const goToStep = (target: 1 | 2 | 3) => {
    if (!stepEnabled(target)) return;
    if (target === 2) setScreen("progress");
    else
      setScreen(
        lastStepThreeScreen.current === "experience" && selectedOption
          ? "experience"
          : "results",
      );
  };

  useEffect(() => {
    loadLibrary().then(setLibrary);
    checkStudio().then(setOnline);
    const syncOffline = () =>
      setOffline(
        typeof navigator !== "undefined" && navigator.onLine === false,
      );
    syncOffline();
    if (typeof window !== "undefined" && window.addEventListener) {
      window.addEventListener("online", syncOffline);
      window.addEventListener("offline", syncOffline);
    }
    loadPendingRequest().then((pending) => {
      if (!pending) return;
      lastRequest.current = pending;
      setUnconfirmedRequest(true);
      setCatalogFilters(pending.filters || { ...DEFAULT_CATALOG_FILTERS });
      setScreen("progress");
      changeTab("create");
      setError(
        "Your previous submission was interrupted. Reconnect to recover the same request without creating another request.",
      );
    });
    AsyncStorage.getItem("ohmyink:print-size").then((v) => {
      if (v && [40, 60, 80, 100].includes(Number(v))) setSizeMm(Number(v));
    });
    return () => {
      if (typeof window !== "undefined" && window.removeEventListener) {
        window.removeEventListener("online", syncOffline);
        window.removeEventListener("offline", syncOffline);
      }
    };
  }, []);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [screen, tab]);
  useEffect(() => {
    if (tab === "library") loadLibrary().then(setLibrary);
  }, [tab]);
  useEffect(() => {
    if (!shouldResetGuestJourney(tab, screen)) return;
    setSelectedOption(null);
    setCatalogFilters({ ...DEFAULT_CATALOG_FILTERS });
    setScreen("form");
  }, [tab, screen]);
  useEffect(() => {
    if (!saved) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;
    const startedAt = Date.now();
    const poll = async () => {
      try {
        const data = await getStencil(saved);
        if (stopped) return;
        setJob(data);
        setError(
          data.status !== "ready" &&
            data.status !== "failed" &&
            Date.now() - startedAt > 90000
            ? "This is taking longer than usual. You can keep waiting or start a new search."
            : "",
        );
        failures = 0;
        // Only advance a guest who is still watching step 2; someone who went back to step 1
        // stays there, and step 03 simply becomes available in the step bar.
        if (data.status === "ready") {
          setScreen((current) =>
            current === "progress" ? "results" : current,
          );
          loadLibrary().then(setLibrary);
          return;
        }
        if (data.status === "failed") {
          setScreen((current) => (current === "form" ? current : "progress"));
          return;
        }
        // Poll aggressively so a finished design appears almost immediately.
        timer = setTimeout(poll, Date.now() - startedAt < 10000 ? 300 : 800);
      } catch (e) {
        if (stopped) return;
        if (
          e instanceof StudioRequestError &&
          (e.status === 401 || e.status === 404)
        ) {
          // Access is gone for good; retrying can never succeed.
          setError(e.message);
          return;
        }
        failures += 1;
        if (failures >= 4) {
          setError(
            `${e instanceof Error ? e.message : "Connection interrupted."} Your request is saved in My designs. Reconnect before finding another set.`,
          );
          return;
        }
        timer = setTimeout(poll, 4000);
      }
    };
    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [saved?.id, saved?.token, retryCounter]);

  const generate = async (
    concept: string,
    style: StyleId,
    medium: MediumId,
    reuseRequest = false,
    filters: CatalogFilters = DEFAULT_CATALOG_FILTERS,
  ) => {
    if (submitLock.current) return;
    submitLock.current = true;
    setSubmitting(true);
    setError("");
    setJob(null);
    setSaved(null);
    setSelectedOption(null);
    setScreen("progress");
    changeTab("create");
    const requestId =
      reuseRequest && lastRequest.current
        ? lastRequest.current.requestId
        : randomId();
    lastRequest.current = {
      concept,
      style,
      medium,
      requestId,
      filters: { ...filters },
    };
    try {
      const record = await createStencil(
        concept,
        style,
        medium,
        requestId,
        filters,
      );
      setUnconfirmedRequest(false);
      setSaved(record);
      setLibrary(await loadLibrary());
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not connect to the studio.",
      );
      const pending = await loadPendingRequest();
      setUnconfirmedRequest(Boolean(pending));
      if (pending) {
        lastRequest.current = pending;
        setCatalogFilters(pending.filters || { ...DEFAULT_CATALOG_FILTERS });
      }
      if (e instanceof StudioRequestError && e.status === 400)
        setScreen("form");
    } finally {
      setSubmitting(false);
      submitLock.current = false;
    }
  };
  const retry = () => {
    if (saved && job?.status !== "failed") {
      setError("");
      setRetryCounter((v) => v + 1);
      return;
    }
    const request =
      lastRequest.current ||
      (saved ? { ...saved, requestId: randomId() } : null);
    if (request)
      generate(
        request.concept,
        request.style,
        request.medium,
        !saved,
        request.filters || { ...DEFAULT_CATALOG_FILTERS },
      );
  };
  const newDesign = () => {
    if (unconfirmedRequest || submitting) {
      setSaved(null);
      setJob(null);
      setSelectedOption(null);
      setCatalogFilters(
        lastRequest.current?.filters || { ...DEFAULT_CATALOG_FILTERS },
      );
      setScreen("progress");
      changeTab("create");
      setError(
        "Reconnect to confirm your existing request before starting another search. Its saved access credential is being kept safe.",
      );
      return;
    }
    setScreen("form");
    changeTab("create");
    setError("");
    setShowOriginal(true);
    setSelectedOption(null);
    setCatalogFilters({ ...DEFAULT_CATALOG_FILTERS });
    setSaved(null);
    setJob(null);
    lastRequest.current = null;
  };
  /**
   * Opens a saved design. When the history page already has its finished job, the results show at
   * once instead of passing through the "AI is drawing" step while the job is fetched again.
   */
  const openSaved = (record: SavedJob, loaded?: StencilJob) => {
    const ready = loaded?.status === "ready";
    setCatalogFilters(record.filters || { ...DEFAULT_CATALOG_FILTERS });
    setSaved(record);
    setJob(ready ? loaded : null);
    setError("");
    setSelectedOption(null);
    setShowOriginal(true);
    setScreen(ready ? "results" : "progress");
    changeTab("create");
    setRetryCounter((v) => v + 1);
  };
  const print = async (option: StencilOption) => {
    if (printing) return;
    setPrinting(true);
    setPrintResult(null);
    setScreen("print");
    try {
      const result = await printStencil(absoluteAsset(option.pngUrl), sizeMm);
      setPrintResult(result);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Printing was cancelled or unavailable.",
      );
      setScreen("results");
    } finally {
      setPrinting(false);
    }
  };
  const updateSize = (size: number) => {
    setSizeMm(size);
    AsyncStorage.setItem("ohmyink:print-size", String(size)).catch(() => {});
  };

  if (!fontsLoaded && !fontError)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: C.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={C.accentInk} />
      </View>
    );
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: insets.top,
          paddingBottom: Math.max(insets.bottom, 12),
          paddingHorizontal: compact ? 16 : 32,
          flexGrow: 1,
        }}
      >
        <View style={s.container}>
          <StudioHeader
            historyCount={library.length}
            inHistory={tab === "library"}
            onHistory={() => changeTab("library")}
            onNew={newDesign}
            status={
              tab === "create" ? (
                <View style={s.liveBadge}>
                  <View
                    style={[
                      s.liveDot,
                      (online === false || offline) && {
                        backgroundColor: C.red,
                      },
                    ]}
                  />
                  <Text style={s.liveText}>
                    {offline
                      ? "BLOOMBERG DAY 2026 · OFFLINE"
                      : "BLOOMBERG DAY 2026 · LIVE"}
                  </Text>
                </View>
              ) : undefined
            }
          />
          {tab === "create" && (
            <>
              {/* One-way step bar: finished steps show a check and stay locked. */}
              <View
                accessibilityRole="tablist"
                style={[s.howStrip, compact && { gap: 4 }]}
              >
                {STEPS.map((item) => {
                  const active = item.step === step;
                  const enabled = stepEnabled(item.step);
                  const done = item.step < step;
                  const upcoming = item.step > step;
                  return (
                    <Pressable
                      key={item.n}
                      accessibilityRole="tab"
                      accessibilityState={{
                        selected: active,
                        disabled: !enabled,
                      }}
                      disabled={!enabled}
                      onPress={() => goToStep(item.step)}
                      style={({ pressed }) => [
                        s.howItem,
                        compact && { width: "100%" },
                        active && s.howItemActive,
                        upcoming && !enabled && s.howItemDisabled,
                        enabled && pressed && s.howItemHover,
                      ]}
                    >
                      <View
                        style={[
                          s.howNumberBox,
                          { backgroundColor: done ? C.white : item.color },
                        ]}
                      >
                        {done ? (
                          <Feather name="check" size={18} color={C.blue} />
                        ) : (
                          <Text style={s.howNumber}>{item.n}</Text>
                        )}
                      </View>
                      <Text style={[s.howTitle, done && s.howTitleDone]}>
                        {item.title}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {/* Steps 1–2 share one card beside the poster; step 3 drops the card and goes full width. */}
              <View
                style={[
                  s.studioBody,
                  !wide && { flexDirection: "column", gap: 22 },
                ]}
              >
                <View
                  // Step 2 uses exactly the height the step 1 form card had.
                  onLayout={(e) => {
                    if (screen === "form")
                      setFormCardHeight(e.nativeEvent.layout.height);
                  }}
                  style={[
                    fullWidthStep ? s.fullWidthStep : s.formColumn,
                    !wide && {
                      width: "100%",
                    },
                    step === 2 &&
                      formCardHeight > 0 && {
                        // minHeight too: in the phone's column layout `flex: 1` would shrink it.
                        height: formCardHeight,
                        minHeight: formCardHeight,
                      },
                  ]}
                >
                  {/* The same yellow, blue and pink shapes as the page, inside the card. */}
                  {!fullWidthStep && <CardPattern />}
                  <Animated.View
                    key={screen}
                    style={{
                      ...(step === 2 && {
                        flex: 1,
                        justifyContent: "center",
                      }),
                      opacity: slide,
                      transform: [
                        {
                          translateX: slide.interpolate({
                            inputRange: [0, 1],
                            outputRange: [40 * slideFrom.current, 0],
                          }),
                        },
                      ],
                    }}
                  >
                    {screen === "form" && (
                      <StudioForm
                        onGenerate={(concept, style, medium, filters) =>
                          generate(concept, style, medium, false, filters)
                        }
                        filters={catalogFilters}
                        onFiltersChange={setCatalogFilters}
                        busy={submitting}
                        offline={offline}
                        externalError={error}
                        initialQuery={lastRequest.current?.concept}
                        wide={!compact}
                      />
                    )}
                    {screen === "progress" && (
                      <GenerationProgress
                        job={job}
                        error={error}
                        onRetry={retry}
                        onBack={newDesign}
                        canStartNew={!unconfirmedRequest && !submitting}
                      />
                    )}
                    {screen === "results" && job?.status === "ready" && (
                      <>
                        {error && (
                          <View style={s.errorBar}>
                            <Feather
                              name="alert-circle"
                              size={15}
                              color={C.accentInk}
                            />
                            <Text style={s.errorText}>{error}</Text>
                            <Pressable
                              onPress={() => setError("")}
                              accessibilityRole="button"
                              accessibilityLabel="Dismiss message"
                              hitSlop={12}
                            >
                              <Feather name="x" size={18} color={C.muted} />
                            </Pressable>
                          </View>
                        )}
                        <StencilResults
                          job={job}
                          showOriginal={showOriginal}
                          onToggleOriginal={() => setShowOriginal((v) => !v)}
                          onSelect={(option) => {
                            setSelectedOption(option);
                            setScreen("experience");
                          }}
                          onPrint={print}
                          onNew={newDesign}
                          compact={compact}
                          printing={printing}
                          sizeMm={sizeMm}
                        />
                      </>
                    )}
                    {screen === "experience" &&
                      job?.status === "ready" &&
                      selectedOption && (
                        <GuestTattooMoment
                          job={job}
                          option={selectedOption}
                          onBack={() => setScreen("results")}
                          onNew={newDesign}
                        />
                      )}
                    {screen === "print" && (
                      <PrintConfirmation
                        pending={printing}
                        result={printResult}
                        onBack={() =>
                          setScreen(selectedOption ? "experience" : "results")
                        }
                        onNew={newDesign}
                      />
                    )}
                  </Animated.View>
                </View>
              </View>
            </>
          )}
          {tab === "library" && (
            <HistoryView
              records={library}
              onOpen={openSaved}
              onDeleteMany={async (ids) => {
                setLibrary(await removeSavedJobs(ids));
                // If the loaded design was deleted, the flow must not keep pointing at it.
                if (saved && ids.includes(saved.id)) {
                  setSaved(null);
                  setJob(null);
                  setSelectedOption(null);
                  setScreen("form");
                }
              }}
              onDelete={async (id) => {
                setLibrary(await removeSavedJob(id));
                // If the loaded design was deleted, the flow must not keep pointing at it.
                if (saved?.id === id) {
                  setSaved(null);
                  setJob(null);
                  setSelectedOption(null);
                  setScreen("form");
                }
              }}
            />
          )}
          {tab === "settings" && (
            <View style={s.secondary}>
              <Text style={s.sectionTitle}>
                ARTIST <Text style={s.sectionSerif}>settings.</Text>
              </Text>
              <View style={s.settingsPanel}>
                <Text style={s.settingTitle}>PRINT WIDTH</Text>
                <View style={s.sizeRow}>
                  {[40, 60, 80, 100].map((size) => (
                    <Pressable
                      onPress={() => updateSize(size)}
                      accessibilityRole="button"
                      accessibilityLabel={`Print width ${size} millimetres`}
                      accessibilityState={{ selected: size === sizeMm }}
                      key={size}
                      style={[
                        s.sizeButton,
                        size === sizeMm && {
                          backgroundColor: C.yellow,
                          borderColor: C.yellow,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          s.sizeText,
                          size === sizeMm && { color: C.dark },
                        ]}
                      >
                        {size} mm
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={s.settingDivider} />
                <View style={s.statusRow}>
                  <View>
                    <Text style={s.settingTitle}>
                      SYSTEM PRINTING / AIRPRINT
                    </Text>
                    <Text style={s.secondaryCopy}>
                      Choose your printer in the system print dialog.
                    </Text>
                  </View>
                  <Feather name="printer" size={24} color={C.accentInk} />
                </View>
                <View style={s.settingDivider} />
                <View style={s.statusRow}>
                  <View>
                    <Text style={s.settingTitle}>STUDIO CONNECTION</Text>
                    <Text style={s.secondaryCopy}>
                      {online === null
                        ? "Checking…"
                        : online
                          ? "Backend online"
                          : "Backend unavailable"}
                    </Text>
                  </View>
                  <SmallButton
                    text="Check"
                    icon="refresh-cw"
                    onPress={() => {
                      setOnline(null);
                      checkStudio().then(setOnline);
                    }}
                  />
                </View>
              </View>
              <View style={s.settingsPanel}>
                <Text style={s.settingTitle}>THIS DEVICE’S DESIGN HISTORY</Text>
                <SmallButton
                  text="Clear device history"
                  onPress={() => setClearModal(true)}
                  icon="trash-2"
                />
              </View>
            </View>
          )}
        </View>
      </ScrollView>
      <Modal
        transparent
        visible={clearModal}
        animationType="fade"
        onRequestClose={() => setClearModal(false)}
      >
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <Text style={s.emptyTitle}>CLEAR DEVICE HISTORY?</Text>
            <PrimaryButton
              text="Clear history"
              onPress={async () => {
                try {
                  await removeLocalHistory();
                } catch {
                  setClearModal(false);
                  setError(
                    "Could not clear history on this device. Please try again.",
                  );
                  return;
                }
                setUnconfirmedRequest(false);
                lastRequest.current = null;
                setLibrary([]);
                setClearModal(false);
              }}
              icon="trash-2"
            />
            <SmallButton
              text="Keep my designs"
              onPress={() => setClearModal(false)}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
const s = StyleSheet.create({
  container: { width: "100%", maxWidth: 1350, alignSelf: "center", flex: 1 },
  introRow: {
    marginTop: 31,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderColor: C.dark,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.yellow },
  liveText: {
    color: C.accentInk,
    fontFamily: F.bold,
    fontSize: 8,
    letterSpacing: 1.25,
  },
  introNote: {
    color: C.muted,
    fontFamily: F.body,
    fontSize: 8,
    letterSpacing: 1.4,
  },
  studioBody: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 24,
    paddingTop: 20,
    paddingBottom: 34,
  },
  eyebrow: {
    color: C.accentInk,
    fontFamily: F.bold,
    fontSize: 9,
    letterSpacing: 1.65,
    marginBottom: 14,
  },
  formColumn: {
    flex: 1,
    backgroundColor: C.white,
    borderColor: C.dark,
    borderWidth: 2,
    borderRadius: R.card,
    padding: 26,
    // Keeps the sliding step content inside the card.
    overflow: "hidden",
    minHeight: 460,
  },
  // Step 3: full width, no card frame (as before), still clipping the slide.
  fullWidthStep: { flex: 1, overflow: "hidden" },
  howStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
    backgroundColor: C.white,
    borderColor: C.dark,
    borderWidth: 2,
    borderRadius: R.card,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 20,
  },
  howItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 16,
    borderRadius: R.pill,
    borderWidth: 2,
    borderColor: "transparent",
  },
  howItemActive: { borderColor: C.dark, backgroundColor: C.bg },
  howItemHover: { backgroundColor: C.bg },
  howItemDisabled: { opacity: 0.4 },
  // Round, colored number badges (yellow, pink, cyan); a white check once a step is done.
  howNumberBox: {
    width: 38,
    height: 38,
    borderRadius: R.pill,
    borderWidth: 2,
    borderColor: C.dark,
    alignItems: "center",
    justifyContent: "center",
  },
  howNumber: { fontFamily: F.heading, color: C.text, fontSize: 19 },
  howTitle: {
    color: C.text,
    fontFamily: F.heading,
    fontSize: 13,
    letterSpacing: 1.1,
  },
  howTitleDone: { color: C.muted },
  howCopy: { color: C.muted, fontFamily: F.body, fontSize: 9, marginTop: 6 },
  secondary: { paddingVertical: 45, minHeight: 570 },
  sectionTitle: { fontFamily: F.heading, fontSize: 47, color: C.text },
  sectionSerif: { fontFamily: F.serif, fontSize: 56, color: C.accentInk },
  secondaryCopy: {
    fontFamily: F.body,
    color: C.muted,
    fontSize: 12,
    lineHeight: 20,
    marginTop: 9,
  },
  empty: { paddingVertical: 70, gap: 20, alignItems: "center" },
  emptyTitle: {
    fontFamily: F.heading,
    fontSize: 23,
    color: C.text,
    textAlign: "center",
  },
  settingsPanel: {
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 8,
    padding: 24,
    gap: 14,
    marginTop: 24,
    maxWidth: 800,
  },
  settingTitle: {
    fontFamily: F.heading,
    color: C.text,
    fontSize: 16,
    letterSpacing: 1,
  },
  sizeRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 5 },
  sizeButton: {
    padding: 15,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 5,
    minWidth: 76,
    alignItems: "center",
  },
  sizeText: { color: C.text, fontFamily: F.bold, fontSize: 12 },
  settingDivider: { height: 1, backgroundColor: C.line, marginVertical: 8 },
  statusRow: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    alignItems: "center",
  },
  settingNote: {
    color: C.muted,
    fontFamily: F.body,
    fontSize: 11,
    lineHeight: 18,
  },
  errorBar: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    backgroundColor: C.yellow,
    padding: 16,
    marginTop: 20,
    borderRadius: 6,
  },
  errorText: {
    flex: 1,
    fontFamily: F.body,
    color: C.text,
    fontSize: 11,
    lineHeight: 18,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "#000000BB",
    justifyContent: "center",
    padding: 25,
  },
  modalCard: {
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 13,
    padding: 27,
    gap: 23,
    maxWidth: 440,
    width: "100%",
    alignSelf: "center",
  },
});
