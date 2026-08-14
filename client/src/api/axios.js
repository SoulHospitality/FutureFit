import axios from 'axios';

/** Production: set VITE_API_URL to your Railway API root, e.g. https://xxx.up.railway.app/api */
const apiBase = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

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
