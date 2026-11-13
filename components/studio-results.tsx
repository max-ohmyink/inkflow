import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F } from "@/lib/studio-theme";
import {
  absoluteAsset,
  type StencilJob,
  type StencilOption,
} from "@/lib/stencil-client";
import { canDownloadStencil, downloadStencil } from "@/lib/stencil-download";
import { stencilFileName } from "@/lib/studio-navigation";
import {
  artworkVersionLabel,
  compareOriginalLabel,
  sourceArtworkLabel,
  tattooPreviewUrl,
  colorAvailabilityWarning,
  missingColorSummary,
} from "@/lib/guest-experience";
import { ArtworkImage } from "./artwork-image";
import { PrimaryButton, SmallButton } from "./studio-ui";

export function GenerationProgress({
  job,
  error,
  onRetry,
  onBack,
  canStartNew = true,
}: {
  job: StencilJob | null;
  error: string;
  onRetry: () => void;
  onBack: () => void;
  canStartNew?: boolean;
}) {
  const failed = !!error || job?.status === "failed";
  const progress = Math.max(3, Math.min(100, job?.progress || 5));
  const stage =
    progress < 30
      ? "Exploring your idea"
      : progress < 75
        ? "Creating your AI designs"
        : "Getting your choices ready";
  return (
    <View style={s.progressPanel}>
      <View style={s.iconCircle}>
        {failed ? (
          <Feather name="alert-triangle" size={29} color={C.red} />
        ) : (
          <ActivityIndicator size="large" color={C.blue} />
        )}
      </View>
      <Text style={s.eyebrow}>
        {failed ? "A LITTLE PAUSE" : "A NEW AI INK MOMENT"}
      </Text>
      <Text style={s.progressTitle}>
        {failed ? "LET’S TRY THAT AGAIN." : "A LITTLE MORE YOU. COMING UP."}
      </Text>
      <Text style={s.progressCopy}>
        {failed
          ? error ||
            job?.error ||
            "Your AI tattoo ideas hit a little pause. Please try again."
          : "AI is creating simple tattoo choices for your idea, then preparing your chosen colors—including filled petals, leaves and enclosed shapes."}
      </Text>
      {!failed && (
        <>
          <View style={s.track}>
            <View style={[s.fill, { width: `${progress}%` }]} />
          </View>
          <View style={s.progressSteps}>
            {["Your idea", "AI creation", "Your tattoo choices"].map((label, i) => (
              <View key={label} style={s.progressStep}>
                <Feather
                  name={progress >= (i + 1) * 32 ? "check-circle" : "circle"}
                  size={13}
                  color={progress >= (i + 1) * 32 ? C.blue : C.muted}
                />
                <Text style={s.stepText}>{label}</Text>
              </View>
            ))}
          </View>
          <Text style={s.stage}>
            {stage} · {Math.round(progress)}%
          </Text>
        </>
      )}
      {failed && (
        <PrimaryButton
          text={
            job?.status === "failed"
              ? "Try my tattoo again"
              : "Reconnect to my request"
          }
          onPress={onRetry}
          icon="refresh-cw"
        />
      )}
      {canStartNew ? (
        <SmallButton
          text="Back to the tattoo finder"
          onPress={onBack}
          icon="arrow-left"
        />
      ) : (
        <Text style={s.progressCopy}>
          Your request is kept safe. Reconnect before starting another search.
        </Text>
      )}
    </View>
  );
}

