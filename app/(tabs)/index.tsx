import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
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
import { C, F, MEDIA, STYLES, StyleId, MediumId } from "@/lib/studio-theme";
import {
  absoluteAsset,
  checkStudio,
  createStencil,
  getStencil,
  loadLibrary,
  loadPendingRequest,
  randomId,
  removeLocalHistory,
  SavedJob,
  StencilJob,
  StencilOption,
  StudioRequestError,
} from "@/lib/stencil-client";
import { printStencil, PrintResult } from "@/lib/stencil-print";
import {
  PrimaryButton,
  SmallButton,
  StudioFooter,
  StudioHeader,
} from "@/components/studio-ui";
import { StudioForm } from "@/components/studio-form";
import { EventPoster } from "@/components/event-poster";
import { useStudioNavigation } from "@/lib/use-studio-navigation";
import { WebAppGuide } from "@/components/web-app-guide";
import { CatalogGallery } from "@/components/catalog-gallery";
import { CATALOG_DESIGNS } from "@/lib/catalog-inspiration";
import type { InspirationPreset } from "@/lib/inspiration-utils";
import { GuestTattooMoment } from "@/components/guest-tattoo-moment";
import { shouldResetGuestJourney } from "@/lib/guest-experience";
import {
  DEFAULT_CATALOG_FILTERS,
  type CatalogFilters,
} from "@/shared/catalog-filters";
import { catalogDisplayTitle } from "@/shared/catalog-labels";
import {
  GenerationProgress,
  PrintConfirmation,
  StencilResults,
} from "@/components/studio-results";

