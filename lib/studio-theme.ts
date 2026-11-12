import { ImageSourcePropType } from "react-native";

// Bloomberg Day 2026 toolkit, page 5. Oh My Ink’s logo artwork stays unchanged.
export const C = {
  bg: "#FFECDE",
  cream: "#FFECDE",
  panel: "#FFFFFF",
  raised: "#FFF7F1",
  line: "#D6C9C0",
  text: "#111111",
  muted: "#5D5550",
  yellow: "#FBBF15",
  dark: "#111111",
  accentInk: "#111111",
  red: "#A32724",
  blue: "#14A7E0",
  cyan: "#14A7E0",
  pink: "#EFA5C9",
  white: "#FFFFFF",
};
export const F = {
  heading: "AvenirNextDemi",
  bold: "AvenirNextDemi",
  body: "AvenirNextRegular",
  medium: "AvenirNextMedium",
  mono: "BloombergPropUnicode",
  serif: "AvenirNextDemi",
};
export type StyleId = "fine_line" | "traditional" | "geometric" | "cyber";
export type MediumId = "blackwork" | "jagua" | "twotone";
export const STYLES: {
  id: StyleId;
  name: string;
  detail: string;
  art: ImageSourcePropType;
}[] = [
  {
    id: "fine_line",
    name: "Fine Line",
    detail: "A few delicate contours",
    art: require("@/assets/catalog/inspiration/fine-line-tulip.png"),
  },
  {
    id: "traditional",
    name: "Bold Outline",
    detail: "Clear, confident strokes",
    art: require("@/assets/catalog/inspiration/heart-with-arrow.png"),
  },
  {
    id: "geometric",
    name: "Simple Shapes",
    detail: "Small, open shapes",
    art: require("@/assets/catalog/inspiration/heart-shaped-clip.png"),
  },
  {
    id: "cyber",
    name: "Flowing Lines",
    detail: "A few smooth curves",
    art: require("@/assets/catalog/inspiration/ribbon.png"),
  },
];
export const MEDIA: {
  id: MediumId;
  name: string;
  detail: string;
  colors: string[];
}[] = [
  {
    id: "blackwork",
    name: "Classic Blackwork",
    detail: "Pure black outlines",
    colors: ["#151515"],
  },
  {
    id: "jagua",
    name: "Jagua Stain",
    detail: "Deep blue-black",
    colors: ["#24364E"],
  },
  {
    id: "twotone",
    name: "Two-Tone Accent",
    detail: "Black with a red accent",
    colors: ["#151515", "#C94040"],
  },
];
