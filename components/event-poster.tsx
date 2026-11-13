import { Image, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, STYLES } from "@/lib/studio-theme";

export function EventPoster({ compact }: { compact: boolean }) {
  return (
    <View style={[s.poster, compact && { minHeight: 420, padding: 25 }]}>
      <Image
        source={require("@/assets/event-brand/waterworks-vertical.png")}
        resizeMode="cover"
        style={[StyleSheet.absoluteFill, { width: "100%", height: "100%" }]}
        accessible={false}
      />
      <View style={s.topline}>
        <Text style={s.overline}>TOGETHER, WE CREATE.</Text>
        <Feather name="arrow-up-right" size={23} color={C.dark} />
      </View>
      <Text style={[s.headline, compact && { fontSize: 51, lineHeight: 57 }]}>
        Together,{"\n"}make your{"\n"}mark.
      </Text>
      <Text style={s.copy}>
        A little art. A little tech. A little you.{"\n"}Explore a temporary
        tattoo that feels like your story.
      </Text>
      <View style={s.bottom}>
        <View style={s.caption}>
          <Text style={s.bigNumber}>AI</Text>
          <Text style={s.shortCopy}>SIMPLE FAMILY{"\n"}TATTOO DESIGNS</Text>
          <Text style={s.promise}>Needle-free.{"\n"}Non-permanent.</Text>
        </View>
        <View style={s.artCard}>
          <Text style={s.cardLabel}>START WITH A SPARK</Text>
          <Image source={STYLES[0].art} resizeMode="contain" style={s.art} />
          <View style={s.cardFoot}>
            <Text style={s.cardName}>Fine Line Tulip</Text>
            <Feather name="heart" size={13} color={C.dark} />
          </View>
        </View>
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  poster: {
    flex: 1,
    minHeight: 570,
    backgroundColor: C.cyan,
    overflow: "hidden",
    borderRadius: 8,
    padding: 32,
    justifyContent: "space-between",
    gap: 24,
  },
  topline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  overline: {
    color: C.dark,
    fontFamily: F.mono,
    fontSize: 10,
    letterSpacing: 2,
    lineHeight: 17,
  },
  headline: {
    color: C.dark,
    fontFamily: F.heading,
    fontSize: 64,
    lineHeight: 71,
    letterSpacing: -2,
  },
  copy: {
    color: C.dark,
    fontFamily: F.medium,
    fontSize: 14,
    lineHeight: 23,
    maxWidth: 335,
  },
  bottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 15,
    marginTop: 18,
  },
  caption: { flex: 1, minWidth: 95 },
  bigNumber: {
    color: C.dark,
    fontFamily: F.heading,
    fontSize: 48,
    lineHeight: 52,
  },
  shortCopy: {
    color: C.dark,
    fontFamily: F.mono,
    fontSize: 8,
    letterSpacing: 1.25,
    lineHeight: 15,
    marginTop: 7,
  },
  promise: {
    color: C.dark,
    fontFamily: F.medium,
    fontSize: 11,
    lineHeight: 19,
    marginTop: 16,
  },
  artCard: {
    width: 154,
    padding: 13,
    backgroundColor: C.white,
    borderColor: C.dark,
    borderWidth: 1,
    borderRadius: 4,
  },
  cardLabel: {
    color: C.dark,
    fontFamily: F.mono,
    fontSize: 7,
    letterSpacing: 1,
    lineHeight: 12,
  },
  art: { width: "100%", height: 120, marginVertical: 8 },
  cardFoot: {
    borderTopColor: C.line,
    borderTopWidth: 1,
    paddingTop: 9,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 5,
  },
  cardName: { color: C.dark, fontFamily: F.bold, fontSize: 9 },
});