type Screen = "form" | "progress" | "results" | "experience" | "print";
export default function StudioScreen() {
  const [fontsLoaded] = useFonts({
    AvenirNextRegular: require("@/assets/fonts/event/AvenirNextPForBBG-Regular.otf"),
    AvenirNextMedium: require("@/assets/fonts/event/AvenirNextPForBBG-Medium.otf"),
    AvenirNextDemi: require("@/assets/fonts/event/AvenirNextPForBBG-Demi.otf"),
    BloombergPropUnicode: require("@/assets/fonts/event/BloombergPropUnicodeI.ttf"),
  });
  const { width } = useWindowDimensions();
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
  const [inspiration, setInspiration] = useState<InspirationPreset | null>(
    null,
  );
  const galleryTop = useRef(0);
  const submitLock = useRef(false);
  const lastRequest = useRef<{
    concept: string;
    style: StyleId;
    medium: MediumId;
    requestId: string;
    catalogId?: string;
    filters?: CatalogFilters;
  } | null>(null);
  const scroll = useRef<ScrollView>(null);

  useEffect(() => {
    loadLibrary().then(setLibrary);
    checkStudio().then(setOnline);
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
    setInspiration(null);
    setCatalogFilters({ ...DEFAULT_CATALOG_FILTERS });
    setScreen("form");
  }, [tab, screen]);
  useEffect(() => {
    if (!saved) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;
    const poll = async () => {
      try {
        const data = await getStencil(saved);
        if (stopped) return;
        setJob(data);
        setError("");
        failures = 0;
        if (data.status === "ready") {
          setScreen("results");
          loadLibrary().then(setLibrary);
          return;
        }
        if (data.status === "failed") {
          setScreen("progress");
          return;
        }
        timer = setTimeout(poll, 3000);
      } catch (e) {
        if (stopped) return;
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
    catalogId?: string,
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
      catalogId,
      filters: { ...filters },
    };
    try {
      const record = await createStencil(
        concept,
        style,
        medium,
        requestId,
        catalogId,
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
        "catalogId" in request ? request.catalogId : undefined,
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
    setInspiration(null);
    setCatalogFilters({ ...DEFAULT_CATALOG_FILTERS });
    setSaved(null);
    setJob(null);
    lastRequest.current = null;
  };
  const openSaved = (record: SavedJob) => {
    setCatalogFilters(record.filters || { ...DEFAULT_CATALOG_FILTERS });
    setSaved(record);
    setJob(null);
    setError("");
    setSelectedOption(null);
    setShowOriginal(true);
    setScreen("progress");
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
    AsyncStorage.setItem("ohmyink:print-size", String(size));
  };

  if (!fontsLoaded)
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
          <StudioHeader tab={tab} onTab={changeTab} wide={width > 740} />
          {tab === "create" && screen === "form" && (
            <>
              <View style={[s.introRow, compact && { marginTop: 25 }]}>
                <View style={s.liveBadge}>
                  <View
                    style={[
                      s.liveDot,
                      online === false && { backgroundColor: C.red },
                    ]}
                  />
                  <Text style={s.liveText}>BLOOMBERG DAY 2026 · LIVE</Text>
                </View>
                <Text style={s.introNote}>A LITTLE ART. A LITTLE YOU.</Text>
              </View>
              <View
                style={[
                  s.studioBody,
                  !wide && { flexDirection: "column", gap: 22 },
                ]}
              >
                <View style={[s.editorial, !wide && { width: "100%" }]}>
                  <EventPoster compact={compact} />
                </View>
                <View
                  style={[
                    s.formColumn,
                    !wide && {
                      width: "100%",
                    },
                  ]}
                >
                  <StudioForm
                    onGenerate={(concept, style, medium, catalogId, filters) =>
                      generate(
                        concept,
                        style,
                        medium,
                        false,
                        catalogId,
                        filters,
                      )
                    }
                    filters={catalogFilters}
                    onFiltersChange={setCatalogFilters}
                    busy={submitting}
                    inspiration={inspiration}
                    inspirationCount={CATALOG_DESIGNS.length}
                    externalError={error}
                    initialQuery={lastRequest.current?.concept}
                    onBrowseInspiration={() =>
                      scroll.current?.scrollTo({
                        y: galleryTop.current + insets.top,
                        animated: true,
                      })
                    }
                  />
                </View>
              </View>
              <View
                onLayout={(event) => {
                  galleryTop.current = event.nativeEvent.layout.y;
                }}
              >
                <CatalogGallery
                  filters={catalogFilters}
                  onFiltersChange={setCatalogFilters}
                  selectedId={inspiration?.id}
                  onUse={(item) => {
                    setInspiration((previous) => ({
                      id: item.id,
                      title: catalogDisplayTitle(item),
                      concept: catalogDisplayTitle(item),
                      style: item.style,
                      version: (previous?.version || 0) + 1,
                    }));
                    void generate(
                      catalogDisplayTitle(item),
                      item.style,
                      "blackwork",
                      false,
                      item.id,
                      catalogFilters,
                    );
                  }}
                />
              </View>
              <View style={s.howStrip}>
                {[
                  [
                    "01",
                    "FIND YOUR VIBE",
                    "Tell us a theme or browse a collection.",
                  ],
                  [
                    "02",
                    "CATALOG FIRST. THEN AI.",
                    "Artists’ designs first. A new AI idea if there’s no match.",
                  ],
                  [
                    "03",
                    "CHOOSE. TRY. ENJOY.",
                    "Our team brings your tattoo moment to life.",
                  ],
                ].map(([n, title, copy]) => (
                  <View
                    style={[s.howItem, compact && { width: "100%" }]}
                    key={n}
                  >
                    <Text style={s.howNumber}>{n}</Text>
                    <View>
                      <Text style={s.howTitle}>{title}</Text>
                      <Text style={s.howCopy}>{copy}</Text>
                    </View>
                  </View>
                ))}
              </View>
              <View style={s.eventRibbon}>
                <View style={{ flex: 1, minWidth: 160 }}>
                  <Text style={s.ribbonTitle}>Little ideas. Big smiles.</Text>
                  <Text style={s.ribbonCopy}>
                    A simple tattoo moment for the whole family.
                  </Text>
                </View>
                <Image
                  source={require("@/assets/event-brand/waterworks-wide.png")}
                  resizeMode="cover"
                  accessible={false}
                  style={{ width: 220, height: 70, borderRadius: 4 }}
                />
              </View>
              <WebAppGuide />
            </>
          )}
          {tab === "create" && screen === "progress" && (
            <GenerationProgress
              job={job}
              error={error}
              onRetry={retry}
              onBack={newDesign}
              canStartNew={!unconfirmedRequest && !submitting}
            />
          )}
          {tab === "create" &&
            screen === "results" &&
            job?.status === "ready" && (
              <>
                {error && (
                  <View style={s.errorBar}>
                    <Feather
                      name="alert-circle"
                      size={15}
                      color={C.accentInk}
                    />
                    <Text style={s.errorText}>{error}</Text>
                    <Pressable onPress={() => setError("")}>
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
          {tab === "create" &&
            screen === "experience" &&
            job?.status === "ready" &&
            selectedOption && (
              <GuestTattooMoment
                job={job}
                option={selectedOption}
                onBack={() => setScreen("results")}
                onNew={newDesign}
                onArtistPrint={() => void print(selectedOption)}
              />
            )}
          {tab === "create" && screen === "print" && (
            <PrintConfirmation
              pending={printing}
              result={printResult}
              onBack={() =>
                setScreen(selectedOption ? "experience" : "results")
              }
              onNew={newDesign}
            />
          )}
          {tab === "library" && (
            <View style={s.secondary}>
              <Text style={s.eyebrow}>YOUR TATTOO MOMENTS</Text>
              <Text style={s.sectionTitle}>
                YOUR <Text style={s.sectionSerif}>designs.</Text>
              </Text>
              <Text style={s.secondaryCopy}>
                Pick up where you left off. Saved in this browser on this
                device.
              </Text>
              {library.length === 0 ? (
                <View style={s.empty}>
                  <Feather name="layers" size={42} color={C.accentInk} />
                  <Text style={s.emptyTitle}>
                    YOUR STORY STARTS WITH AN IDEA.
                  </Text>
                  <Text style={s.secondaryCopy}>
                    Your catalog finds and AI-created tattoo choices will be
                    waiting here.
                  </Text>
                  <PrimaryButton
                    text="Find my first tattoo"
                    onPress={newDesign}
                    icon="plus"
                  />
                </View>
              ) : (
                <View style={{ marginTop: 30, gap: 12 }}>
                  {library.map((record) => (
                    <Pressable
                      key={record.id}
                      onPress={() => openSaved(record)}
                      style={s.libraryRow}
                    >
                      {record.catalogId &&
                      CATALOG_DESIGNS.find(
                        (item) => item.id === record.catalogId,
                      ) ? (
                        <Image
                          source={
                            CATALOG_DESIGNS.find(
                              (item) => item.id === record.catalogId,
                            )!.art
                          }
                          resizeMode="contain"
                          style={s.libraryThumb}
                        />
                      ) : (
                        <View
                          style={[
                            s.libraryThumb,
                            { alignItems: "center", justifyContent: "center" },
                          ]}
                        >
                          <Feather name="bookmark" size={21} color={C.dark} />
                        </View>
                      )}
                      <View style={{ flex: 1, gap: 7 }}>
                        <Text style={s.libraryConcept}>{record.concept}</Text>
                        <Text style={s.libraryDetail}>
                          Saved tattoo request · open to view artwork
                        </Text>
                        <Text style={s.libraryDate}>
                          {new Date(record.createdAt).toLocaleDateString()}
                        </Text>
                      </View>
                      <Feather
                        name="arrow-up-right"
                        size={22}
                        color={C.accentInk}
                      />
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          )}
          {tab === "settings" && (
            <View style={s.secondary}>
              <Text style={s.eyebrow}>
                ARTIST PREPARATION — NOT THE GUEST JOURNEY
              </Text>
              <Text style={s.sectionTitle}>
                ARTIST <Text style={s.sectionSerif}>settings.</Text>
              </Text>
              <View style={s.settingsPanel}>
                <Text style={s.settingTitle}>PRINT WIDTH</Text>
                <Text style={s.secondaryCopy}>
                  Set the artwork width. Aspect ratio and full-resolution pixels
                  are preserved.
                </Text>
                <View style={s.sizeRow}>
                  {[40, 60, 80, 100].map((size) => (
                    <Pressable
                      onPress={() => updateSize(size)}
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
                <Text style={s.settingNote}>
                  On desktop, use the browser’s system print dialog. On iPad,
                  Safari can print to an AirPrint-compatible printer on the same
                  network. Disable printer-side mirroring—stencils are already
                  mirrored.
                </Text>
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
                <Text style={s.secondaryCopy}>
                  Clearing history removes this device’s access to saved
                  designs. It does not delete stored artwork from the server.
                </Text>
                <SmallButton
                  text="Clear device history"
                  onPress={() => setClearModal(true)}
                  icon="trash-2"
                />
              </View>
              <WebAppGuide />
            </View>
          )}
          <StudioFooter />
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
            <Text style={s.secondaryCopy}>
              Saved design access will be removed from this device. Server
              artwork will not be deleted.
            </Text>
            <PrimaryButton
              text="Clear history"
              onPress={async () => {
                await removeLocalHistory();
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
    gap: 24,
    paddingTop: 24,
    paddingBottom: 34,
  },
  editorial: { width: "42%" },
  eyebrow: {
    color: C.accentInk,
    fontFamily: F.bold,
    fontSize: 9,
    letterSpacing: 1.65,
    marginBottom: 14,
  },
  heroHeading: {
    fontFamily: F.heading,
    fontSize: 59,
    color: C.text,
    lineHeight: 70,
  },
  heroSerif: { fontFamily: F.serif, color: C.accentInk, fontSize: 70 },
  heroCopy: {
    fontFamily: F.body,
    color: C.muted,
    fontSize: 11,
    lineHeight: 20,
    marginTop: 18,
  },
  featuredWrap: { marginTop: 30, paddingHorizontal: 8, paddingBottom: 7 },
  featuredCard: {
    backgroundColor: "#F9F8F3",
    padding: 14,
    borderRadius: 3,
    transform: [{ rotate: "-4deg" }],
  },
  featuredTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  flashLabel: {
    fontFamily: F.bold,
    fontSize: 7,
    color: "#646456",
    letterSpacing: 1,
  },
  featuredArt: { width: "100%", height: 190, marginVertical: 6 },
  featuredBottom: {
    paddingTop: 9,
    borderTopColor: "#DADACF",
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  featuredName: {
    fontFamily: F.heading,
    color: "#262622",
    fontSize: 14,
    letterSpacing: 1,
  },
  featuredSub: { fontFamily: F.body, color: "#66665C", fontSize: 8 },
  featuredTag: {
    backgroundColor: C.yellow,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    padding: 8,
    alignSelf: "flex-end",
    marginTop: -4,
    transform: [{ rotate: "-4deg" }],
    borderRadius: 2,
  },
  featuredTagText: {
    fontFamily: F.bold,
    color: C.dark,
    fontSize: 7,
    letterSpacing: 1,
  },
  promise: { marginTop: 24, gap: 10 },
  promiseItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  promiseText: { fontFamily: F.body, color: "#B3B2A5", fontSize: 9 },
  formColumn: {
    flex: 1,
    backgroundColor: C.white,
    borderColor: C.dark,
    borderWidth: 1,
    borderRadius: 8,
    padding: 26,
  },
  howStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 28,
    justifyContent: "space-between",
    backgroundColor: C.white,
    borderColor: C.dark,
    borderWidth: 1,
    borderRadius: 7,
    padding: 23,
    marginBottom: 32,
  },
  howItem: { flexDirection: "row", alignItems: "center", gap: 15 },
  howNumber: { fontFamily: F.mono, color: C.text, fontSize: 34 },
  howTitle: {
    color: C.text,
    fontFamily: F.heading,
    fontSize: 12,
    letterSpacing: 1.25,
  },
  howCopy: { color: C.muted, fontFamily: F.body, fontSize: 9, marginTop: 6 },
  eventRibbon: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 24,
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 24,
    borderTopColor: C.dark,
    borderTopWidth: 1,
  },
  ribbonTitle: {
    fontFamily: F.heading,
    color: C.text,
    fontSize: 29,
    lineHeight: 35,
  },
  ribbonCopy: {
    fontFamily: F.body,
    color: C.muted,
    fontSize: 12,
    lineHeight: 20,
    marginTop: 8,
  },
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
  libraryRow: {
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 8,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },
  libraryThumb: {
    width: 75,
    height: 75,
    backgroundColor: C.white,
    borderRadius: 5,
  },
  libraryConcept: { color: C.text, fontFamily: F.bold, fontSize: 16 },
  libraryDetail: { color: C.muted, fontFamily: F.body, fontSize: 10 },
  libraryDate: { color: "#6F6F67", fontFamily: F.body, fontSize: 9 },
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
