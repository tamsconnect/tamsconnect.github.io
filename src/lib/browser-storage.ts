import { applyRequest, deliverReminders, localDay, seedWorld, syncDemoDay, type World } from './community';
import { activateDemoMember, emptyDemoAccess, registerDemoMember, restoreDemoAccess, retireSetupSample, selectableDemoProfiles, type DemoAccess, type DemoProfileInput } from './demo-access';

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
        if (patch && requestBody.action?.type === 'switch') {
          const session = store.get('access');
          session.onsuccess = () => {
            const access = session.result as DemoAccess | undefined;
            if (access?.active) store.put({ ...access, active: current.actor }, 'access');
          };
        }
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

/** Profiles and entry state are saved atomically with the local demo world. No credentials are collected. */
async function accessTransaction<T>(change: (world: World, access: DemoAccess) => { world: World; access: DemoAccess; result: T }): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('community', 'readwrite');
    const store = tx.objectStore('community');
    let result: T;
    let failure: unknown;
    const worldRead = store.get('world');
    const accessRead = store.get('access');
    let completed = 0;
    const finish = () => {
      if (++completed !== 2) return;
      try {
        const world = deliverReminders(syncDemoDay((worldRead.result as World | undefined) ?? seedWorld(), localDay()));
        const access = (accessRead.result as DemoAccess | undefined) ?? emptyDemoAccess();
        const next = change(world, access);
        store.put(next.world, 'world');
        store.put(next.access, 'access');
        result = next.result;
      } catch (error) { failure = error; tx.abort(); }
    };
    worldRead.onsuccess = finish;
    accessRead.onsuccess = finish;
    tx.oncomplete = () => resolve(result);
    tx.onerror = tx.onabort = () => reject(failure ?? new Error('Your browser could not save your profile. Your details are still here. Please retry.'));
  });
}

export function readDemoAccess() {
  return accessTransaction((world, access) => {
    const cleaned = retireSetupSample(world, access);
    const next = restoreDemoAccess(cleaned.world, cleaned.access);
    return { world: cleaned.world, access: next, result: { access: next, profiles: selectableDemoProfiles(cleaned.world, next) } };
  });
}

export function createDemoAccount(input: DemoProfileInput) {
  const memberId = 'visitor-' + crypto.randomUUID();
  return accessTransaction((world, access) => {
    const next = registerDemoMember(world, input, memberId);
    const state = { ...access, accounts: [...access.accounts, memberId], active: memberId };
    return { world: next, access: state, result: memberId };
  });
}

export function signInDemoAccount(memberId: string) {
  return accessTransaction((world, access) => {
    const next = activateDemoMember(world, access, memberId);
    return { ...next, result: memberId };
  });
}

export function signOutDemoAccount() {
  return accessTransaction((world, access) => ({ world, access: { ...access, active: null }, result: true }));
}
