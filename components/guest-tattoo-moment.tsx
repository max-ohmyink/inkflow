import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ArtworkImage } from "./artwork-image";
import { Feather } from "@expo/vector-icons";
import { C, F } from "@/lib/studio-theme";
import {
  absoluteAsset,
  type StencilJob,
  type StencilOption,
} from "@/lib/stencil-client";
import { canDownloadStencil, downloadStencil } from "@/lib/stencil-download";
import {
  guestArtworkUrl,
  artworkVersionLabel,
  guestArtworkFileName,
  compareOriginalLabel,
  originalArtworkLabel,
  sourceArtworkLabel,
  colorTreatmentDescription,
  colorAvailabilityWarning,
} from "@/lib/guest-experience";
import { PrimaryButton, SmallButton } from "./studio-ui";
import { RequestedInkSummary } from "./tattoo-ink-picker";
import { TATTOO_INKS } from "@/shared/tattoo-inks";

export function GuestTattooMoment({
  job,
  option,
  onBack,
  onNew,
}: {
  job: StencilJob;
  option: StencilOption;
  onBack: () => void;
  onNew: () => void;
}) {
  const [showOriginalArtwork, setShowOriginalArtwork] = useState(
    job.filters?.artStyle === "watercolor",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const saveArtwork = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await downloadStencil(
        absoluteAsset(guestArtworkUrl(option, showOriginalArtwork)),
        guestArtworkFileName(
          option.title ?? job.concept,
          option.index,
          option.colorUrl
            ? showOriginalArtwork
              ? "original"
              : "color"
            : undefined,
          option.source ?? job.source,
        ),
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Your artwork could not be saved. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <View style={s.moment}>
      <View style={s.badge}>
        <Feather name="heart" size={15} color={C.text} />
        <Text style={s.eyebrow}>YOUR INSTANT TATTOO EXPERIENCE</Text>
      </View>
      <Text accessibilityRole="header" style={s.title}>
        THIS ONE FEELS LIKE <Text style={s.serif}>you.</Text>
      </Text>
      <Text style={s.copy}>
        A little self-expression. No forever. Your tattoo choice is ready—show
        it to our team and let your next ink moment begin.
      </Text>
      <View style={s.artFrame}>
        <ArtworkImage
          uri={absoluteAsset(guestArtworkUrl(option, showOriginalArtwork))}
          style={s.art}
          accessibilityLabel={`${artworkVersionLabel(option, showOriginalArtwork)}: ${option.title ?? job.concept}`}
        />
      </View>
      <Text style={s.concept}>
        {option.title ?? job.concept}
      </Text>
      <Text style={[s.copy, { textAlign: "center" }]}>
        {sourceArtworkLabel(option.source ?? job.source)}
      </Text>
      {job.filters?.artStyle === "watercolor" && (
        <Text style={s.copy}>
          Watercolor starts with the painted source artwork. The selected-ink
          version is a flat fill; our artist may simplify the look for live
          drawing.
        </Text>
      )}
      <RequestedInkSummary
        inks={TATTOO_INKS}
        selected={job.filters?.inkColors}
      />
      {!!colorAvailabilityWarning(option) && (
        <Text
          accessibilityRole="alert"
          style={[s.copy, s.colorWarning, { textAlign: "center" }]}
        >
          {colorAvailabilityWarning(option)} The original is ready to choose,
          save and show to our team.
        </Text>
      )}
      {!!option.colorUrl && (
        <View style={{ alignItems: "center", gap: 12 }}>
          <Text style={s.copy}>
            {artworkVersionLabel(option, showOriginalArtwork)} ·{" "}
            {showOriginalArtwork
              ? "Untouched source artwork, kept separately from your color version."
              : colorTreatmentDescription(option)}
          </Text>
          <SmallButton
            text={
              showOriginalArtwork
                ? job.filters?.artStyle === "watercolor"
                  ? "View flat ink version"
                  : "View my color version"
                : compareOriginalLabel(option.source ?? job.source)
            }
            onPress={() => setShowOriginalArtwork((value) => !value)}
            icon="repeat"
          />
        </View>
      )}
      <View style={s.next}>
        <Feather name="users" size={20} color={C.blue} />
        <View style={{ flex: 1, gap: 7 }}>
          <Text style={s.nextTitle}>SHOW THIS TO OUR TEAM</Text>
          <Text style={s.nextCopy}>
            Show this screen to our team. Our artists will review and simplify
            the lines for your live-drawn, non-permanent tattoo moment.
          </Text>
        </View>
      </View>
      {canDownloadStencil && (
        <PrimaryButton
          text={
            saving
              ? "Saving your artwork…"
              : option.colorUrl
                ? showOriginalArtwork
                  ? "Save AI original"
                  : "Save my color version"
                : "Save my tattoo design"
          }
          icon="download"
          onPress={() => void saveArtwork()}
          disabled={saving}
        />
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
      <View style={s.links}>
        <SmallButton
          text="See my other options"
          onPress={onBack}
          icon="arrow-left"
        />
        <SmallButton text="Find another tattoo" onPress={onNew} icon="plus" />
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  moment: {
    paddingVertical: 44,
    width: "100%",
    maxWidth: 700,
    alignSelf: "center",
    gap: 22,
  },
  badge: { flexDirection: "row", alignItems: "center", gap: 9 },
  eyebrow: {
    fontFamily: F.bold,
    color: C.text,
    fontSize: 10,
    letterSpacing: 1.1,
  },
  title: { fontFamily: F.heading, color: C.text, fontSize: 38 },
  serif: { fontFamily: F.serif, color: C.blue, fontSize: 38 },
  copy: { fontFamily: F.body, color: C.muted, fontSize: 13, lineHeight: 23 },
  colorWarning: { color: C.red },
  artFrame: {
    width: "100%",
    maxWidth: 460,
    aspectRatio: 1,
    alignSelf: "center",
    padding: 24,
    borderRadius: 0,
    backgroundColor: "#fff",
  },
  art: { width: "100%", height: "100%" },
  concept: {
    fontFamily: F.bold,
    color: C.text,
    fontSize: 16,
    textAlign: "center",
  },
  next: {
    flexDirection: "row",
    gap: 14,
    backgroundColor: C.raised,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 2,
    padding: 20,
  },
  nextTitle: {
    fontFamily: F.bold,
    color: C.text,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  nextCopy: {
    fontFamily: F.body,
    color: C.muted,
    fontSize: 11,
    lineHeight: 20,
  },
  links: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    justifyContent: "center",
  },
  error: { color: C.red, fontFamily: F.body, fontSize: 12 },
});
