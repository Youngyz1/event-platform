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
}

/**
 * Reusable file picker + zoom/reposition crop modal. Selecting a file opens a
 * modal cropper locked to `aspectRatio`; confirming crops it via canvas and
 * uploads the result through the shared `uploadPublicFile` utility, then
 * hands the caller back a public URL. One image in, one URL out — for
 * multi-photo galleries, render one instance per photo slot.
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
  allowedTypes,
  renderTrigger,
  label = "Upload image",
  helperText,
  disabled,
  className,
}: ImageUploadWithCropProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [uploading, setUploading] = useState(false);
  const [modalError, setModalError] = useState("");

  function open() {
    if (disabled) return;
    inputRef.current?.click();
  }

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
  }

  async function confirmCrop() {
    if (!sourceUrl || !croppedAreaPixels) return;

    setUploading(true);
    setModalError("");
    try {
      const blob = await getCroppedImageBlob(sourceUrl, croppedAreaPixels);
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
            <DialogTitle>Reposition your photo</DialogTitle>
            <DialogDescription className="sr-only">
              Drag to reposition and use the slider to zoom, then save to crop your photo.
            </DialogDescription>
          </DialogHeader>

          {sourceUrl && (
            <div className="relative h-[50vh] min-h-[320px] w-full overflow-hidden rounded-xl bg-zinc-900">
              <Cropper
                image={sourceUrl}
                crop={crop}
                zoom={zoom}
                aspect={aspectRatio}
                cropShape={shape}
                showGrid={shape === "rect"}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
          )}

          <div className="flex items-center gap-3">
            <ZoomIn className="h-4 w-4 shrink-0 text-zinc-500" />
            <input
              type="range"
              min={1}
              max={3}
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
