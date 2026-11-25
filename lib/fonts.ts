import { useEffect } from "react";
import { Platform } from "react-native";
import { Asset } from "expo-asset";
import { useFonts } from "expo-font";
import { Barlow_400Regular, Barlow_500Medium, Barlow_600SemiBold, Barlow_700Bold, Barlow_800ExtraBold } from "@expo-google-fonts/barlow";
import { BarlowCondensed_600SemiBold, BarlowCondensed_700Bold, BarlowCondensed_800ExtraBold } from "@expo-google-fonts/barlow-condensed";

/**
 * On the web, react-native-web gives every Text the system stack, which starts with
 * "-apple-system". Declaring Barlow under that name, one face per weight, turns all the
 * plain text into Barlow while every fontWeight already in the screens keeps working.
 */
const SYSTEM_FACES: [number, number][] = [
  [400, Barlow_400Regular],
  [500, Barlow_500Medium],
  [600, Barlow_600SemiBold],
  [700, Barlow_700Bold],
  [800, Barlow_800ExtraBold],
  [900, Barlow_800ExtraBold],
];

function useSystemFaceOnWeb() {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined" || document.getElementById("barlow-system")) return;
    const rules = SYSTEM_FACES.map(([weight, module]) => {
      const uri = Asset.fromModule(module).uri;
      return `@font-face{font-family:"-apple-system";font-weight:${weight};font-style:normal;font-display:swap;src:url("${uri}") format("truetype");}`;
    });
    const style = document.createElement("style");
    style.id = "barlow-system";
    style.textContent = rules.join("\n");
    document.head.appendChild(style);
  }, []);
}

/** Loads the named faces used by F; the app renders meanwhile with the fallback font. */
export function useAppFonts() {
  useSystemFaceOnWeb();
  useFonts({
    Barlow_400Regular,
    Barlow_500Medium,
    Barlow_600SemiBold,
    Barlow_700Bold,
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
    BarlowCondensed_800ExtraBold,
  });
}
