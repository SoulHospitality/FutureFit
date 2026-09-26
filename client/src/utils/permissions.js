const ADMIN_PAGES = [
  'dashboard',
  'live',
  'analytics',
  'reports',
  'products',
  'categories',
  'reviews',
  'newsletter',
  'orders',
  'abandoned',
  'customers',
  'deliveries',
  'problems',
  'inventory',
  'settings',
  'users',
  'slides',
  'homepage',
  'shop-control',
  'promotions',
  'finance',
];

const OPS_PAGES = [
  'dashboard',
  'live',
  'orders',
  'abandoned',
  'customers',
  'deliveries',
  'problems',
  'settings',
];

export const canAccess = (user, page) => {
  if (!user) return false;
  // Normalize so "shop-control" / "shopControl" both work
  const key = String(page || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-');
  if (user.role === 'admin') return ADMIN_PAGES.includes(key);
  if (user.role === 'ops') return OPS_PAGES.includes(key);
  return false;
};

export const defaultStaffPage = (role) => {
  if (role === 'ops') return '/staff/deliveries';
  return '/staff/dashboard';
};

export const isStaff = (user) => user && (user.role === 'admin' || user.role === 'ops');
