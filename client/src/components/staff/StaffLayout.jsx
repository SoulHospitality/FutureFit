import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { Menu, Store } from 'lucide-react';
import Sidebar from './Sidebar';
import { useAuth } from '../../context/AuthContext';
import { canAccess, defaultStaffPage, isStaff } from '../../utils/permissions';

const PAGE_TITLES = {
  '/staff/dashboard': 'Dashboard',
  '/staff/products': 'Products',
  '/staff/orders': 'Orders',
  '/staff/deliveries': 'Deliveries',
  '/staff/problems': 'Problems',
  '/staff/users': 'Users',
  '/staff/slides': 'Slideshow',
  '/staff/promotions': 'Promotions',
  '/staff/finance': 'Finance',
};

export default function StaffLayout({ children, page }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user) return <Navigate to="/login" replace />;
  if (!isStaff(user)) return <Navigate to="/" replace />;
  if (page && !canAccess(user, page)) {
    return <Navigate to={defaultStaffPage(user.role)} replace />;
  }

  const title =
    Object.entries(PAGE_TITLES).find(([path]) => pathname.startsWith(path))?.[1] || 'Staff';

  return (
    <div className="min-h-screen bg-timber-50">
      <Sidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="lg:ml-64">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-timber-200 bg-white/95 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="grid h-10 w-10 place-items-center border border-timber-200 text-timber-700 hover:bg-timber-50 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-timber-400">
                FutureFit staff
              </p>
              <h1 className="text-sm font-semibold text-timber-900 lg:hidden">{title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 border border-timber-200 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.18em] text-timber-700 transition hover:border-timber-900 hover:bg-timber-50"
            >
              <Store className="h-3.5 w-3.5" strokeWidth={1.5} />
              <span className="hidden sm:inline">View store</span>
            </Link>
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-timber-800">{user.name}</p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-timber-400">{user.role}</p>
            </div>
          </div>
        </header>

        <main className="min-h-[calc(100vh-3.5rem)] p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
