export type PrintResult = "dialog-opened" | "submitted";
export async function printStencil(
  pngUrl: string,
  sizeMm: number,
): Promise<PrintResult> {
  const response = await fetch(pngUrl);
  if (!response.ok)
    throw new Error(
      "Unable to load the full-resolution stencil. Please try again.",
    );
  const blob = await response.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(new Error("Could not prepare the stencil for printing."));
    reader.readAsDataURL(blob);
  });
  const frame = document.createElement("iframe");
  frame.setAttribute("title", "Tattoo stencil print");
  Object.assign(frame.style, {
    position: "fixed",
    left: "-10000px",
    width: "800px",
    height: "1000px",
    border: "0",
  });
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc || !frame.contentWindow) {
    frame.remove();
    throw new Error(
      "Your browser could not open the print dialog. Try Safari.",
    );
  }
  const mm = Math.min(160, Math.max(20, sizeMm));
  doc.open();
  doc.write(
    `<!doctype html><html><head><title>Oh My Ink - Live AI Tattoo Experience — Mirrored Stencil</title><style>@page{size:A4;margin:12mm}html,body{margin:0;padding:0;background:#fff}img{display:block;width:${mm}mm;height:auto;max-width:100%;image-rendering:high-quality}</style></head><body><img src="${dataUrl}" alt="" /></body></html>`,
  );
  doc.close();
  const image = doc.querySelector("img")!;
  await new Promise<void>((resolve, reject) => {
    if (image.complete && image.naturalWidth) {
      resolve();
      return;
    }
    image.onload = () => resolve();
    image.onerror = () =>
      reject(new Error("Could not render the stencil for printing."));
  });
  const win = frame.contentWindow;
  win.addEventListener(
    "afterprint",
    () => setTimeout(() => frame.remove(), 1000),
    { once: true },
  );
  win.focus();
  win.print();
  // Browser APIs cannot establish physical printing or distinguish Print from Cancel.
  setTimeout(() => frame.remove(), 120000);
  return "dialog-opened";
}
