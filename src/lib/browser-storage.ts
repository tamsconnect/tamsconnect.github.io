import { applyRequest, deliverReminders, localDay, seedWorld, syncDemoDay, type World } from './community';

let opening: Promise<IDBDatabase> | undefined;

function database(): Promise<IDBDatabase> {
  if (opening) return opening;
  opening = new Promise((resolve, reject) => {
    const scope = new URL('.', document.baseURI).pathname;
    const request = indexedDB.open('tams-connect:' + scope, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('community');
    request.onerror = () => reject(new Error('Your browser couldn’t open demo storage. Check its site-storage settings and retry.'));
    request.onblocked = () => reject(new Error('Close other TAMS Connect tabs, then retry.'));
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); opening = undefined; };
      resolve(db);
    };
  });
  opening.catch(() => { opening = undefined; });
  return opening;
}

function reply(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Local IndexedDB transactions replace the hosted API; no network request is made. */
export async function communityRequest(options: RequestInit = {}): Promise<Response> {
  options.signal?.throwIfAborted();
  const db = await database();
  const day = new Headers(options.headers).get('x-demo-day') ?? localDay();
  const patch = options.method === 'PATCH';
  const requestBody = patch ? JSON.parse(String(options.body)) : undefined;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('community', 'readwrite');
    const store = transaction.objectStore('community');
    let response: Response;
    let failure: Error | undefined;
    const abort = () => transaction.abort();
    options.signal?.addEventListener('abort', abort, { once: true });
    const clean = () => options.signal?.removeEventListener('abort', abort);
    transaction.oncomplete = () => { clean(); resolve(response); };
    transaction.onabort = transaction.onerror = () => {
      clean();
      reject(failure ?? new Error('Your browser couldn’t save this change. Your draft is still here. Check available storage and retry.'));
    };
    const read = store.get('world');
    read.onsuccess = () => {
      try {
        const previous = read.result as World | undefined;
        let current = deliverReminders(syncDemoDay(previous ?? seedWorld(), day));
        if (patch) {
          try {
            current = applyRequest(current, requestBody);
          } catch (error) {
            const conflict = requestBody.version !== current.version || requestBody.actor !== current.actor;
            const message = error instanceof Error ? error.message : 'This change couldn’t be saved.';
            response = reply({ error: message, state: current }, conflict ? 409 : 400);
            store.put(current, 'world');
            return;
          }
        }
        store.put(current, 'world');
        response = reply(current);
      } catch (error) {
        failure = error instanceof Error ? error : new Error('Couldn’t read your saved demo.');
        transaction.abort();
      }
    };
  });
}

/** User-selected images remain in this browser, stored with the demo community. */
export async function storePhoto(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Choose a PNG, JPG, or WebP photo.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Choose a photo smaller than 5 MB.');
  try {
    const image = await createImageBitmap(file);
    image.close();
  } catch {
    throw new Error('This file couldn’t be opened as a photo. Choose another image.');
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Your photo couldn’t be read. Please choose it again.'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}
