import { get, set, del } from 'idb-keyval';

// We're storing files as Blobs in IndexedDB, which is more efficient.
// The key for each file will be its unique ID (e.g., a UUID).

/**
 * Stores a file (as a Blob) in IndexedDB.
 * @param id The unique identifier for the file.
 * @param file The File object to store.
 */
export async function storeFile(id: string, file: File): Promise<void> {
  try {
    const blob = new Blob([file], { type: file.type });
    await set(id, blob);
  } catch (error) {
    console.error("Failed to store file in IndexedDB:", error);
    throw new Error("Could not save the file.");
  }
}

/**
 * Retrieves a file (as a Blob) from IndexedDB.
 * @param id The unique identifier for the file.
 * @returns The Blob object or undefined if not found.
 */
export async function getFile(id: string): Promise<Blob | undefined> {
  try {
    return await get(id);
  } catch (error) {
    console.error("Failed to retrieve file from IndexedDB:", error);
    return undefined;
  }
}

/**
 * Deletes a file from IndexedDB.
 * @param id The unique identifier for the file.
 */
export async function deleteFile(id: string): Promise<void> {
  try {
    await del(id);
  } catch (error) {
    console.error("Failed to delete file from IndexedDB:", error);
  }
}
