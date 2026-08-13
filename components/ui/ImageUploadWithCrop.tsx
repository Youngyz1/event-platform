"use client";

import { useRef, useState, useCallback } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { ImagePlus, Loader2, ZoomIn } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { uploadPublicFile } from "@/lib/uploads";
import { getCroppedImageBlob, getImageDimensionsFromSrc, readFileAsDataUrl } from "@/lib/crop-image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

// Generous ceiling — phone camera photos routinely run 6-15MB before any
// compression, and several of the upload points this component replaced
// (fundraiser photos, organizer photo, avatar) had no client-side size gate
// at all previously, so this must not be stricter than what already worked.
const DEFAULT_MAX_BYTES = 15 * 1024 * 1024;

/**
 * Zoom bounds for the crop modal.
 *
 * 1 means "the photo exactly fills the crop box", which is where it opens — so
 * the default result is a full-bleed cover crop with zero blank margins.
 */
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

export interface ImageUploadWithCropProps {
  /** Width / height the cropped output must satisfy, e.g. 1 for square, 16/9 for widescreen. */
  aspectRatio: number;
  /** Crop frame shape. "round" is for avatars; everything else is "rect". */
  shape?: "rect" | "round";
  /** Supabase Storage bucket the cropped file is uploaded to. */
  bucket: string;
  /** Folder/prefix within the bucket. */
  folder: string;
  /** Called with the public URL once upload succeeds. */
  onUploaded: (url: string) => void;
  onError?: (message: string) => void;
  /** Reject source images smaller than this (before cropping) — avoids upscaled/blurry results. */
  minWidth?: number;
  minHeight?: number;
  maxBytes?: number;
  /** Max dimensions for exported cropped image canvas (preserves aspect ratio, never upscales). */
  maxOutputWidth?: number;
  maxOutputHeight?: number;
  /** Restrict to specific MIME types. Unset (default) accepts anything image/*. */
  allowedTypes?: readonly string[];
  /**
   * Custom trigger so callers can reuse their own preview UI (e.g. an existing
   * avatar circle or banner strip) instead of the default dropzone button.
   * `open` launches the file picker.
   */
  renderTrigger?: (state: { open: () => void; uploading: boolean }) => React.ReactNode;
  label?: string;
  helperText?: string;
  disabled?: boolean;
  className?: string;
  /**
   * When true, the crop box is automatically sized to match the uploaded
   * image's own aspect ratio — the complete image is visible by default and
   * no pixels are cropped away unless the user deliberately zooms in.
   *
   * The detected ratio is stored in state BEFORE the <Cropper> mounts, so
   * it never briefly renders at the caller-supplied `aspectRatio` first.
   *
   * Use this for fundraiser photos where the full composition must be
   * preserved. Leave false (default) for avatars, logos, and any upload
   * that intentionally requires a fixed crop ratio.
   */
  preserveAspectRatio?: boolean;
}

/**
 * Reusable file picker + zoom/reposition crop modal. Selecting a file opens a
 * modal cropper locked to `aspectRatio`; confirming crops it via canvas and
 * uploads the result through the shared `uploadPublicFile` utility, then
 * hands the caller back a public URL. One image in, one URL out — for
 * multi-photo galleries, render one instance per photo slot.
 *
 * When `preserveAspectRatio` is true, the crop box is dynamically set to the
 * image's own natural aspect ratio so the full image is the default export.
 */
