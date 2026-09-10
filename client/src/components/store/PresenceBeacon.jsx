import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api/axios';
import { getStoreSessionKey } from '../utils/sessionKey';

/**
 * Lightweight storefront presence ping for Live View.
 * Skips staff routes and auth pages.
 */
export default function PresenceBeacon() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (pathname.startsWith('/staff') || ['/login', '/signup'].includes(pathname)) {
      return undefined;
    }

    let cancelled = false;
    const ping = () => {
      if (cancelled || document.visibilityState === 'hidden') return;
      api
        .post('/analytics/presence', {
          sessionKey: getStoreSessionKey(),
          path: pathname,
        })
        .catch(() => {});
    };

    ping();
    const id = setInterval(ping, 45000);
    const onVis = () => {
      if (document.visibilityState === 'visible') ping();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [pathname]);

  return null;
}
