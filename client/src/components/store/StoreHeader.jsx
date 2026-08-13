import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, ShoppingBag, User, X, Heart } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { isStaff } from '../../utils/permissions';
import BrandLogo from '../BrandLogo';

const NAV = [
  { to: '/shop', label: 'Shop' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
];

export default function StoreHeader() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const { count: wishCount } = useWishlist();
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const overHero = pathname === '/';
  const solid = !overHero || scrolled;
  const lightLogo = overHero && !scrolled;

  useEffect(() => {
    if (!overHero) {
      setScrolled(false);
      return undefined;
    }
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [overHero]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const linkCls = solid
    ? 'text-timber-600 hover:text-timber-900'
    : 'text-white/85 hover:text-white';

  return (
    <>
      <header
        className={`${overHero ? 'fixed' : 'sticky'} top-0 inset-x-0 z-50 transition-all duration-300 ${
          solid
            ? 'bg-white/95 shadow-[0_1px_0_rgba(9,9,11,0.08)] backdrop-blur-md'
            : 'bg-transparent'
        }`}
      >
        <div className="bg-timber-900 text-center text-[10px] font-medium uppercase tracking-[0.28em] text-white/90 px-4 py-2.5">
          Free shipping over EGP 2,000 · COD · InstaPay · Vodafone Cash
        </div>
        <div className="relative mx-auto flex h-[88px] sm:h-[96px] max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
          <div className="relative z-10 shrink-0">
            <BrandLogo size="header" invert={lightLogo} />
          </div>

          <nav className="pointer-events-none absolute inset-x-0 hidden items-center justify-center gap-8 xl:gap-10 lg:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `pointer-events-auto text-[11px] xl:text-[12px] font-medium uppercase tracking-[0.28em] transition-colors ${
                    isActive && solid ? 'text-timber-900' : linkCls
                  }`
                }
                end={item.to === '/shop' ? false : true}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="relative z-10 flex items-center gap-1.5 sm:gap-2">
            <Link
              to="/wishlist"
              aria-label="Wishlist"
              className={`relative grid h-11 w-11 place-items-center transition ${
                solid
                  ? 'text-timber-700 hover:bg-timber-100'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              <Heart className="h-5 w-5" strokeWidth={1.5} />
              {wishCount > 0 && (
                <span className="absolute -top-0.5 -end-0.5 grid h-5 min-w-5 place-items-center bg-timber-900 px-1 text-[10px] font-semibold text-white">
                  {wishCount}
                </span>
              )}
            </Link>
            <Link
              to="/cart"
              aria-label="Cart"
              className={`relative grid h-11 w-11 place-items-center transition ${
                solid
                  ? 'text-timber-700 hover:bg-timber-100'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              <ShoppingBag className="h-5 w-5" strokeWidth={1.5} />
              {count > 0 && (
                <span className="absolute -top-0.5 -end-0.5 grid h-5 min-w-5 place-items-center bg-timber-900 px-1 text-[10px] font-semibold text-white">
                  {count}
                </span>
              )}
            </Link>

            {user ? (
              <div className="hidden sm:flex items-center gap-2">
                {isStaff(user) && (
                  <Link
                    to="/staff"
                    className={`border px-4 py-2 text-[10px] font-medium uppercase tracking-[0.2em] transition ${
                      solid
                        ? 'border-timber-200 text-timber-700 hover:bg-timber-50'
                        : 'border-white/30 text-white hover:bg-white/10'
                    }`}
                  >
                    Staff
                  </Link>
                )}
                <Link
                  to="/account"
                  className={`inline-flex items-center gap-2 border px-4 py-2 text-sm font-medium transition ${
                    solid
                      ? 'border-timber-200 bg-white text-timber-700 hover:bg-timber-50'
                      : 'border-white/25 bg-white/5 text-white backdrop-blur-sm hover:bg-white/10'
                  }`}
                >
                  <User size={16} strokeWidth={1.5} />
                  <span className="hidden md:inline">{user.name.split(' ')[0]}</span>
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className={`px-3.5 py-2 text-[10px] font-medium uppercase tracking-[0.2em] transition ${
                    solid ? 'text-timber-500 hover:text-timber-900' : 'text-white/75 hover:text-white'
                  }`}
                >
                  Log out
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className={`hidden sm:inline-flex items-center gap-2 border px-5 py-2 text-sm font-medium transition ${
                  solid
                    ? 'border-timber-900 bg-timber-900 text-white hover:bg-timber-800'
                    : 'border-white/30 bg-white/10 text-white backdrop-blur-sm hover:bg-white/15'
                }`}
              >
                <User size={16} strokeWidth={1.5} />
                Sign in
              </Link>
            )}

            <button
              type="button"
              className={`lg:hidden grid h-11 w-11 place-items-center transition ${
                solid ? 'text-timber-700 hover:bg-timber-100' : 'text-white hover:bg-white/10'
              }`}
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={22} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-timber-900/50"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute end-0 top-0 flex h-full w-[min(100%,360px)] flex-col bg-white shadow-2xl">
            <div className="flex h-[72px] items-center justify-between border-b border-timber-100 px-5">
              <BrandLogo size="md" to="/" />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="grid h-10 w-10 place-items-center text-timber-700"
                aria-label="Close menu"
              >
                <X size={22} strokeWidth={1.5} />
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto px-5 py-6">
              {NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className="block border-b border-timber-100 py-4 text-[12px] font-medium uppercase tracking-[0.24em] text-timber-800"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                to="/wishlist"
                onClick={() => setMobileOpen(false)}
                className="block border-b border-timber-100 py-4 text-[12px] font-medium uppercase tracking-[0.24em] text-timber-800"
              >
                Wishlist{wishCount > 0 ? ` (${wishCount})` : ''}
              </Link>
              <Link
                to="/cart"
                onClick={() => setMobileOpen(false)}
                className="block border-b border-timber-100 py-4 text-[12px] font-medium uppercase tracking-[0.24em] text-timber-800"
              >
                Cart{count > 0 ? ` (${count})` : ''}
              </Link>
              {user ? (
                <>
                  <Link
                    to="/account"
                    onClick={() => setMobileOpen(false)}
                    className="block border-b border-timber-100 py-4 text-[12px] font-medium uppercase tracking-[0.24em] text-timber-800"
                  >
                    Account
                  </Link>
                  {isStaff(user) && (
                    <Link
                      to="/staff"
                      onClick={() => setMobileOpen(false)}
                      className="block border-b border-timber-100 py-4 text-[12px] font-medium uppercase tracking-[0.24em] text-timber-800"
                    >
                      Staff
                    </Link>
                  )}
                  <button
                    type="button"
                    className="block w-full border-b border-timber-100 py-4 text-start text-[12px] font-medium uppercase tracking-[0.24em] text-timber-500"
                    onClick={() => {
                      logout();
                      setMobileOpen(false);
                    }}
                  >
                    Log out
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  onClick={() => setMobileOpen(false)}
                  className="block border-b border-timber-100 py-4 text-[12px] font-medium uppercase tracking-[0.24em] text-timber-800"
                >
                  Sign in
                </Link>
              )}
            </nav>
            <div className="border-t border-timber-100 p-5">
              <Link
                to="/shop"
                onClick={() => setMobileOpen(false)}
                className="btn-wheat block w-full py-3.5 text-center text-[11px] font-medium uppercase tracking-[0.24em]"
              >
                Shop the collection
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
