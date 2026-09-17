import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Routes, Route, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import { CategoriesProvider } from './context/CategoriesContext';
import StoreHeader from './components/store/StoreHeader';
import StoreFooter from './components/store/StoreFooter';
import MiniCartDrawer from './components/store/MiniCartDrawer';
import PresenceBeacon from './components/store/PresenceBeacon';
import StaffLayout from './components/staff/StaffLayout';
import ScrollToTop from './components/ScrollToTop';
import MetaPixelTracker from './components/MetaPixelTracker';
import BrandLoader from './components/ui/BrandLoader';
import { defaultStaffPage, isStaff } from './utils/permissions';

import { COMING_SOON } from './config';
// Dashboard is the staff landing page — load eagerly so the shell isn't blank
import StaffDashboard from './pages/staff/Dashboard';

const ComingSoonPage = lazy(() => import('./pages/ComingSoonPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const ShopPage = lazy(() => import('./pages/ShopPage'));
const ProductPage = lazy(() => import('./pages/ProductPage'));
const CartPage = lazy(() => import('./pages/CartPage'));
const WishlistPage = lazy(() => import('./pages/WishlistPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const OrderSuccessPage = lazy(() => import('./pages/OrderSuccessPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const AccountPage = lazy(() => import('./pages/AccountPage'));
const OrderPage = lazy(() => import('./pages/OrderPage'));
const PrivacyPage = lazy(() =>
  import('./pages/LegalPages').then((m) => ({ default: m.PrivacyPage }))
);
const TermsPage = lazy(() =>
  import('./pages/LegalPages').then((m) => ({ default: m.TermsPage }))
);
const ReturnsPage = lazy(() =>
  import('./pages/LegalPages').then((m) => ({ default: m.ReturnsPage }))
);

const StaffProducts = lazy(() => import('./pages/staff/Products'));
const StaffOrders = lazy(() => import('./pages/staff/Orders'));
const StaffDeliveries = lazy(() => import('./pages/staff/Deliveries'));
const StaffProblems = lazy(() => import('./pages/staff/Problems'));
const StaffUsers = lazy(() => import('./pages/staff/Users'));
const StaffSlides = lazy(() => import('./pages/staff/Slides'));
const StaffHomepage = lazy(() => import('./pages/staff/Homepage'));
const StaffPromotions = lazy(() => import('./pages/staff/Promotions'));
const StaffFinance = lazy(() => import('./pages/staff/Finance'));
const StaffCategories = lazy(() => import('./pages/staff/Categories'));
const StaffReviews = lazy(() => import('./pages/staff/Reviews'));
const StaffNewsletter = lazy(() => import('./pages/staff/Newsletter'));
const StaffAnalytics = lazy(() => import('./pages/staff/Analytics'));
const StaffReports = lazy(() => import('./pages/staff/Reports'));
const StaffLiveView = lazy(() => import('./pages/staff/LiveView'));
const StaffAbandoned = lazy(() => import('./pages/staff/Abandoned'));
const StaffOrderDetail = lazy(() => import('./pages/staff/OrderDetail'));
const StaffCustomers = lazy(() => import('./pages/staff/Customers'));
const StaffSettings = lazy(() => import('./pages/staff/Settings'));
const StaffInventory = lazy(() => import('./pages/staff/Inventory'));

const STAFF_PREFETCH = [
  () => import('./pages/staff/Products'),
  () => import('./pages/staff/Orders'),
  () => import('./pages/staff/Deliveries'),
  () => import('./pages/staff/Problems'),
  () => import('./pages/staff/Users'),
  () => import('./pages/staff/Slides'),
  () => import('./pages/staff/Homepage'),
  () => import('./pages/staff/Promotions'),
  () => import('./pages/staff/Finance'),
  () => import('./pages/staff/Categories'),
  () => import('./pages/staff/Reviews'),
  () => import('./pages/staff/Newsletter'),
  () => import('./pages/staff/Analytics'),
  () => import('./pages/staff/Reports'),
  () => import('./pages/staff/LiveView'),
  () => import('./pages/staff/Abandoned'),
  () => import('./pages/staff/OrderDetail'),
  () => import('./pages/staff/Customers'),
  () => import('./pages/staff/Settings'),
  () => import('./pages/staff/Inventory'),
];

function PageLoader() {
  return <BrandLoader fullPage size="lg" label="Loading" />;
}

function StaffSkeleton() {
  return (
    <div className="grid min-h-[40vh] place-items-center">
      <BrandLoader size="md" label="Loading" />
    </div>
  );
}

function StaffRoute({ page, children }) {
  return (
    <StaffLayout page={page}>
      <Suspense fallback={<StaffSkeleton />}>{children}</Suspense>
    </StaffLayout>
  );
}

function PrefetchStaffChunks() {
  const { user } = useAuth();
  useEffect(() => {
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 400));
    const id = idle(() => {
      // Warm the most common storefront routes
      import('./pages/ShopPage');
      import('./pages/ProductPage');
      if (user && isStaff(user)) {
        STAFF_PREFETCH.forEach((load) => load());
      }
    });
    return () => {
      if (window.cancelIdleCallback) window.cancelIdleCallback(id);
      else clearTimeout(id);
    };
  }, [user]);
  return null;
}

function StoreShell({ children }) {
  const location = useLocation();
  const isStaffRoute = location.pathname.startsWith('/staff');
  const isComingSoon = COMING_SOON && location.pathname === '/';
  const hideChrome =
    isComingSoon ||
    ['/login', '/signup'].includes(location.pathname) ||
    isStaffRoute;

  return (
    <div className={`min-h-screen flex flex-col ${isComingSoon ? 'bg-white' : ''}`}>
      {!hideChrome && <StoreHeader />}
      <div className="flex-1">
        <Suspense fallback={<PageLoader />}>{children}</Suspense>
      </div>
      {!hideChrome && <StoreFooter />}
      {!hideChrome && <MiniCartDrawer />}
      {!hideChrome && <PresenceBeacon />}
    </div>
  );
}

function RequireCustomer({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) {
    const redirect = `${location.pathname}${location.search || ''}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirect)}`} replace />;
  }
  return children;
}

function StaffHome() {
  const { user } = useAuth();
  if (!user || !isStaff(user)) return <Navigate to="/login" replace />;
  return <Navigate to={defaultStaffPage(user.role)} replace />;
}

function AppRoutes() {
  return (
    <StoreShell>
      <ScrollToTop />
      <MetaPixelTracker />
      <PrefetchStaffChunks />
      <Routes>
        {COMING_SOON ? (
          <>
            <Route path="/" element={<ComingSoonPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/staff" element={<StaffHome />} />
            <Route path="/staff/dashboard" element={<StaffRoute page="dashboard"><StaffDashboard /></StaffRoute>} />
            <Route path="/staff/live" element={<StaffRoute page="live"><StaffLiveView /></StaffRoute>} />
            <Route path="/staff/analytics" element={<StaffRoute page="analytics"><StaffAnalytics /></StaffRoute>} />
            <Route path="/staff/reports" element={<StaffRoute page="reports"><StaffReports /></StaffRoute>} />
            <Route path="/staff/products" element={<StaffRoute page="products"><StaffProducts /></StaffRoute>} />
            <Route path="/staff/categories" element={<StaffRoute page="categories"><StaffCategories /></StaffRoute>} />
            <Route path="/staff/reviews" element={<StaffRoute page="reviews"><StaffReviews /></StaffRoute>} />
            <Route path="/staff/newsletter" element={<StaffRoute page="newsletter"><StaffNewsletter /></StaffRoute>} />
            <Route path="/staff/orders" element={<StaffRoute page="orders"><StaffOrders /></StaffRoute>} />
            <Route path="/staff/orders/:id" element={<StaffRoute page="orders"><StaffOrderDetail /></StaffRoute>} />
            <Route path="/staff/abandoned" element={<StaffRoute page="abandoned"><StaffAbandoned /></StaffRoute>} />
            <Route path="/staff/customers" element={<StaffRoute page="customers"><StaffCustomers /></StaffRoute>} />
            <Route path="/staff/inventory" element={<StaffRoute page="inventory"><StaffInventory /></StaffRoute>} />
            <Route path="/staff/settings" element={<StaffRoute page="settings"><StaffSettings /></StaffRoute>} />
            <Route path="/staff/deliveries" element={<StaffRoute page="deliveries"><StaffDeliveries /></StaffRoute>} />
            <Route path="/staff/problems" element={<StaffRoute page="problems"><StaffProblems /></StaffRoute>} />
            <Route path="/staff/users" element={<StaffRoute page="users"><StaffUsers /></StaffRoute>} />
            <Route path="/staff/slides" element={<StaffRoute page="slides"><StaffSlides /></StaffRoute>} />
            <Route path="/staff/homepage" element={<StaffRoute page="homepage"><StaffHomepage /></StaffRoute>} />
            <Route path="/staff/promotions" element={<StaffRoute page="promotions"><StaffPromotions /></StaffRoute>} />
            <Route path="/staff/finance" element={<StaffRoute page="finance"><StaffFinance /></StaffRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        ) : (
          <>
            <Route path="/" element={<HomePage />} />
            <Route path="/shop" element={<ShopPage />} />
            <Route path="/product/:id" element={<ProductPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/wishlist" element={<WishlistPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/checkout/contact" element={<CheckoutPage />} />
            <Route path="/checkout/shipping" element={<CheckoutPage />} />
            <Route path="/checkout/payment" element={<CheckoutPage />} />
            <Route path="/order-success" element={<OrderSuccessPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/account" element={<RequireCustomer><AccountPage /></RequireCustomer>} />
            <Route path="/order/:id" element={<RequireCustomer><OrderPage /></RequireCustomer>} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/returns" element={<ReturnsPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />

            <Route path="/staff" element={<StaffHome />} />
            <Route path="/staff/dashboard" element={<StaffRoute page="dashboard"><StaffDashboard /></StaffRoute>} />
            <Route path="/staff/live" element={<StaffRoute page="live"><StaffLiveView /></StaffRoute>} />
            <Route path="/staff/analytics" element={<StaffRoute page="analytics"><StaffAnalytics /></StaffRoute>} />
            <Route path="/staff/reports" element={<StaffRoute page="reports"><StaffReports /></StaffRoute>} />
            <Route path="/staff/products" element={<StaffRoute page="products"><StaffProducts /></StaffRoute>} />
            <Route path="/staff/categories" element={<StaffRoute page="categories"><StaffCategories /></StaffRoute>} />
            <Route path="/staff/reviews" element={<StaffRoute page="reviews"><StaffReviews /></StaffRoute>} />
            <Route path="/staff/newsletter" element={<StaffRoute page="newsletter"><StaffNewsletter /></StaffRoute>} />
            <Route path="/staff/orders" element={<StaffRoute page="orders"><StaffOrders /></StaffRoute>} />
            <Route path="/staff/orders/:id" element={<StaffRoute page="orders"><StaffOrderDetail /></StaffRoute>} />
            <Route path="/staff/abandoned" element={<StaffRoute page="abandoned"><StaffAbandoned /></StaffRoute>} />
            <Route path="/staff/customers" element={<StaffRoute page="customers"><StaffCustomers /></StaffRoute>} />
            <Route path="/staff/inventory" element={<StaffRoute page="inventory"><StaffInventory /></StaffRoute>} />
            <Route path="/staff/settings" element={<StaffRoute page="settings"><StaffSettings /></StaffRoute>} />
            <Route path="/staff/deliveries" element={<StaffRoute page="deliveries"><StaffDeliveries /></StaffRoute>} />
            <Route path="/staff/problems" element={<StaffRoute page="problems"><StaffProblems /></StaffRoute>} />
            <Route path="/staff/users" element={<StaffRoute page="users"><StaffUsers /></StaffRoute>} />
            <Route path="/staff/slides" element={<StaffRoute page="slides"><StaffSlides /></StaffRoute>} />
            <Route path="/staff/homepage" element={<StaffRoute page="homepage"><StaffHomepage /></StaffRoute>} />
            <Route path="/staff/promotions" element={<StaffRoute page="promotions"><StaffPromotions /></StaffRoute>} />
            <Route path="/staff/finance" element={<StaffRoute page="finance"><StaffFinance /></StaffRoute>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
    </StoreShell>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CategoriesProvider>
          <CartProvider>
            <WishlistProvider>
              <ToastContainer
                position="top-center"
                theme="light"
                limit={3}
                newestOnTop
                closeOnClick
                hideProgressBar={false}
                icon={false}
                toastClassName="ff-toast"
                bodyClassName="ff-toast-body"
                progressClassName="ff-toast-progress"
              />
              <AppRoutes />
            </WishlistProvider>
          </CartProvider>
        </CategoriesProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