export function StencilResults({
  job,
  showOriginal,
  onToggleOriginal,
  onSelect,
  onPrint,
  onNew,
  compact,
  printing,
  sizeMm,
}: {
  job: StencilJob;
  showOriginal: boolean;
  onToggleOriginal: () => void;
  onSelect: (option: StencilOption) => void;
  onPrint: (option: StencilOption) => void;
  onNew: () => void;
  compact: boolean;
  printing: boolean;
  sizeMm: number;
}) {
  const [artistTools, setArtistTools] = useState(false);
  const [showOriginalArtwork, setShowOriginalArtwork] = useState(
    job.filters?.artStyle === "watercolor",
  );
  const hasColorVersion = job.options.some((option) =>
    Boolean(option.colorUrl),
  );
  const missingColors = missingColorSummary(job.options);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState("");
  const exportFile = async (option: StencilOption, kind: "png" | "svg") => {
    if (downloading) return;
    const url = kind === "svg" ? option.svgUrl : option.pngUrl;
    if (!url) return;
    setDownloading(`${option.id}:${kind}`);
    setDownloadError("");
    try {
      await downloadStencil(
        absoluteAsset(url),
        stencilFileName(
          option.title ?? job.concept,
          option.index,
          kind,
        ),
      );
    } catch (error) {
      setDownloadError(
        error instanceof Error
          ? error.message
          : "The preparation file could not be downloaded.",
      );
    } finally {
      setDownloading(null);
    }
  };
  return (
    <View style={s.results}>
      <View style={s.resultHeader}>
        <View>
          <Text style={s.eyebrow}>
            {artistTools ? "ARTIST PREPARATION" : "AI-CREATED FOR YOU."}
          </Text>
          <Text style={s.resultTitle}>
            PICK YOUR <Text style={s.serif}>ink.</Text>
          </Text>
          <Text style={s.resultSub}>
            {`${job.options.length} AI-created ${job.options.length === 1 ? "design" : "designs"} for “${job.concept}”.`}
          </Text>
        </View>
        <SmallButton text="Find another tattoo" onPress={onNew} icon="plus" />
      </View>
      {!artistTools && job.filters?.artStyle === "watercolor" && (
        <Text style={s.noticeText}>
          Watercolor is a digital look, shown from the original painted artwork.
          Selected-ink versions use flat fills; your artist may simplify the
          design.
        </Text>
      )}
      {!artistTools && !!missingColors && (
        <View
          accessibilityRole="alert"
          style={[s.transferNotice, s.warningNotice]}
        >
          <Feather name="alert-circle" size={20} color={C.red} />
          <View style={{ flex: 1, gap: 8 }}>
            <Text style={s.noticeTitle}>REQUESTED COLORS NOT GENERATED</Text>
            <Text style={s.noticeText}>{missingColors}</Text>
          </View>
        </View>
      )}
      <View style={s.toolbar}>
        <View style={s.badge}>
          <Feather
            name={artistTools ? "tool" : "heart"}
            size={13}
            color={C.text}
          />
          <Text style={s.badgeText}>
            {artistTools
              ? showOriginal
                ? "GUEST ARTWORK"
                : "MIRRORED ARTIST PREPARATION"
              : hasColorVersion && !showOriginalArtwork
                ? "AI DESIGN · YOUR COLORS"
                : "AI-CREATED ARTWORK"}
          </Text>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {hasColorVersion && (
            <SmallButton
              text={
                showOriginalArtwork
                  ? job.filters?.artStyle === "watercolor"
                    ? "View flat ink version"
                    : "View color version"
                  : compareOriginalLabel(job.source)
              }
              onPress={() => setShowOriginalArtwork((value) => !value)}
              icon="repeat"
            />
          )}
          {artistTools && (
            <Pressable
              onPress={onToggleOriginal}
              accessibilityRole="button"
              style={s.toggle}
            >
              <Feather name="repeat" size={13} color={C.text} />
              <Text style={s.toggleText}>
                {showOriginal ? "Show mirrored stencil" : "View guest artwork"}
              </Text>
            </Pressable>
          )}
          <SmallButton
            text={artistTools ? "Back to guest view" : "Artist tools"}
            onPress={() => setArtistTools((value) => !value)}
            icon="sliders"
          />
        </View>
      </View>
      <View style={s.resultCards}>
        {job.options.map((option, i) => (
          <View
            key={option.id}
            style={[s.resultCard, { width: compact ? "100%" : "48.5%" }]}
          >
            <View style={s.resultArt}>
              <ArtworkImage
                uri={absoluteAsset(
                  tattooPreviewUrl(
                    option,
                    artistTools,
                    showOriginal,
                    showOriginalArtwork,
                  ),
                )}
                accessibilityLabel={`${artistTools && !showOriginal ? "Mirrored artist preparation" : artworkVersionLabel(option, showOriginalArtwork)} option ${i + 1}`}
                style={s.resultImage}
              />
              <Text style={s.optionNumber}>0{i + 1}</Text>
            </View>
            <View style={s.resultMeta}>
              <Text style={s.variation}>
                {option.title ?? `AI DESIGN 0${i + 1}`}
              </Text>
              {artistTools && (
                <Text style={s.resolution}>
                  {option.width} × {option.height} PX
                </Text>
              )}
            </View>
            <PrimaryButton
              text={artistTools ? "Select & Print" : "Choose my tattoo"}
              icon={artistTools ? "printer" : "heart"}
              onPress={() => {
                if (artistTools) onPrint(option);
                else onSelect(option);
              }}
              disabled={printing}
            />
            <Text style={s.cardNote}>
              {artistTools
                ? `Mirrored stencil PNG · ${sizeMm} mm print width`
                : sourceArtworkLabel(option.source ?? job.source)}
            </Text>
            {!!colorAvailabilityWarning(option) && (
              <Text accessibilityRole="alert" style={s.colorWarning}>
                {colorAvailabilityWarning(option)} You can still choose and save
                this original.
              </Text>
            )}
            {artistTools && canDownloadStencil && (
              <View style={s.downloads}>
                <SmallButton
                  text={
                    downloading === `${option.id}:png`
                      ? "Preparing…"
                      : "Download PNG"
                  }
                  icon="download"
                  onPress={() => void exportFile(option, "png")}
                />
                {!!option.svgUrl && (
                  <SmallButton
                    text={
                      downloading === `${option.id}:svg`
                        ? "Preparing…"
                        : "Download SVG"
                    }
                    icon="download"
                    onPress={() => void exportFile(option, "svg")}
                  />
                )}
              </View>
            )}
          </View>
        ))}
      </View>
      {artistTools && !!downloadError && (
        <Text accessibilityRole="alert" style={s.downloadError}>
          {downloadError}
        </Text>
      )}
      <View style={s.transferNotice}>
        <Feather
          name={artistTools ? "info" : "smile"}
          size={15}
          color={C.blue}
        />
        <Text style={s.noticeText}>
          {artistTools
            ? "Artist preparation: stencils come from the source original artwork, are mirrored once and print in black. Filled color versions are separate guest artwork. Disable printer-side mirroring."
            : "Temporary, not forever. Choose the one that feels like you and show your choice to our team—we’ll guide your needle-free tattoo experience."}
        </Text>
      </View>
    </View>
  );
}

