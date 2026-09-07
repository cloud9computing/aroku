import { deleteObject, getDownloadURL, listAll, ref, uploadString, uploadBytes } from 'firebase/storage';
import { storage } from './config';

// Deletes every file under a folder rather than reconstructing one exact filename —
// records can be jpg/png/webp/pdf and visits can hold multiple timestamped recordings.
async function deleteFolder(path: string): Promise<void> {
  const folderRef = ref(storage, path);
  const { items } = await listAll(folderRef);
  await Promise.all(items.map((item) => deleteObject(item).catch(() => {})));
}

export function deleteRecordFiles(familyId: string, recordId: string): Promise<void> {
  return deleteFolder(`families/${familyId}/records/${recordId}`);
}

export function deleteVisitFiles(familyId: string, visitId: string): Promise<void> {
  return deleteFolder(`families/${familyId}/visits/${visitId}`);
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  return 'jpg';
}

// A multi-page camera scan (lab report, discharge summary) saves one file per
// page — "original-1.jpg", "original-2.jpg", ... — instead of overwriting a
// single "original" file, so every page survives and can be re-fetched later.
export async function uploadRecordImages(
  familyId: string,
  recordId: string,
  images: { base64Data: string; mimeType: string }[]
): Promise<string[]> {
  return Promise.all(
    images.map(async ({ base64Data, mimeType }, idx) => {
      const fileRef = ref(
        storage,
        `families/${familyId}/records/${recordId}/original-${idx + 1}.${extensionForMimeType(mimeType)}`
      );
      await uploadString(fileRef, base64Data, 'base64', { contentType: mimeType });
      return getDownloadURL(fileRef);
    })
  );
}

export async function uploadConsultationAudio(
  familyId: string,
  visitId: string,
  blob: Blob
): Promise<string> {
  const extension = blob.type.includes('mp4') ? 'm4a' : 'webm';
  const fileRef = ref(storage, `families/${familyId}/visits/${visitId}/recording-${Date.now()}.${extension}`);
  await uploadBytes(fileRef, blob, { contentType: blob.type || 'audio/webm' });
  return getDownloadURL(fileRef);
}