export default function ImageUploadWithCrop({
  aspectRatio,
  shape = "rect",
  bucket,
  folder,
  onUploaded,
  onError,
  minWidth,
  minHeight,
  maxBytes = DEFAULT_MAX_BYTES,
  maxOutputWidth,
  maxOutputHeight,
  allowedTypes,
  renderTrigger,
  label = "Upload image",
  helperText,
  disabled,
  className,
  preserveAspectRatio = false,
}: ImageUploadWithCropProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [uploading, setUploading] = useState(false);
  const [modalError, setModalError] = useState("");
  /**
   * Detected natural aspect ratio of the selected image. Only populated when
   * preserveAspectRatio=true. Set in the same state-update batch as sourceUrl
   * so the <Cropper> always receives the correct ratio on its very first render.
   */
  const [detectedAspect, setDetectedAspect] = useState<number | null>(null);

  // The ratio passed to <Cropper aspect={...}>.
  // When preserving: use the image's own ratio (always set before Cropper mounts).
  // When fixed crop: use the caller-supplied aspectRatio prop.
  const activeCropAspect =
    preserveAspectRatio && detectedAspect !== null ? detectedAspect : aspectRatio;

  const open = useCallback(() => {
    if (disabled) return;
    inputRef.current?.click();
  }, [disabled]);

  function reportError(message: string) {
    if (onError) onError(message);
    else setModalError(message);
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.size > maxBytes) {
      reportError(`Image exceeds the ${Math.round(maxBytes / 1024 / 1024)}MB limit.`);
      return;
    }
    // The OS file picker already filters to images (accept="image/*"), so this
    // only needs to catch a truly wrong type slipping through — not enforce a
    // narrow allowlist. Some browsers/cameras leave `file.type` empty for
    // otherwise-valid images, so an empty type is let through rather than blocked.
    const isAcceptableType = allowedTypes
      ? allowedTypes.includes(file.type)
      : file.type === "" || file.type.startsWith("image/");
    if (!isAcceptableType) {
      reportError("Unsupported file type. Please choose an image.");
      return;
    }

    // Read as a data: URL rather than URL.createObjectURL() — blob: URLs have a
    // known reliability bug in mobile Safari/WebKit where they intermittently
    // fail to load into an <img>, even for perfectly valid files.
    let dataUrl: string;
    try {
      dataUrl = await readFileAsDataUrl(file);
    } catch {
      reportError("Couldn't read this file. Please try again.");
      return;
    }

    // Confirm the browser can actually decode this as an image before opening
    // the crop modal — otherwise an undecodable format opens a blank cropper
    // instead of a clear error.
    let dimensions: { width: number; height: number };
    try {
      dimensions = await getImageDimensionsFromSrc(dataUrl);
    } catch {
      reportError("Couldn't read this image. It may be corrupted or in an unsupported format.");
      return;
    }

    if ((minWidth && dimensions.width < minWidth) || (minHeight && dimensions.height < minHeight)) {
      reportError(
        `Image is too small (${dimensions.width}x${dimensions.height}px). Use at least ${minWidth ?? 0}x${minHeight ?? 0}px so it doesn't blur when cropped.`
      );
      return;
    }

    // When preserving aspect ratio, detect the image's own w/h ratio and store
    // it BEFORE setting sourceUrl. React batches these state updates together,
    // so by the time <Cropper> first mounts it already sees the correct aspect —
    // it never briefly renders at the caller-supplied fixed ratio.
    if (preserveAspectRatio && dimensions.width > 0 && dimensions.height > 0) {
      setDetectedAspect(dimensions.width / dimensions.height);
    } else {
      setDetectedAspect(null);
    }

    setModalError("");
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setSourceUrl(dataUrl);
  }

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  function closeModal() {
    if (uploading) return;
    setSourceUrl(null);
    setModalError("");
    setDetectedAspect(null);
  }

  async function confirmCrop() {
    if (!sourceUrl || !croppedAreaPixels) return;

    setUploading(true);
    setModalError("");
    try {
      const blob = await getCroppedImageBlob(sourceUrl, croppedAreaPixels, {
        mimeType: "image/jpeg",
        quality: 0.92,
        maxOutputWidth,
        maxOutputHeight,
      });
      const croppedFile = new File([blob], `cropped-${Date.now()}.jpg`, { type: "image/jpeg" });

      const uploaded = await uploadPublicFile({
        supabase,
        bucket,
        folder,
        file: croppedFile,
        kind: "image",
        maxBytes,
        allowedTypes: ["image/jpeg"],
      });

      setSourceUrl(null);
      setDetectedAspect(null);
      onUploaded(uploaded.publicUrl);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Upload failed.";
      reportError(message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled}
      />

      {renderTrigger ? (
        // eslint-disable-next-line react-hooks/refs
        renderTrigger({ open, uploading })
      ) : (
        <button
          type="button"
          onClick={open}
          disabled={disabled || uploading}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-5 text-sm font-semibold text-zinc-600 transition hover:border-zinc-400 hover:bg-zinc-100 disabled:opacity-50"
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Uploading...
            </>
          ) : (
            <>
              <ImagePlus className="h-4 w-4" /> {label}
            </>
          )}
        </button>
      )}
      {helperText && <p className="mt-1.5 text-xs font-medium text-zinc-500">{helperText}</p>}

      <Dialog open={Boolean(sourceUrl)} onOpenChange={(next) => !next && closeModal()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {preserveAspectRatio ? "Preview your photo" : "Reposition your photo"}
            </DialogTitle>
            <DialogDescription className={preserveAspectRatio ? undefined : "sr-only"}>
              {preserveAspectRatio
                ? "Your full photo will be uploaded. Zoom in if you'd like to frame a closer view."
                : "Drag to reposition and use the slider to zoom, then save to crop your photo."}
            </DialogDescription>
          </DialogHeader>

          {/* Only render the Cropper once both sourceUrl AND the correct aspect
              ratio are available. Because detectedAspect is set in the same
              React state-update batch as sourceUrl (inside handleFileChange),
              this condition is always satisfied together — no flicker at the
              old fixed ratio before the detected ratio takes effect. */}
          {sourceUrl && (
            <div className="relative h-[50vh] min-h-[320px] w-full overflow-hidden rounded-xl bg-zinc-900">
              <Cropper
                image={sourceUrl}
                crop={crop}
                zoom={zoom}
                aspect={activeCropAspect}
                cropShape={shape}
                showGrid={shape === "rect"}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                minZoom={MIN_ZOOM}
                maxZoom={MAX_ZOOM}
                restrictPosition={true}
              />
            </div>
          )}

          <div className="flex items-center gap-3">
            <ZoomIn className="h-4 w-4 shrink-0 text-zinc-500" />
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-brand-700"
              aria-label="Zoom"
            />
          </div>

          {modalError && (
            <p className="text-sm font-semibold text-red-600">{modalError}</p>
          )}

          <DialogFooter>
            <button
              type="button"
              onClick={closeModal}
              disabled={uploading}
              className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-black text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmCrop}
              disabled={uploading || !croppedAreaPixels}
              className="rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-black text-white hover:bg-brand-800 disabled:bg-brand-300"
            >
              {uploading ? "Uploading..." : "Save"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
