import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Routes, Route, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import StoreHeader from './components/store/StoreHeader';
import StoreFooter from './components/store/StoreFooter';
import StaffLayout from './components/staff/StaffLayout';
import { defaultStaffPage, isStaff } from './utils/permissions';

import { COMING_SOON } from './config';
import ComingSoonPage from './pages/ComingSoonPage';
import HomePage from './pages/HomePage';
import ShopPage from './pages/ShopPage';
import ProductPage from './pages/ProductPage';
import CartPage from './pages/CartPage';
import WishlistPage from './pages/WishlistPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import OrderSuccessPage from './pages/OrderSuccessPage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
// Dashboard is the staff landing page — load eagerly so the shell isn't blank
import StaffDashboard from './pages/staff/Dashboard';

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
const StaffPromotions = lazy(() => import('./pages/staff/Promotions'));
const StaffFinance = lazy(() => import('./pages/staff/Finance'));

const STAFF_PREFETCH = [
  () => import('./pages/staff/Products'),
  () => import('./pages/staff/Orders'),
  () => import('./pages/staff/Deliveries'),
  () => import('./pages/staff/Problems'),
  () => import('./pages/staff/Users'),
  () => import('./pages/staff/Slides'),
  () => import('./pages/staff/Promotions'),
  () => import('./pages/staff/Finance'),
];

function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-8 w-8 border border-timber-900 border-t-transparent animate-spin" />
    </div>
  );
}

function StaffSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-48 bg-timber-200" />
        <div className="h-4 w-64 bg-timber-100" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 border border-timber-100 bg-white" />
        ))}
      </div>
      <div className="h-72 border border-timber-100 bg-white" />
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
    if (!user || !isStaff(user)) return undefined;
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 200));
    const id = idle(() => {
      STAFF_PREFETCH.forEach((load) => load());
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
      <PrefetchStaffChunks />
      <Routes>
        {COMING_SOON ? (
          <>
            <Route path="/" element={<ComingSoonPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/staff" element={<StaffHome />} />
            <Route path="/staff/dashboard" element={<StaffRoute page="dashboard"><StaffDashboard /></StaffRoute>} />
            <Route path="/staff/products" element={<StaffRoute page="products"><StaffProducts /></StaffRoute>} />
            <Route path="/staff/orders" element={<StaffRoute page="orders"><StaffOrders /></StaffRoute>} />
            <Route path="/staff/deliveries" element={<StaffRoute page="deliveries"><StaffDeliveries /></StaffRoute>} />
            <Route path="/staff/problems" element={<StaffRoute page="problems"><StaffProblems /></StaffRoute>} />
            <Route path="/staff/users" element={<StaffRoute page="users"><StaffUsers /></StaffRoute>} />
            <Route path="/staff/slides" element={<StaffRoute page="slides"><StaffSlides /></StaffRoute>} />
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
            <Route path="/staff/products" element={<StaffRoute page="products"><StaffProducts /></StaffRoute>} />
            <Route path="/staff/orders" element={<StaffRoute page="orders"><StaffOrders /></StaffRoute>} />
            <Route path="/staff/deliveries" element={<StaffRoute page="deliveries"><StaffDeliveries /></StaffRoute>} />
            <Route path="/staff/problems" element={<StaffRoute page="problems"><StaffProblems /></StaffRoute>} />
            <Route path="/staff/users" element={<StaffRoute page="users"><StaffUsers /></StaffRoute>} />
            <Route path="/staff/slides" element={<StaffRoute page="slides"><StaffSlides /></StaffRoute>} />
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
      </AuthProvider>
    </BrowserRouter>
  );
}
