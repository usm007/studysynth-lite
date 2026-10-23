/**
 * StudySynth Lite — Offline Storage Manager
 * Uses IndexedDB with LocalStorage fallback for 100% offline persistence on Android and desktop.
 */

(function (global) {
  'use strict';

  const DB_NAME = 'StudySynthLiteDB';
  const DB_VERSION = 2;
  const STORE_MODULES = 'modules';
  const STORE_ATTEMPTS = 'attempts';
  const STORE_JOBS = 'jobs';
  const STORE_JOB_PAGES = 'jobPages';
  const STORE_JOB_INPUTS = 'jobInputs';

  let dbPromise = null;

  function getDB() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
          resolve(null); // Fallback to LocalStorage
          return;
        }
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_MODULES)) {
            db.createObjectStore(STORE_MODULES, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(STORE_ATTEMPTS)) {
            db.createObjectStore(STORE_ATTEMPTS, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(STORE_JOBS)) {
            db.createObjectStore(STORE_JOBS, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(STORE_JOB_PAGES)) {
            const pages = db.createObjectStore(STORE_JOB_PAGES, { keyPath: 'key' });
            pages.createIndex('jobId', 'jobId', { unique: false });
          }
          if (!db.objectStoreNames.contains(STORE_JOB_INPUTS)) {
            db.createObjectStore(STORE_JOB_INPUTS, { keyPath: 'jobId' });
          }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = () => resolve(null);
      });
    }
    return dbPromise;
  }

  async function saveModule(quizModule) {
    const db = await getDB();
    if (db) {
      return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_MODULES], 'readwrite');
        const store = tx.objectStore(STORE_MODULES);
        store.put(quizModule);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error || new Error('The study module could not be saved.'));
        tx.onabort = () => reject(tx.error || new Error('The study module write was aborted.'));
      });
    } else {
      // LocalStorage fallback
      const list = JSON.parse(localStorage.getItem('studysynth_modules') || '[]');
      const filtered = list.filter(m => m.id !== quizModule.id);
      filtered.unshift(quizModule);
      localStorage.setItem('studysynth_modules', JSON.stringify(filtered.slice(0, 20)));
      return true;
    }
  }

  async function getModules() {
    const db = await getDB();
    if (db) {
      return new Promise((resolve) => {
        const tx = db.transaction([STORE_MODULES], 'readonly');
        const store = tx.objectStore(STORE_MODULES);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } else {
      return JSON.parse(localStorage.getItem('studysynth_modules') || '[]');
    }
  }

  async function deleteModule(moduleId) {
    const db = await getDB();
    if (db) {
      return new Promise((resolve) => {
        const tx = db.transaction([STORE_MODULES], 'readwrite');
        const store = tx.objectStore(STORE_MODULES);
        store.delete(moduleId);
        tx.oncomplete = () => resolve(true);
      });
    } else {
      const list = JSON.parse(localStorage.getItem('studysynth_modules') || '[]');
      const filtered = list.filter(m => m.id !== moduleId);
      localStorage.setItem('studysynth_modules', JSON.stringify(filtered));
      return true;
    }
  }

  async function saveAttempt(attempt) {
    const db = await getDB();
    if (db) {
      return new Promise((resolve) => {
        const tx = db.transaction([STORE_ATTEMPTS], 'readwrite');
        const store = tx.objectStore(STORE_ATTEMPTS);
        store.put(attempt);
        tx.oncomplete = () => resolve(true);
      });
    } else {
      const list = JSON.parse(localStorage.getItem('studysynth_attempts') || '[]');
      list.unshift(attempt);
      localStorage.setItem('studysynth_attempts', JSON.stringify(list.slice(0, 50)));
      return true;
    }
  }

  async function getAttempts(moduleId) {
    const db = await getDB();
    let all = [];
    if (db) {
      all = await new Promise((resolve) => {
        const tx = db.transaction([STORE_ATTEMPTS], 'readonly');
        const store = tx.objectStore(STORE_ATTEMPTS);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } else {
      all = JSON.parse(localStorage.getItem('studysynth_attempts') || '[]');
    }
    if (moduleId) {
      return all.filter(a => a.moduleId === moduleId);
    }
    return all;
  }

  // ==========================================================================
  // PROCESSING JOBS (resumable background work)
  // ==========================================================================
  const LOCAL_JOBS_KEY = 'studysynth_jobs';

  function readLocalJobs() {
    try {
      const list = JSON.parse(localStorage.getItem(LOCAL_JOBS_KEY) || '[]');
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function writeLocalJobs(jobs) {
    localStorage.setItem(LOCAL_JOBS_KEY, JSON.stringify(jobs.slice(0, 5)));
  }

  function idbWrite(storeName, value) {
    return getDB().then((db) => {
      if (!db) return false;
      return new Promise((resolve, reject) => {
        let tx;
        try {
          tx = db.transaction([storeName], 'readwrite');
        } catch (err) {
          reject(err);
          return;
        }
        tx.objectStore(storeName).put(value);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error || new Error('Local storage write failed.'));
        tx.onabort = () => reject(tx.error || new Error('Local storage write was aborted.'));
      });
    });
  }

  function idbRead(storeName, method, arg) {
    return getDB().then((db) => {
      if (!db) return null;
      return new Promise((resolve) => {
        let tx;
        try {
          tx = db.transaction([storeName], 'readonly');
        } catch (err) {
          resolve(null);
          return;
        }
        const req = tx.objectStore(storeName)[method](arg);
        req.onsuccess = () => resolve(req.result == null ? null : req.result);
        req.onerror = () => resolve(null);
      });
    });
  }

  async function saveJob(job) {
    if (!job || !job.id) throw new Error('A processing job needs an id.');
    const db = await getDB();
    if (db) return idbWrite(STORE_JOBS, job);
    const jobs = readLocalJobs().filter((entry) => entry.id !== job.id);
    jobs.unshift(job);
    writeLocalJobs(jobs);
    return true;
  }

  async function getJobs() {
    const db = await getDB();
    if (db) {
      const list = await idbRead(STORE_JOBS, 'getAll');
      return Array.isArray(list) ? list : [];
    }
    return readLocalJobs();
  }

  async function getJob(jobId) {
    const db = await getDB();
    if (db) return idbRead(STORE_JOBS, 'get', jobId);
    return readLocalJobs().find((job) => job.id === jobId) || null;
  }

  async function deleteJob(jobId) {
    const db = await getDB();
    if (!db) {
      try {
        writeLocalJobs(readLocalJobs().filter((job) => job.id !== jobId));
        return true;
      } catch (e) {
        return false;
      }
    }
    return new Promise((resolve) => {
      let tx;
      try {
        tx = db.transaction([STORE_JOBS, STORE_JOB_PAGES, STORE_JOB_INPUTS], 'readwrite');
      } catch (err) {
        resolve(false);
        return;
      }
      tx.objectStore(STORE_JOBS).delete(jobId);
      tx.objectStore(STORE_JOB_INPUTS).delete(jobId);
      const cursorReq = tx.objectStore(STORE_JOB_PAGES).index('jobId').openCursor(IDBKeyRange.only(jobId));
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) return;
        cursor.delete();
        cursor.continue();
      };
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    });
  }

  // Large inputs (source text or the picked file) are kept in one record per
  // job so frequent checkpoint writes never duplicate the document.
  async function saveJobInput(jobId, input) {
    const db = await getDB();
    if (!db) return false;
    await idbWrite(STORE_JOB_INPUTS, Object.assign({ jobId: jobId }, input));
    return true;
  }

  async function getJobInput(jobId) {
    const db = await getDB();
    if (!db) return null;
    return idbRead(STORE_JOB_INPUTS, 'get', jobId);
  }

  async function saveJobPage(jobId, page, text) {
    const db = await getDB();
    if (!db) return false;
    await idbWrite(STORE_JOB_PAGES, {
      key: jobId + ':' + page,
      jobId: jobId,
      page: page,
      text: text
    });
    return true;
  }

  async function getJobPages(jobId) {
    const db = await getDB();
    if (!db) return [];
    return new Promise((resolve) => {
      let tx;
      try {
        tx = db.transaction([STORE_JOB_PAGES], 'readonly');
      } catch (err) {
        resolve([]);
        return;
      }
      const req = tx.objectStore(STORE_JOB_PAGES).index('jobId').getAll(IDBKeyRange.only(jobId));
      req.onsuccess = () => {
        const pages = Array.isArray(req.result) ? req.result : [];
        resolve(pages.sort((a, b) => a.page - b.page));
      };
      req.onerror = () => resolve([]);
    });
  }

  // Bookmark helpers
  function getBookmarks() {
    try {
      return JSON.parse(localStorage.getItem('studysynth_bookmarks') || '{}');
    } catch (e) {
      return {};
    }
  }

  function toggleBookmark(questionId, questionData) {
    const b = getBookmarks();
    if (b[questionId]) {
      delete b[questionId];
    } else {
      b[questionId] = {
        ...questionData,
        bookmarkedAt: new Date().toISOString()
      };
    }
    localStorage.setItem('studysynth_bookmarks', JSON.stringify(b));
    return !!b[questionId];
  }

  const OfflineStorage = {
    saveModule,
    getModules,
    deleteModule,
    saveAttempt,
    getAttempts,
    getBookmarks,
    toggleBookmark,
    saveJob,
    getJob,
    getJobs,
    deleteJob,
    saveJobInput,
    getJobInput,
    saveJobPage,
    getJobPages
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = OfflineStorage;
  }
  if (typeof window !== 'undefined') {
    window.OfflineStorage = OfflineStorage;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
