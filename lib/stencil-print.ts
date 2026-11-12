import * as Print from "expo-print";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";
export type PrintResult = "dialog-opened" | "submitted";
export async function printStencil(
  pngUrl: string,
  sizeMm: number,
): Promise<PrintResult> {
  const path = `${FileSystem.cacheDirectory}stencil-${Date.now()}.png`;
  try {
    const downloaded = await FileSystem.downloadAsync(pngUrl, path);
    if (downloaded.status !== 200)
      throw new Error("Unable to download the full-resolution stencil.");
    const base64 = await FileSystem.readAsStringAsync(path, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const mm = Math.min(160, Math.max(20, sizeMm));
    await Print.printAsync({
      html: `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><style>@page{size:A4;margin:12mm}body{margin:0;background:white}img{display:block;width:${mm}mm;height:auto;max-width:100%}</style></head><body><img src="data:image/png;base64,${base64}" /></body></html>`,
    });
    return Platform.OS === "ios" ? "submitted" : "dialog-opened";
  } finally {
    await FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {});
  }
}
