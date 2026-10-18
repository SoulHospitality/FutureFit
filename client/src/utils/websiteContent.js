import { useSyncExternalStore } from 'react';
import api from '../api/axios';

/** Storefront website content (wording, policies, contacts) from Staff → Website Controller. */

const CACHE_KEY = 'ff_website_content';
const listeners = new Set();
let pending = null;
/** In-memory draft pushed from Website Controller preview (postMessage). */
let liveDraft = null;

const readCache = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

let content = typeof window === 'undefined' ? null : readCache();

const emit = () => listeners.forEach((fn) => fn());

export const getWebsiteContent = () => content;

export function loadWebsiteContent({ force = false } = {}) {
  if (pending && !force) return pending;
  pending = api
    .get('/website/public')
    .then(({ data }) => {
      content = data;
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      } catch {
        /* storage full / private mode */
      }
      emit();
      return content;
    })
    .catch(() => content);
  return pending;
}

const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const useWebsiteContent = () =>
  useSyncExternalStore(subscribe, getWebsiteContent, getWebsiteContent);

/** Staff live-preview: push draft into same-origin preview iframes. */
export function writeWebsiteDraft(draft) {
  liveDraft = draft;
  try {
    sessionStorage.setItem('ff_website_draft', JSON.stringify(draft));
  } catch {
    /* ignore */
  }
  emit();
  try {
    const frames = document.querySelectorAll('iframe[data-ff-preview]');
    frames.forEach((frame) => {
      frame.contentWindow?.postMessage(
        { type: 'ff-website-draft', draft },
        window.location.origin
      );
    });
  } catch {
    /* ignore */
  }
}

export function readWebsiteDraft() {
  if (liveDraft) return liveDraft;
  try {
    const parsed = JSON.parse(sessionStorage.getItem('ff_website_draft'));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function clearWebsiteDraft() {
  liveDraft = null;
  try {
    sessionStorage.removeItem('ff_website_draft');
  } catch {
    /* ignore */
  }
  emit();
}

/** Prefer draft (preview) then saved content then hardcoded fallback. */
export function pickWording(path, fallback = '') {
  const draft = typeof window !== 'undefined' ? readWebsiteDraft() : null;
  const src = draft || content;
  if (!src) return fallback;
  const parts = path.split('.');
  let cur = src;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return fallback;
    cur = cur[p];
  }
  return cur != null && String(cur).trim() !== '' ? String(cur) : fallback;
}

let draftListenerBound = false;
function ensureDraftListener() {
  if (draftListenerBound || typeof window === 'undefined') return;
  draftListenerBound = true;
  window.addEventListener('message', (e) => {
    if (e.origin !== window.location.origin) return;
    if (e.data?.type !== 'ff-website-draft') return;
    if (e.data.draft && typeof e.data.draft === 'object') {
      liveDraft = e.data.draft;
      emit();
    }
  });
}

export function useWebsiteDraftSync() {
  ensureDraftListener();
  return useSyncExternalStore(
    subscribe,
    () => readWebsiteDraft()?.updatedAt || 0,
    () => 0
  );
}

/** Merged draft (live preview) + saved website content. */
export function useSiteCopy() {
  ensureDraftListener();
  useWebsiteContent();
  useWebsiteDraftSync();
  return readWebsiteDraft() || content || {};
}
