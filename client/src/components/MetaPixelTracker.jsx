import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { initMetaPixel, isMetaPixelEnabled, trackPageView } from '../utils/metaPixel';

/** Loads Meta Pixel once and fires PageView on each client-side route change. */
export default function MetaPixelTracker() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    if (!isMetaPixelEnabled()) return;
    initMetaPixel();
  }, []);

  useEffect(() => {
    if (!isMetaPixelEnabled()) return;
    if (pathname.startsWith('/staff')) return;
    initMetaPixel();
    trackPageView();
  }, [pathname, search]);

  return null;
}
