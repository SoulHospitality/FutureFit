import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Truck,
  AlertTriangle,
  Users,
  Images,
  Tag,
  Wallet,
  LogOut,
  Boxes,
  X,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { canAccess } from '../../utils/permissions';
import BrandLogo from '../BrandLogo';

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { path: '/staff/dashboard', label: 'Dashboard', icon: LayoutDashboard, page: 'dashboard' },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { path: '/staff/products', label: 'Products', icon: Package, page: 'products' },
      { path: '/staff/slides', label: 'Slideshow', icon: Images, page: 'slides' },
      { path: '/staff/promotions', label: 'Promotions', icon: Tag, page: 'promotions' },
    ],
  },
  {
    label: 'Fulfillment',
    items: [
      { path: '/staff/orders', label: 'Orders', icon: Boxes, page: 'orders' },
      { path: '/staff/deliveries', label: 'Deliveries', icon: Truck, page: 'deliveries' },
      { path: '/staff/problems', label: 'Problems', icon: AlertTriangle, page: 'problems' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { path: '/staff/users', label: 'Users', icon: Users, page: 'users' },
      { path: '/staff/finance', label: 'Finance', icon: Wallet, page: 'finance' },
    ],
  },
];

export default function Sidebar({ open = false, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => canAccess(user, item.page)),
  })).filter((group) => group.items.length > 0);

  const panel = (
    <aside className="flex h-full w-64 flex-col bg-timber-900 shadow-2xl">
      <div className="flex items-start justify-between border-b border-white/10 bg-white px-5 py-5">
        <div>
          <BrandLogo to="/staff" size="md" />
          <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.22em] text-timber-500">
            {user?.role} console
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            className="grid h-9 w-9 place-items-center text-timber-600 hover:bg-timber-50 lg:hidden"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-2 py-5">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="mb-2 px-3 text-[10px] font-medium uppercase tracking-[0.22em] text-timber-500">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => onClose?.()}
                  className={({ isActive }) =>
                    `sidebar-link ${isActive ? 'sidebar-link-active' : 'sidebar-link-inactive'}`
                  }
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" strokeWidth={1.5} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="space-y-2 border-t border-white/10 p-3">
        <a
          href="/"
          target="_blank"
          rel="noreferrer"
          className="sidebar-link sidebar-link-inactive w-full"
        >
          <ExternalLink className="h-5 w-5" strokeWidth={1.5} />
          <span>View store</span>
        </a>
        <div className="truncate px-3 text-xs text-timber-400">{user?.email}</div>
        <button
          type="button"
          className="sidebar-link sidebar-link-inactive w-full"
          onClick={() => {
            logout();
            navigate('/login');
          }}
        >
          <LogOut className="h-5 w-5" strokeWidth={1.5} />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop */}
      <div className="fixed inset-y-0 left-0 z-40 hidden lg:block">{panel}</div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-timber-900/50"
            aria-label="Close menu"
            onClick={onClose}
          />
          <div className="absolute inset-y-0 left-0 shadow-2xl">{panel}</div>
        </div>
      )}
    </>
  );
}
