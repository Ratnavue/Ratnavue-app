// Rasterizes the live pane <svg> elements into one PNG thumbnail, client
// side — no server-side SVG renderer needed. Used both for the "My
// Designs" list thumbnail and for the reference image a customer's
// submission attaches to its QuoteRequest.

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not render a pane for export."));
    img.src = src;
  });
}

/** Composites every pane `<svg>` found inside `container` into one PNG,
 * arranged the same 1-col/2-col grid the live canvas uses. */
export async function exportPanesToPngBlob(container: HTMLElement): Promise<Blob> {
  const svgs = Array.from(container.querySelectorAll("svg"));
  if (svgs.length === 0) throw new Error("Nothing to export yet.");

  const cell = 320;
  const cols = svgs.length <= 1 ? 1 : 2;
  const rows = Math.ceil(svgs.length / cols);

  const canvas = document.createElement("canvas");
  canvas.width = cell * cols;
  canvas.height = cell * rows;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create a canvas to export.");
  ctx.fillStyle = "#faf7f2";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < svgs.length; i++) {
    const serialized = new XMLSerializer().serializeToString(svgs[i]);
    const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`);
    const col = i % cols;
    const row = Math.floor(i / cols);
    ctx.drawImage(img, col * cell, row * cell, cell, cell);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not export the sketch."))), "image/png");
  });
}
