import {
  deleteObject,
  getBytes,
  getMetadata,
  listAll,
  ref,
  updateMetadata,
  uploadBytes,
  type FullMetadata,
  type StorageReference,
} from 'firebase/storage';
import { firebaseStorage } from './firebase';
import { isPhotoExpired } from './workflowRules';

export interface PhotoRecord {
  caseId: string;
  blob: Blob;
  mimeType: string;
  uploadedAt: string;
  expiresAt: string;
  status: 'pending' | 'approved';
  sizeBytes: number;
}

export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

function getStorage() {
  if (!firebaseStorage) throw new Error('Firebase Storage is not configured.');
  return firebaseStorage;
}

function photoReference(facilityId: string, caseId: string): StorageReference {
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(facilityId) || !/^[a-zA-Z0-9_-]{1,100}$/.test(caseId)) {
    throw new Error('Invalid facility or case identifier for photo storage.');
  }
  return ref(getStorage(), `facilities/${facilityId}/bed-evidence/${caseId}`);
}

function normalizePhoto(blob: Blob, mimeType: string): Promise<{ blob: Blob; mimeType: string }> {
  const type = blob.type || mimeType;
  if (ALLOWED_MIME_TYPES.includes(type)) return Promise.resolve({ blob, mimeType: type });
  if (type !== 'image/svg+xml' || typeof createImageBitmap !== 'function') {
    return Promise.reject(new Error('Only JPEG, PNG, or WebP images are supported for shared photo evidence.'));
  }

  return createImageBitmap(blob).then((bitmap) => new Promise<{ blob: Blob; mimeType: string }>((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) {
      bitmap.close();
      reject(new Error('Could not prepare the synthetic image for secure upload.'));
      return;
    }
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    canvas.toBlob((converted) => {
      if (converted) resolve({ blob: converted, mimeType: 'image/png' });
      else reject(new Error('Could not convert the synthetic image to PNG.'));
    }, 'image/png');
  }));
}

function readMetadata(metadata: FullMetadata) {
  return {
    uploadedAt: metadata.customMetadata?.uploadedAt ?? metadata.timeCreated,
    expiresAt: metadata.customMetadata?.expiresAt ?? '',
    status: metadata.customMetadata?.status === 'approved' ? 'approved' as const : 'pending' as const,
  };
}

export const cloudPhotoStorage = {
  validateFile(file: File): { valid: boolean; error?: string } {
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return { valid: false, error: `Invalid file type (${file.type || 'unknown'}). Only JPEG, PNG, and WebP images are permitted.` };
    }
    if (file.size > MAX_PHOTO_BYTES) {
      return { valid: false, error: `File size exceeds the ${MAX_PHOTO_BYTES / 1024 / 1024} MB limit.` };
    }
    return { valid: true };
  },

  async savePhoto(
    facilityId: string,
    caseId: string,
    input: Blob,
    mimeType: string,
    expiresAt: string,
    status: 'pending' | 'approved',
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const normalized = await normalizePhoto(input, mimeType);
      if (normalized.blob.size > MAX_PHOTO_BYTES) throw new Error('Prepared image exceeds the 10 MB upload limit.');
      const uploadedAt = new Date().toISOString();
      await uploadBytes(photoReference(facilityId, caseId), normalized.blob, {
        contentType: normalized.mimeType,
        cacheControl: 'private, max-age=0, no-store',
        customMetadata: { caseId, uploadedAt, expiresAt, status },
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Photo upload failed.' };
    }
  },

  async getPhoto(facilityId: string, caseId: string): Promise<PhotoRecord | null> {
    const objectRef = photoReference(facilityId, caseId);
    try {
      const metadata = await getMetadata(objectRef);
      const bytes = await getBytes(objectRef, MAX_PHOTO_BYTES);
      const imageType = metadata.contentType ?? 'application/octet-stream';
      return {
        caseId,
        blob: new Blob([bytes], { type: imageType }),
        mimeType: imageType,
        ...readMetadata(metadata),
        sizeBytes: metadata.size,
      };
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'storage/object-not-found') return null;
      throw error;
    }
  },

  async hasPhoto(facilityId: string, caseId: string): Promise<boolean> {
    try {
      await getMetadata(photoReference(facilityId, caseId));
      return true;
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'storage/object-not-found') return false;
      throw error;
    }
  },

  async updateExpiryAndStatus(
    facilityId: string,
    caseId: string,
    expiresAt: string,
    status: 'pending' | 'approved',
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const objectRef = photoReference(facilityId, caseId);
      const metadata = await getMetadata(objectRef);
      await updateMetadata(objectRef, {
        customMetadata: {
          ...metadata.customMetadata,
          caseId,
          uploadedAt: metadata.customMetadata?.uploadedAt ?? metadata.timeCreated,
          expiresAt,
          status,
        },
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Could not update photo retention metadata.' };
    }
  },

  async deletePhoto(facilityId: string, caseId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await deleteObject(photoReference(facilityId, caseId));
      return { success: true };
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'storage/object-not-found') {
        return { success: true };
      }
      return { success: false, error: error instanceof Error ? error.message : 'Could not delete photo evidence.' };
    }
  },

  async purgeExpiredPhotos(facilityId: string, referenceTime: Date = new Date()): Promise<{
    purgedCaseIds: string[];
    errors: string[];
  }> {
    const result = await listAll(ref(getStorage(), `facilities/${facilityId}/bed-evidence`));
    const purgedCaseIds: string[] = [];
    const errors: string[] = [];
    for (const objectRef of result.items) {
      try {
        const metadata = await getMetadata(objectRef);
        const expiresAt = metadata.customMetadata?.expiresAt;
        const caseId = metadata.customMetadata?.caseId ?? objectRef.name;
        if (isPhotoExpired(expiresAt, referenceTime.getTime())) {
          const deletion = await this.deletePhoto(facilityId, caseId);
          if (deletion.success) purgedCaseIds.push(caseId);
          else errors.push(`${caseId}: ${deletion.error ?? 'Storage deletion failed.'}`);
        }
      } catch (error) {
        errors.push(`${objectRef.name}: ${error instanceof Error ? error.message : 'Could not inspect photo metadata.'}`);
      }
    }
    return { purgedCaseIds, errors };
  },

  async getStorageSummary(facilityId: string): Promise<{
    totalPhotos: number;
    totalSizeBytes: number;
    pendingCount: number;
    approvedCount: number;
  }> {
    const result = await listAll(ref(getStorage(), `facilities/${facilityId}/bed-evidence`));
    const summary = { totalPhotos: 0, totalSizeBytes: 0, pendingCount: 0, approvedCount: 0 };
    for (const objectRef of result.items) {
      const metadata = await getMetadata(objectRef);
      summary.totalPhotos += 1;
      summary.totalSizeBytes += metadata.size;
      if (metadata.customMetadata?.status === 'approved') summary.approvedCount += 1;
      else summary.pendingCount += 1;
    }
    return summary;
  },

};
