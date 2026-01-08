// Lightweight IndexedDB wrapper (no external libs), namespaced per user login

const DB_NAME = 'job-tracker-db';
const DB_VERSION = 1;
const STORE_JOBS = 'jobs';
const STORE_USERS = 'users';
const STORE_SETTINGS = 'settings';

export async function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = function () {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_JOBS)) {
        const jobStore = db.createObjectStore(STORE_JOBS, { keyPath: 'id' });
        jobStore.createIndex('user', 'user', { unique: false });
        jobStore.createIndex('applicationDate', 'applicationDate', { unique: false });
        jobStore.createIndex('status', 'status', { unique: false });
        jobStore.createIndex('jobLink', 'jobLink', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_USERS)) {
        db.createObjectStore(STORE_USERS, { keyPath: 'username' });
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, storeName, mode = 'readonly') {
  return db.transaction(storeName, mode).objectStore(storeName);
}

// Users
export async function saveUser(user) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, STORE_USERS, 'readwrite');
    const req = store.put(user);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

export async function getUser(username) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, STORE_USERS);
    const req = store.get(username);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function listUsers() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, STORE_USERS);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

// Settings (e.g., theme, icon)
export async function saveSetting(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, STORE_SETTINGS, 'readwrite');
    const req = store.put({ key, value });
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

export async function getSetting(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, STORE_SETTINGS);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ? req.result.value : null);
    req.onerror = () => reject(req.error);
  });
}

// Jobs
export async function addOrUpdateJob(job) {
  const db = await openDB();
  const existing = await findDuplicate(job);
  const now = new Date().toISOString();
  const record = {
    ...job,
    id: existing ? existing.id : crypto.randomUUID(),
    updatedAt: now,
    createdAt: existing ? existing.createdAt : now
  };
  console.log('addOrUpdateJob -> record to save:', record);
  return new Promise((resolve, reject) => {
    const store = tx(db, STORE_JOBS, 'readwrite');
    const req = store.put(record);
    req.onsuccess = () => resolve(record);
    req.onerror = () => reject(req.error);
  });
}

export async function findDuplicate(job) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, STORE_JOBS);
    const req = store.getAll();
    req.onsuccess = () => {
      const all = req.result || [];
      // Only treat as duplicate when both records belong to the same user
      // and have a non-empty, identical normalized jobLink.
      const dup = all.find(j =>
        j.user === job.user &&
        j.jobLink && job.jobLink &&
        normalizeUrl(j.jobLink) === normalizeUrl(job.jobLink)
      );
      console.log('findDuplicate -> checking against all jobs:', all);
      console.log('findDuplicate -> found dup:', dup);
      resolve(dup || null);
    };
    req.onerror = () => reject(req.error);
  });
}

function normalize(str) {
  return (str || '').trim().toLowerCase();
}
function normalizeUrl(u) {
  try {
    const url = new URL(u);
    // strip common tracking params but keep others (job ids, jk, id, refId, etc.)
    const stripPatterns = [/^utm_/i, /^fbclid$/i, /^gclid$/i, /^_hs$/i, /^session/i, /^trk/i, /^tracking/i, /^source$/i];
    const keep = new URLSearchParams();
    for (const [k, v] of url.searchParams.entries()) {
      const strip = stripPatterns.some(rx => rx.test(k));
      if (!strip) keep.append(k, v);
    }
    // canonicalize order for stability
    const entries = Array.from(keep.entries()).sort((a,b) => a[0].localeCompare(b[0]));
    const canonical = new URLSearchParams(entries);
    url.search = canonical.toString(); // will be '' if nothing left
    return url.toString();
  } catch {
    return (u || '').trim();
  }
}
function normalizeDate(d) {
  return new Date(d).toISOString().slice(0, 10);
}

export async function getJobsByUser(username) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, STORE_JOBS);
    const req = store.getAll();
    req.onsuccess = () => {
      const result = (req.result || []).filter(j => j.user === username);
      console.log(`getJobsByUser(${username}) -> total jobs in store: ${req.result.length}, filtered for user: ${result.length}`);
      resolve(result);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteJob(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, STORE_JOBS, 'readwrite');
    const req = store.delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

export async function clearJobsForUser(username) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, STORE_JOBS, 'readwrite');
    const getReq = store.getAll();
    getReq.onsuccess = () => {
      const toDelete = (getReq.result || []).filter(j => j.user === username);
      let remaining = toDelete.length;
      if (remaining === 0) return resolve(true);
      toDelete.forEach(j => {
        const delReq = store.delete(j.id);
        delReq.onsuccess = () => {
          remaining -= 1;
          if (remaining === 0) resolve(true);
        };
        delReq.onerror = () => reject(delReq.error);
      });
    };
    getReq.onerror = () => reject(getReq.error);
  });
}
