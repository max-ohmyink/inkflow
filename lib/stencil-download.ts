export const canDownloadStencil = false;

export async function downloadStencil(
  _url: string,
  _filename: string,
): Promise<void> {
  throw new Error("File downloads are available in the browser web app.");
}
