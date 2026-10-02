import { useSyncExternalStore } from 'react';
import api from '../api/axios';

/** Storefront marketing config (tracking IDs, SEO defaults, announcements) set from Staff → Marketing. */

const CACHE_KEY = 'ff_marketing_config';
const listeners = new Set();
let pending = null;

const readCache = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

let config = typeof window === 'undefined' ? null : readCache();

const emit = () => listeners.forEach((fn) => fn());

export const getMarketingConfig = () => config;

export function loadMarketingConfig({ force = false } = {}) {
  if (pending && !force) return pending;
  pending = api
    .get('/marketing/public')
    .then(({ data }) => {
      config = data;
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      } catch {
        /* storage full / private mode */
      }
      emit();
      return config;
    })
    .catch(() => {
      if (!config && import.meta.env.VITE_META_PIXEL_ID) {
        config = { tracking: { metaPixelId: import.meta.env.VITE_META_PIXEL_ID } };
        emit();
      }
      return config;
    });
  return pending;
}

const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const useMarketingConfig = () =>
  useSyncExternalStore(subscribe, getMarketingConfig, getMarketingConfig);
