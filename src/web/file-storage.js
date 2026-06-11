export const fileHandleDbName = "notes-dot-md";
export const fileHandleStoreName = "file-handles";
export const lastTaskFileKey = "last-task-file";

export function supportsIndexedDb(scope = globalThis) {
  return "indexedDB" in scope;
}

export function supportsOpenFilePicker(scope = globalThis) {
  return "showOpenFilePicker" in scope;
}

export function supportsSaveFilePicker(scope = globalThis) {
  return "showSaveFilePicker" in scope;
}

export function openHandleDb(options = {}) {
  const indexedDb = options.indexedDB || globalThis.indexedDB;
  const dbName = options.dbName || fileHandleDbName;
  const storeName = options.storeName || fileHandleStoreName;

  return new Promise((resolve, reject) => {
    const request = indexedDb.open(dbName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function rememberHandle(key, handle, options = {}) {
  const scope = options.scope || globalThis;
  if (!supportsIndexedDb(scope)) return;

  const db = await openHandleDb(options);
  const storeName = options.storeName || fileHandleStoreName;
  await new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(handle, key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getRememberedHandle(key, options = {}) {
  const scope = options.scope || globalThis;
  if (!supportsIndexedDb(scope)) return null;

  const db = await openHandleDb(options);
  const storeName = options.storeName || fileHandleStoreName;
  const handle = await new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return handle;
}

export async function hasRememberedHandle(key, options = {}) {
  try {
    return Boolean(await getRememberedHandle(key, options));
  } catch {
    return false;
  }
}

export async function requestReadWritePermission(handle) {
  const opts = { mode: "readwrite" };
  if ((await handle.queryPermission(opts)) === "granted") return true;
  return (await handle.requestPermission(opts)) === "granted";
}
