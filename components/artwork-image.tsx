import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  Text,
  View,
  type ImageStyle,
  type StyleProp,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F } from "@/lib/studio-theme";

/** Remote artwork that shows a spinner while loading and a tap-to-retry state if it fails. */
export function ArtworkImage({
  uri,
  style,
  accessibilityLabel,
}: {
  uri: string;
  style: StyleProp<ImageStyle>;
  accessibilityLabel: string;
}) {
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [attempt, setAttempt] = useState(0);
  if (state === "failed")
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${accessibilityLabel} could not load. Tap to try again.`}
        onPress={() => {
          setState("loading");
          setAttempt((value) => value + 1);
        }}
        style={[
          style as object,
          { alignItems: "center", justifyContent: "center", gap: 8 },
        ]}
      >
        <Feather name="refresh-cw" size={22} color={C.muted} />
        <Text style={{ fontFamily: F.body, fontSize: 12, color: C.muted }}>
          Artwork unavailable. Tap to retry.
        </Text>
      </Pressable>
    );
  return (
    <View style={{ width: "100%", height: "100%" }}>
      <Image
        key={attempt}
        source={{ uri: attempt ? `${uri}${uri.includes("?") ? "&" : "?"}retry=${attempt}` : uri }}
        accessibilityLabel={accessibilityLabel}
        resizeMode="contain"
        style={style}
        onLoad={() => setState("ready")}
        onError={() => setState("failed")}
      />
      {state === "loading" && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            inset: 0,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ActivityIndicator color={C.muted} />
        </View>
      )}
    </View>
  );
}
