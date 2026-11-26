export const ADMIN_MEDIA_ALLOWED_EXTENSIONS = ['jpeg', 'jpg', 'png', 'webp'] as const;
export const ADMIN_MEDIA_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
] as const;
export const ADMIN_MEDIA_MAX_SIZE_MB = 5;
export const ADMIN_MEDIA_MAX_SIZE_BYTES = ADMIN_MEDIA_MAX_SIZE_MB * 1024 * 1024;

export interface MediaAssetValidationInput {
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  uri?: string | null;
}

export function validateAdminMediaAsset(
  asset: MediaAssetValidationInput | null | undefined
): { valid: boolean; error: string | null } {
  if (!asset) {
    return { valid: false, error: 'File tidak ditemukan.' };
  }

  let candidateName = typeof asset.fileName === 'string' ? asset.fileName.trim() : '';
  if (!candidateName && typeof asset.uri === 'string' && !asset.uri.startsWith('data:')) {
    const cleanUri = asset.uri.split('?')[0].split('#')[0];
    const parts = cleanUri.split('/');
    candidateName = parts[parts.length - 1] || '';
  }

  const mime = typeof asset.mimeType === 'string' ? asset.mimeType.trim().toLowerCase() : '';

  let ext = '';
  if (candidateName) {
    const lastDot = candidateName.lastIndexOf('.');
    if (lastDot >= 0) {
      ext = candidateName.slice(lastDot + 1).toLowerCase();
    }
  } else if (mime.startsWith('image/')) {
    ext = mime.slice('image/'.length).toLowerCase();
  }

  const hasValidExt = (ADMIN_MEDIA_ALLOWED_EXTENSIONS as readonly string[]).includes(ext);
  const hasValidMime =
    !mime || (ADMIN_MEDIA_ALLOWED_MIME_TYPES as readonly string[]).includes(mime);

  if (!hasValidExt || !hasValidMime) {
    return {
      valid: false,
      error: `Format file harus salah satu dari: ${ADMIN_MEDIA_ALLOWED_EXTENSIONS.join(', ')}`,
    };
  }

  if (typeof asset.fileSize === 'number') {
    if (asset.fileSize <= 0) {
      return { valid: false, error: 'File gambar kosong atau tidak valid.' };
    }
    if (asset.fileSize > ADMIN_MEDIA_MAX_SIZE_BYTES) {
      return {
        valid: false,
        error: `Ukuran file maksimal ${ADMIN_MEDIA_MAX_SIZE_MB}MB`,
      };
    }
  }

  return { valid: true, error: null };
}

export function getMediaPickerErrorMessage(err: unknown): string {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
      ? err
      : '';
  if (/unsupported file type|only images/i.test(msg)) {
    return `Format file harus salah satu dari: ${ADMIN_MEDIA_ALLOWED_EXTENSIONS.join(', ')}`;
  }
  return msg || 'Gagal memproses file media yang dipilih.';
}