export function PrintConfirmation({
  pending,
  result,
  onBack,
  onNew,
}: {
  pending: boolean;
  result: "dialog-opened" | "submitted" | null;
  onBack: () => void;
  onNew: () => void;
}) {
  return (
    <View style={s.progressPanel}>
      <View style={s.iconCircle}>
        {pending ? (
          <ActivityIndicator size="large" color={C.blue} />
        ) : (
          <Feather name="printer" size={32} color={C.blue} />
        )}
      </View>
      <Text style={s.eyebrow}>ARTIST PREPARATION</Text>
      <Text style={s.progressTitle}>
        {pending
          ? "PREPARING YOUR STENCIL..."
          : result === "submitted"
            ? "SENT TO THE PRINT SYSTEM"
            : "PRINT DIALOG OPENED"}
      </Text>
      <Text style={[s.serif, { fontSize: 36, marginTop: 5 }]}>
        Please see your artist!
      </Text>
      <Text style={s.progressCopy}>
        {pending
          ? "Preparing the original-resolution mirrored stencil and opening the system print dialog."
          : result === "submitted"
            ? "The preparation file was handed to the iPad print system. Confirm the physical print with your artist."
            : "Choose the connected printer and confirm Print in the system dialog. Opening the dialog does not confirm a physical print."}
      </Text>
      <PrimaryButton
        text="Find another tattoo"
        onPress={onNew}
        icon="plus"
        disabled={pending}
      />
      <SmallButton
        text="Back to the tattoo choice"
        onPress={onBack}
        icon="arrow-left"
      />
    </View>
  );
}

