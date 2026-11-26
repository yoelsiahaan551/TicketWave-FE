"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { revokeBlobPreviewUrl, validateAdminMediaFile } from "@/app/lib/adminForms";

/**
 * Manages client-side file validation, preview URL state, and object URL revocation for Admin uploads.
 *
 * @param {string|null} [initialUrl=null]
 */
export function useAdminMediaPreview(initialUrl = null) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(initialUrl);
  const [error, setError] = useState(null);
  const blobUrlRef = useRef(null);

  const revokeCurrentBlob = useCallback(() => {
    revokeBlobPreviewUrl(blobUrlRef.current);
    blobUrlRef.current = null;
  }, []);

  const setRemotePreview = useCallback(
    (url) => {
      revokeCurrentBlob();
      setFile(null);
      setError(null);
      setPreviewUrl(url || null);
    },
    [revokeCurrentBlob]
  );

  const clearPendingFile = useCallback(
    (savedUrl) => {
      setFile(null);
      setError(null);
      if (savedUrl !== undefined) {
        revokeCurrentBlob();
        setPreviewUrl(savedUrl || null);
      }
    },
    [revokeCurrentBlob]
  );

  const handleFileChange = useCallback(
    (event) => {
      const input = event?.target;
      const selected = input?.files?.[0];
      if (input) {
        input.value = "";
      }
      if (!selected) return false;

      const validation = validateAdminMediaFile(selected);
      if (!validation.valid) {
        setError(validation.error);
        return false;
      }

      const nextBlobUrl = URL.createObjectURL(selected);
      revokeCurrentBlob();
      blobUrlRef.current = nextBlobUrl;
      setFile(selected);
      setPreviewUrl(nextBlobUrl);
      setError(null);
      return true;
    },
    [revokeCurrentBlob]
  );

  useEffect(() => {
    return () => {
      revokeCurrentBlob();
    };
  }, [revokeCurrentBlob]);

  return {
    file,
    previewUrl,
    error,
    setError,
    setRemotePreview,
    clearPendingFile,
    handleFileChange,
  };
}
