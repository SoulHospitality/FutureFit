/** Stable anonymous session id for analytics / abandoned checkouts. */
const KEY = 'ff_session_key';

export function getStoreSessionKey() {
  try {
    let key = localStorage.getItem(KEY);
    if (!key) {
      key =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `ff_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(KEY, key);
    }
    return key;
  } catch {
    return `ff_ephemeral_${Date.now()}`;
  }
}
