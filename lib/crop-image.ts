export type CropAreaPixels = {
  x: number;
  y: number;
  width: number;
  height: number;
};

// `URL.createObjectURL()` + `<img>` has a known reliability bug on mobile
// Safari/WebKit — it intermittently fails to load blob: URLs, even for
// perfectly valid images. Reading the file as a base64 data: URL instead
// sidesteps that bug and is consistently supported across mobile browsers.
function readFileAsDataUrlOnce(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result as string));
    reader.addEventListener("error", () => reject(new Error("FileReader failed")));
    reader.readAsDataURL(file);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Chunked to avoid "Maximum call stack size exceeded" from spreading a large
// byte array onto String.fromCharCode at once.
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

// Some Android content providers (photos living in a chat app's private media
// folder, e.g. Android/media/com.whatsapp.w4b/...) grant the browser only
// flaky, sometimes single-use read access to the picked file — FileReader can
// fail even though the file is perfectly valid. `Blob.arrayBuffer()` goes
// through a different internal code path and succeeds in cases where
// FileReader doesn't, so it's tried as a fallback rather than a first resort
// (FileReader is faster and works for the vast majority of files).
async function readFileViaArrayBuffer(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const base64 = arrayBufferToBase64(buffer);
  const mimeType = file.type || "image/jpeg";
  return `data:${mimeType};base64,${base64}`;
}

export async function readFileAsDataUrl(file: File): Promise<string> {
  try {
    return await readFileAsDataUrlOnce(file);
  } catch {
    // Transient content-provider hiccup — give it a moment and try once more.
    await sleep(300);
  }

  try {
    return await readFileAsDataUrlOnce(file);
  } catch {
    // Fall through to the arrayBuffer method below.
  }

  try {
    return await readFileViaArrayBuffer(file);
  } catch {
    throw new Error(
      "Couldn't read this file. If it's from a chat app's media folder, try saving it to your Photos/Gallery app first, then upload from there."
    );
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", () =>
      reject(new Error("Could not read this image. It may be corrupted or in an unsupported format."))
    );
    image.src = src;
  });
}

/** Renders the cropped region of `imageSrc` onto a canvas and exports it as a Blob. */
export async function getCroppedImageBlob(
  imageSrc: string,
  cropAreaPixels: CropAreaPixels,
  mimeType = "image/jpeg",
  quality = 0.92
): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(cropAreaPixels.width);
  canvas.height = Math.round(cropAreaPixels.height);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get a 2D canvas context.");

  // Paint the canvas white before drawing.
  //
  // The cropper allows zooming out past the edges of the photo, so the crop
  // area can legitimately extend beyond the image. Those regions are never
  // touched by drawImage and stay transparent — which JPEG cannot represent
  // and renders as solid black. White matches the surrounding UI instead.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.drawImage(
    image,
    cropAreaPixels.x,
    cropAreaPixels.y,
    cropAreaPixels.width,
    cropAreaPixels.height,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not export the cropped image."))),
      mimeType,
      quality
    );
  });
}

export function getImageDimensionsFromSrc(src: string): Promise<{ width: number; height: number }> {
  return loadImage(src).then((image) => ({
    width: image.naturalWidth,
    height: image.naturalHeight,
  }));
}
