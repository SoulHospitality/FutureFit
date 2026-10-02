import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { loadMarketingConfig, useMarketingConfig } from '../utils/marketingConfig';
import { initTracking, trackPageView } from '../utils/tracking';
import { captureAttribution } from '../utils/attribution';
import { applyPageMeta, applyVerificationTags } from '../utils/seo';

/** Private pages that never call usePageMeta themselves: keep them out of search results. */
const PRIVATE_TITLES = [
  ['/staff', 'Staff'],
  ['/checkout', 'Checkout'],
  ['/cart', 'Your bag'],
  ['/wishlist', 'Wishlist'],
  ['/account', 'Account'],
  ['/order-success', 'Order confirmed'],
  ['/order/', 'Order'],
  ['/login', 'Sign in'],
  ['/signup', 'Create account'],
];

/** Loads marketing config, boots ad/analytics pixels, records campaign source and page views. */
export default function MarketingTracker() {
  const { pathname, search } = useLocation();
  const config = useMarketingConfig();
  const isStaff = pathname.startsWith('/staff');

  useEffect(() => {
    loadMarketingConfig();
  }, []);

  useEffect(() => {
    if (!isStaff && config?.tracking) initTracking(config.tracking);
  }, [config, isStaff]);

  useEffect(() => {
    applyVerificationTags(config?.seo);
  }, [config]);

  useEffect(() => {
    const priv = PRIVATE_TITLES.find(([prefix]) => pathname.startsWith(prefix));
    if (priv) applyPageMeta({ title: priv[1], noindex: true });
    if (isStaff) return;
    captureAttribution();
    trackPageView();
  }, [pathname, search, isStaff]);

  return null;
}
