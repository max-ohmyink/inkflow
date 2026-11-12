import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F } from "@/lib/studio-theme";
import { SmallButton } from "./studio-ui";

type InstallPrompt = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function WebAppGuide() {
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(
    null,
  );
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [notice, setNotice] = useState("");
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    setInstalled(
      window.matchMedia("(display-mode: standalone)").matches ||
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
    );
    const capture = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    };
    const complete = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", complete);
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", complete);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) {
      setShowHelp((value) => !value);
      return;
    }
    setInstalling(true);
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setNotice(
        choice.outcome === "accepted"
          ? "Your browser is preparing the home-screen app."
          : "You can keep using the web app here; installation is optional.",
      );
      setInstallPrompt(null);
    } catch {
      setNotice(
        "Use your browser’s install menu, or open this page in Safari and choose Share → Add to Home Screen.",
      );
    } finally {
      setInstalling(false);
    }
  };

  return (
    <View style={s.panel}>
      <View style={s.row}>
        <Feather name="globe" size={22} color={C.blue} />
        <View style={s.copy}>
          <Text style={s.title}>
            {installed
              ? "YOUR INK, ON YOUR HOME SCREEN."
              : "BROWSER-READY. NO APP DOWNLOAD."}
          </Text>
          <Text style={s.text}>
            Use Safari, Chrome or Edge on your phone, iPad or desktop. An
            internet connection is required for creating your tattoo options and
            saving artwork.
          </Text>
        </View>
        {!installed && (
          <SmallButton
            text={
              installing
                ? "Opening…"
                : installPrompt
                  ? "Add to home screen"
                  : "How to install"
            }
            onPress={() => {
              if (!installing) void install();
            }}
            icon="download"
          />
        )}
      </View>
      {showHelp && (
        <Text style={s.help}>
          iPad / iPhone: open in Safari, tap Share, then Add to Home Screen.
          Chrome / Edge: use the install icon or Install app in the browser menu
          when offered. If installation is not offered, bookmark this page and
          use it in the browser.
        </Text>
      )}
      {!!notice && <Text style={s.help}>{notice}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  panel: {
    backgroundColor: C.panel,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 2,
    padding: 20,
    marginVertical: 24,
    gap: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 16,
  },
  copy: { flex: 1, minWidth: 180, gap: 8 },
  title: {
    fontFamily: F.heading,
    fontSize: 16,
    letterSpacing: 0.6,
    color: C.text,
  },
  text: { fontFamily: F.body, fontSize: 11, lineHeight: 19, color: C.muted },
  help: { fontFamily: F.body, fontSize: 11, lineHeight: 20, color: C.text },
});
