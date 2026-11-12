export const canDownloadStencil = true;

export async function downloadStencil(
  url: string,
  filename: string,
): Promise<void> {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(
      "The stencil file could not be downloaded. Please reconnect and try again.",
    );
  const blob = await response.blob();
  if (!blob.size)
    throw new Error("The stencil file is empty. Please try again.");
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give Safari enough time to hand the blob to its download manager.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}
