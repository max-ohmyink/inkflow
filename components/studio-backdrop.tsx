import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { C } from "@/lib/studio-theme";

/**
 * Three diagonal bands across the card, blue on the left, pink in the middle and yellow on the
 * right, like the event poster. The two dividing lines are parallel and lean the same way, and
 * they are placed so each band covers exactly a third of the card. The drawing is stretched to the
 * card, so the bands always fill it, whatever its size.
 */
const LEAN = 30;
const FIRST = 100 / 3 + LEAN / 2;
const SECOND = 200 / 3 + LEAN / 2;

export function CardPattern() {
  return (
    <View pointerEvents="none" style={s.fill}>
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <Path fill={C.pink} d="M0 0 L100 0 L100 100 L0 100 Z" />
        <Path
          fill={C.blue}
          d={`M0 0 L${FIRST} 0 L${FIRST - LEAN} 100 L0 100 Z`}
        />
        <Path
          fill={C.yellow}
          d={`M${SECOND} 0 L100 0 L100 100 L${SECOND - LEAN} 100 Z`}
        />
      </Svg>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
});
