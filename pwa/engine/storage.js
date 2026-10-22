/**
 * StudySynth Lite — Offline Storage Manager
 * Uses IndexedDB with LocalStorage fallback for 100% offline persistence on Android and desktop.
 */

(function (global) {
  'use strict';

  const DB_NAME = 'StudySynthLiteDB';
  const DB_VERSION = 1;
  const STORE_MODULES = 'modules';
  const STORE_ATTEMPTS = 'attempts';

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
        tx.onerror = () => reject(tx.error);
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
    toggleBookmark
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = OfflineStorage;
  }
  if (typeof window !== 'undefined') {
    window.OfflineStorage = OfflineStorage;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
