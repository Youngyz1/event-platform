"use client";

import { useState, useRef } from "react";
import { supabase } from "@/lib/supabase";

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
];

interface UseImageUploadOptions {
  bucket?: string;
  folder: string; // e.g. 'article-covers' or 'business-logos'
  onSuccess: (url: string) => void;
  onError?: (errorMsg: string) => void;
}

export function useImageUpload({
  bucket = "fundraiser-media",
  folder,
  onSuccess,
  onError,
}: UseImageUploadOptions) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_IMAGE_SIZE) {
      const msg = "Image exceeds 5MB limit.";
      if (onError) onError(msg);
      else alert(msg);
      return;
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      const msg = "Unsupported image type. Use JPG, PNG, WEBP, GIF, or AVIF.";
      if (onError) onError(msg);
      else alert(msg);
      return;
    }

    try {
      setUploading(true);
      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `${folder}/${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 9)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      onSuccess(urlData.publicUrl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown upload error";
      if (onError) onError(msg);
      else alert("Upload failed: " + msg);
    } finally {
      setUploading(false);
      // Reset so re-selecting the same file fires onChange again
      e.target.value = "";
    }
  };

  return { uploading, fileInputRef, triggerUpload, handleFileChange };
}
