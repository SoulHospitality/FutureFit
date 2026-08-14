import axios from 'axios';

/**
 * Resolve API base URL from Vercel/Vite env.
 * Value only — do NOT include "VITE_API_URL=" in the Vercel value field.
 * Example: https://futurefit-production-2a44.up.railway.app/api
 */
function resolveApiBase(raw) {
  let value = String(raw || '').trim();
  if (!value) return '/api';

  // Accidental paste of "VITE_API_URL=https://..." into the value field
  value = value.replace(/^VITE_API_URL\s*=\s*/i, '').trim();

  // Fix broken protocols like "https:/" → "https://"
  value = value.replace(/^(https?):\/(?!\/)/i, '$1://');

  // Strip trailing slash
  value = value.replace(/\/$/, '');

  // Relative fallback for local Vite proxy
  if (value === '/api' || value.startsWith('/')) return value || '/api';

  // Must be absolute in production; otherwise axios treats it as a path on Vercel
  if (!/^https?:\/\//i.test(value)) {
    console.warn(
      '[FutureFit] VITE_API_URL must be a full URL like https://xxx.up.railway.app/api — got:',
      raw
    );
    return '/api';
  }

  // Ensure /api suffix
  if (!/\/api$/i.test(value)) {
    value = `${value}/api`;
  }

  return value;
}

const apiBase = resolveApiBase(import.meta.env.VITE_API_URL);

const api = axios.create({
  baseURL: apiBase,
});

api.interceptors.request.use((config) => {
  try {
    const raw = localStorage.getItem('userInfo');
    if (raw) {
      const user = JSON.parse(raw);
      if (user?.token) {
        config.headers.Authorization = `Bearer ${user.token}`;
      }
    }
  } catch {
    /* ignore */
  }
  return config;
});

export default api;