const s = StyleSheet.create({
  results: { paddingVertical: 38, gap: 24 },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 15,
    flexWrap: "wrap",
  },
  eyebrow: {
    fontFamily: F.bold,
    color: C.text,
    fontSize: 10,
    letterSpacing: 1.1,
    marginBottom: 10,
  },
  resultTitle: { fontFamily: F.heading, color: C.text, fontSize: 43 },
  serif: { color: C.blue, fontFamily: F.serif, fontSize: 43 },
  resultSub: {
    fontFamily: F.body,
    color: C.muted,
    fontSize: 12,
    marginTop: 9,
    lineHeight: 18,
  },
  toolbar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    alignItems: "center",
    justifyContent: "space-between",
  },
  badge: { flexDirection: "row", gap: 7, alignItems: "center" },
  badgeText: {
    fontFamily: F.bold,
    color: C.text,
    fontSize: 9,
    letterSpacing: 1,
  },
  toggle: {
    minHeight: 44,
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 2,
    backgroundColor: C.panel,
  },
  toggleText: { fontFamily: F.body, color: C.text, fontSize: 11 },
  resultCards: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 20,
    justifyContent: "space-between",
  },
  resultCard: {
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 2,
    overflow: "hidden",
    padding: 13,
  },
  resultArt: {
    aspectRatio: 1,
    backgroundColor: "#fff",
    borderRadius: 0,
    padding: 18,
  },
  resultImage: { height: "100%", width: "100%" },
  optionNumber: {
    position: "absolute",
    top: 10,
    left: 10,
    fontFamily: F.heading,
    fontSize: 17,
    color: C.muted,
  },
  resultMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 15,
  },
  variation: {
    fontFamily: F.bold,
    color: C.text,
    fontSize: 10,
    letterSpacing: 1,
  },
  resolution: { color: C.muted, fontFamily: F.body, fontSize: 9 },
  cardNote: {
    fontFamily: F.body,
    fontSize: 10,
    color: C.muted,
    marginTop: 11,
    textAlign: "center",
  },
  colorWarning: {
    color: C.red,
    fontFamily: F.body,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 8,
  },
  downloads: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 14,
  },
  transferNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: C.raised,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 2,
    padding: 17,
  },
  warningNotice: { borderColor: C.red },
  noticeTitle: {
    color: C.text,
    fontFamily: F.bold,
    fontSize: 12,
    letterSpacing: 0.4,
  },
  noticeText: {
    flex: 1,
    fontFamily: F.body,
    color: C.text,
    fontSize: 12,
    lineHeight: 18,
  },
  downloadError: { color: C.red, fontFamily: F.body, fontSize: 12 },
  progressPanel: {
    alignItems: "center",
    paddingVertical: 70,
    gap: 17,
    maxWidth: 600,
    width: "100%",
    alignSelf: "center",
  },
  iconCircle: {
    width: 94,
    height: 94,
    borderRadius: 2,
    backgroundColor: C.raised,
    borderColor: C.line,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },
  progressTitle: {
    fontFamily: F.heading,
    color: C.text,
    fontSize: 34,
    textAlign: "center",
  },
  progressCopy: {
    maxWidth: 520,
    color: C.muted,
    fontFamily: F.body,
    fontSize: 13,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 13,
  },
  track: {
    height: 5,
    backgroundColor: C.line,
    borderRadius: 0,
    width: "90%",
    marginVertical: 14,
    overflow: "hidden",
  },
  fill: { height: "100%", backgroundColor: C.blue },
  progressSteps: { flexDirection: "row", flexWrap: "wrap", gap: 18 },
  progressStep: { flexDirection: "row", alignItems: "center", gap: 6 },
  stepText: { color: C.muted, fontFamily: F.body, fontSize: 10 },
  stage: {
    fontFamily: F.body,
    color: C.muted,
    fontSize: 10,
    marginVertical: 14,
  },
});
