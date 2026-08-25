import { useMemo, useState, useEffect } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ArrowRight, ChevronDown, Menu, ShoppingBag, User, X, Heart } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useCategories } from '../../context/CategoriesContext';
import { isStaff } from '../../utils/permissions';
import { AUDIENCES } from '../../utils/helpers';
import BrandLogo from '../BrandLogo';

export default function StoreHeader() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const { count: wishCount } = useWishlist();
  const { pathname, search } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState(null);
  const [mobileDept, setMobileDept] = useState(null);
  const { categories } = useCategories();

  const overHero = pathname === '/';
  const solid = !overHero || scrolled;
  const lightLogo = overHero && !scrolled;
  const params = new URLSearchParams(search);
  const activeAudience = pathname === '/shop' ? params.get('audience') : null;

  const byAudience = useMemo(() => {
    const map = { men: [], women: [], kids: [] };
    categories.forEach((c) => {
      if (map[c.audience]) map[c.audience].push(c);
    });
    return map;
  }, [categories]);

  useEffect(() => {
    if (!overHero) {
      setScrolled(false);
      return undefined;
    }
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setScrolled(window.scrollY > 24);
        ticking = false;
      });
    };
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
    setOpenMenu(null);
    setMobileDept(null);
  }, [pathname, search]);

  const linkCls = solid
    ? 'text-timber-600 hover:text-timber-900'
    : 'text-white/85 hover:text-white';

  const iconBtn = solid
    ? 'text-timber-700 hover:bg-timber-100'
    : 'text-white hover:bg-white/10';

  const openDept = AUDIENCES.find((a) => a.value === openMenu);

  return (
    <>
      <header
        className={`${overHero ? 'fixed' : 'sticky'} top-0 inset-x-0 z-50 transition-colors duration-200 ${
          solid
            ? 'border-b border-timber-100 bg-white'
            : 'border-b border-transparent bg-transparent'
        }`}
        onMouseLeave={() => setOpenMenu(null)}
      >
        <div className="bg-timber-900 px-4 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.32em] text-white/90">
          Free shipping over EGP 2,000 · COD · InstaPay · Vodafone Cash
        </div>
        <div className="relative mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-5 sm:h-[84px] sm:px-8">
          <div className="relative z-10 shrink-0">
            <BrandLogo size="header" invert={lightLogo} />
          </div>

          <nav className="pointer-events-none absolute inset-x-0 hidden items-center justify-center gap-8 xl:gap-10 lg:flex">
            {AUDIENCES.map((dept) => {
              const active = activeAudience === dept.value;
              return (
                <div
                  key={dept.value}
                  className="pointer-events-auto"
                  onMouseEnter={() => setOpenMenu(dept.value)}
                >
                  <Link
                    to={`/shop?audience=${dept.value}`}
                    data-active={active ? 'true' : 'false'}
                    className={`nav-link-accent ${
                      active && solid ? 'text-timber-900' : linkCls
                    }`}
                  >
                    {dept.label}
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform duration-200 ${
                        openMenu === dept.value ? 'rotate-180' : 'opacity-70'
                      }`}
                      strokeWidth={1.75}
                    />
                  </Link>
                </div>
              );
            })}
            {[
              { to: '/about', label: 'About' },
              { to: '/contact', label: 'Contact' },
            ].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `nav-link-accent pointer-events-auto ${
                    isActive && solid ? 'text-timber-900' : linkCls
                  }`
                }
                data-active={pathname === item.to ? 'true' : 'false'}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="relative z-10 flex items-center gap-1.5 sm:gap-2">
            <Link
              to="/wishlist"
              aria-label="Wishlist"
              className={`relative grid h-11 w-11 place-items-center transition-colors ${iconBtn}`}
            >
              <Heart className="h-5 w-5" strokeWidth={1.5} />
              {wishCount > 0 && (
                <span className="absolute -end-0.5 -top-0.5 grid h-5 min-w-5 place-items-center bg-timber-900 px-1 text-[10px] font-semibold text-white">
                  {wishCount}
                </span>
              )}
            </Link>
            <Link
              to="/cart"
              aria-label="Cart"
              className={`relative grid h-11 w-11 place-items-center transition-colors ${iconBtn}`}
            >
              <ShoppingBag className="h-5 w-5" strokeWidth={1.5} />
              {count > 0 && (
                <span className="absolute -end-0.5 -top-0.5 grid h-5 min-w-5 place-items-center bg-timber-900 px-1 text-[10px] font-semibold text-white">
                  {count}
                </span>
              )}
            </Link>

            {user ? (
              <div className="hidden items-center gap-2 sm:flex">
                {isStaff(user) && (
                  <Link to="/staff" className="btn-outline btn-sm">
                    Staff
                  </Link>
                )}
                <Link
                  to="/account"
                  className={`inline-flex items-center gap-2 border px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition ${
                    solid
                      ? 'border-timber-200 text-timber-800 hover:border-timber-900 hover:bg-timber-50'
                      : 'border-white/30 text-white hover:bg-white/10'
                  }`}
                >
                  <User size={15} strokeWidth={1.5} />
                  <span className="hidden md:inline">{(user.name || 'Account').split(' ')[0]}</span>
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] transition ${
                    solid ? 'text-timber-500 hover:text-timber-900' : 'text-white/75 hover:text-white'
                  }`}
                >
                  Log out
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className={`hidden sm:inline-flex ${solid ? 'btn-wheat btn-sm' : 'btn-outline btn-sm border-white text-white hover:bg-white hover:text-timber-900'}`}
              >
                <User size={14} strokeWidth={1.5} />
                Sign in
              </Link>
            )}

            <button
              type="button"
              className={`grid h-11 w-11 place-items-center transition-colors lg:hidden ${iconBtn}`}
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={22} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {openMenu && (
          <div className="mega-dropdown hidden border-t border-timber-100 bg-white lg:block">
            <div className="mx-auto grid max-w-7xl gap-0 px-8 py-0 lg:grid-cols-[220px_1fr]">
              <div className="border-r border-timber-100 py-8 pr-8">
                <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-timber-400">
                  Department
                </p>
                <h3 className="mt-3 font-display text-3xl font-medium tracking-tight text-timber-900">
                  {openDept?.label}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-timber-500">
                  Essentials cut for everyday presence.
                </p>
                <Link
                  to={`/shop?audience=${openMenu}`}
                  className="mt-6 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-timber-900 underline decoration-timber-300 underline-offset-8 transition hover:decoration-timber-900"
                >
                  Shop all {openDept?.label}
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
                </Link>
              </div>
              <div className="py-8 pl-8">
                <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.28em] text-timber-400">
                  Categories
                </p>
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 sm:grid-cols-3">
                  {byAudience[openMenu]?.length ? (
                    byAudience[openMenu].map((c) => (
                      <Link
                        key={c.id}
                        to={`/shop?audience=${openMenu}&category=${c.slug}`}
                        className="group flex items-center justify-between border-b border-transparent py-2.5 text-sm text-timber-600 transition hover:border-timber-200 hover:text-timber-900"
                      >
                        <span>{c.name}</span>
                        <ArrowRight
                          className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100"
                          strokeWidth={1.5}
                        />
                      </Link>
                    ))
                  ) : (
                    <p className="col-span-full py-2 text-sm text-timber-400">
                      Browse the full {openDept?.label?.toLowerCase()} collection.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
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
                className="grid h-10 w-10 place-items-center text-timber-700 hover:bg-timber-50"
                aria-label="Close menu"
              >
                <X size={22} strokeWidth={1.5} />
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto px-5 py-6">
              {AUDIENCES.map((dept) => (
                <div key={dept.value} className="border-b border-timber-100">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between py-4 text-[12px] font-semibold uppercase tracking-[0.24em] text-timber-900"
                    onClick={() => setMobileDept((v) => (v === dept.value ? null : dept.value))}
                  >
                    {dept.label}
                    <ChevronDown
                      className={`h-4 w-4 text-timber-400 transition ${
                        mobileDept === dept.value ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {mobileDept === dept.value && (
                    <div className="space-y-0.5 pb-4">
                      <Link
                        to={`/shop?audience=${dept.value}`}
                        onClick={() => setMobileOpen(false)}
                        className="block bg-timber-50 px-3 py-2.5 text-sm font-medium text-timber-900"
                      >
                        Shop all {dept.label}
                      </Link>
                      {byAudience[dept.value]?.map((c) => (
                        <Link
                          key={c.id}
                          to={`/shop?audience=${dept.value}&category=${c.slug}`}
                          onClick={() => setMobileOpen(false)}
                          className="block px-3 py-2.5 text-sm text-timber-500 hover:bg-timber-50 hover:text-timber-900"
                        >
                          {c.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {[
                { to: '/about', label: 'About' },
                { to: '/contact', label: 'Contact' },
                {
                  to: '/wishlist',
                  label: `Wishlist${wishCount > 0 ? ` (${wishCount})` : ''}`,
                },
                { to: '/cart', label: `Cart${count > 0 ? ` (${count})` : ''}` },
              ].map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className="block border-b border-timber-100 py-4 text-[12px] font-semibold uppercase tracking-[0.24em] text-timber-900"
                >
                  {item.label}
                </Link>
              ))}
              {user ? (
                <>
                  <Link
                    to="/account"
                    onClick={() => setMobileOpen(false)}
                    className="block border-b border-timber-100 py-4 text-[12px] font-semibold uppercase tracking-[0.24em] text-timber-900"
                  >
                    Account
                  </Link>
                  {isStaff(user) && (
                    <Link
                      to="/staff"
                      onClick={() => setMobileOpen(false)}
                      className="block border-b border-timber-100 py-4 text-[12px] font-semibold uppercase tracking-[0.24em] text-timber-900"
                    >
                      Staff
                    </Link>
                  )}
                  <button
                    type="button"
                    className="block w-full border-b border-timber-100 py-4 text-start text-[12px] font-semibold uppercase tracking-[0.24em] text-timber-500"
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
                  className="block border-b border-timber-100 py-4 text-[12px] font-semibold uppercase tracking-[0.24em] text-timber-900"
                >
                  Sign in
                </Link>
              )}
            </nav>
            <div className="border-t border-timber-100 p-5">
              <Link
                to="/shop"
                onClick={() => setMobileOpen(false)}
                className="btn-wheat block w-full py-3.5 text-center"
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
