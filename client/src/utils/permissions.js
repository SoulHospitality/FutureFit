const ADMIN_PAGES = [
  'dashboard',
  'products',
  'categories',
  'reviews',
  'orders',
  'deliveries',
  'problems',
  'users',
  'slides',
  'promotions',
  'finance',
];

const OPS_PAGES = ['dashboard', 'deliveries', 'problems'];

export const canAccess = (user, page) => {
  if (!user) return false;
  if (user.role === 'admin') return ADMIN_PAGES.includes(page);
  if (user.role === 'ops') return OPS_PAGES.includes(page);
  return false;
};

export const defaultStaffPage = (role) => {
  if (role === 'ops') return '/staff/deliveries';
  return '/staff/dashboard';
};

export const isStaff = (user) => user && (user.role === 'admin' || user.role === 'ops');
