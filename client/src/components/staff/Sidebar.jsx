import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
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
  Store,
  Layers,
  Star,
  Mail,
  Activity,
  BarChart3,
  FileText,
  ShoppingCart,
  UserRound,
  PackageSearch,
  Settings2,
  LayoutGrid,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { canAccess } from '../../utils/permissions';
import BrandLogo from '../BrandLogo';
import api from '../../api/axios';

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { path: '/staff/dashboard', label: 'Home', icon: LayoutDashboard, page: 'dashboard' },
      { path: '/staff/live', label: 'Live View', icon: Activity, page: 'live' },
      { path: '/staff/analytics', label: 'Analytics', icon: BarChart3, page: 'analytics' },
      { path: '/staff/reports', label: 'Reports', icon: FileText, page: 'reports' },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { path: '/staff/products', label: 'Products', icon: Package, page: 'products' },
      { path: '/staff/inventory', label: 'Inventory', icon: PackageSearch, page: 'inventory' },
      { path: '/staff/categories', label: 'Categories', icon: Layers, page: 'categories' },
      { path: '/staff/reviews', label: 'Reviews', icon: Star, page: 'reviews' },
      { path: '/staff/newsletter', label: 'Newsletter', icon: Mail, page: 'newsletter' },
      { path: '/staff/slides', label: 'Slideshow', icon: Images, page: 'slides' },
      { path: '/staff/homepage', label: 'Homepage', icon: Store, page: 'homepage' },
      { path: '/staff/shop-control', label: 'Shop Control', icon: LayoutGrid, page: 'shop-control' },
      { path: '/staff/promotions', label: 'Promotions', icon: Tag, page: 'promotions' },
    ],
  },
  {
    label: 'Orders',
    items: [
      { path: '/staff/orders', label: 'Orders', icon: Boxes, page: 'orders', badge: 'open' },
      {
        path: '/staff/abandoned',
        label: 'Abandoned',
        icon: ShoppingCart,
        page: 'abandoned',
        badge: 'abandoned',
      },
      { path: '/staff/customers', label: 'Customers', icon: UserRound, page: 'customers' },
      { path: '/staff/deliveries', label: 'Deliveries', icon: Truck, page: 'deliveries' },
      {
        path: '/staff/problems',
        label: 'Problems',
        icon: AlertTriangle,
        page: 'problems',
        badge: 'problems',
      },
    ],
  },
  {
    label: 'Admin',
    items: [
      { path: '/staff/users', label: 'Users', icon: Users, page: 'users' },
      { path: '/staff/finance', label: 'Finance', icon: Wallet, page: 'finance' },
      { path: '/staff/settings', label: 'Settings', icon: Settings2, page: 'settings' },
    ],
  },
];

function Badge({ n }) {
  if (!n) return null;
  return (
    <span className="ml-auto rounded-full bg-zinc-900 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white">
      {n > 99 ? '99+' : n}
    </span>
  );
}

export default function Sidebar({ open = false, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [counts, setCounts] = useState({});

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!user || !['admin', 'ops'].includes(user.role)) return undefined;
    let alive = true;
    const load = () =>
      api
        .get('/analytics/ops-counts')
        .then((r) => {
          if (alive) setCounts(r.data || {});
        })
        .catch(() => {});
    load();
    const id = setInterval(load, 60000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [user]);

  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => canAccess(user, item.page)),
  })).filter((group) => group.items.length > 0);

  const badgeFor = (key) => {
    if (key === 'open') return counts.open;
    if (key === 'abandoned') return counts.abandoned;
    if (key === 'problems') return counts.problems;
    return 0;
  };

  const panel = (
    <aside className="flex h-full w-64 flex-col border-r border-zinc-200 bg-white">
      <div className="flex items-start justify-between border-b border-zinc-100 px-5 py-5">
        <div>
          <BrandLogo to="/staff" size="md" />
          <p className="mt-2 text-[11px] font-medium capitalize text-zinc-500">
            {user?.role} · admin
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-lg text-zinc-600 hover:bg-zinc-100 lg:hidden"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-2 py-4">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="mb-1.5 px-3 text-[11px] font-medium text-zinc-400">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => onClose?.()}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                      isActive
                        ? 'bg-zinc-100 text-zinc-900'
                        : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                    }`
                  }
                >
                  <item.icon className="h-4 w-4 flex-shrink-0 opacity-70" strokeWidth={1.75} />
                  <span>{item.label}</span>
                  {item.badge ? <Badge n={badgeFor(item.badge)} /> : null}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="space-y-1 border-t border-zinc-100 p-3">
        <Link
          to="/"
          onClick={() => onClose?.()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
        >
          <Store className="h-4 w-4" strokeWidth={1.75} />
          <span>View store</span>
        </Link>
        <div className="truncate px-3 text-xs text-zinc-400">{user?.email}</div>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
          onClick={() => {
            logout();
            navigate('/login');
          }}
        >
          <LogOut className="h-4 w-4" strokeWidth={1.75} />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );

  return (
    <>
      <div className="fixed inset-y-0 left-0 z-40 hidden lg:block">{panel}</div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-zinc-900/40"
            aria-label="Close menu"
            onClick={onClose}
          />
          <div className="absolute inset-y-0 left-0 shadow-2xl">{panel}</div>
        </div>
      )}
    </>
  );
}
