import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  Heart,
  LogOut,
  Menu,
  Package,
  Search,
  ShoppingBag,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useCategories, subcategoriesForAudience } from '../../context/CategoriesContext';
import { isStaff } from '../../utils/permissions';
import {
  AUDIENCES,
  DEPT_IMAGES,
  FREE_SHIPPING_MIN,
  formatMoney,
  getImageUrl,
} from '../../utils/helpers';
import BrandLogo from '../BrandLogo';
import { useMarketingConfig } from '../../utils/marketingConfig';

const DEPT_COPY = {
  men: 'Underwear, undershirts and the everyday essentials.',
  women: 'Pieces cut for ease, presence and all-day wear.',
  kids: 'Soft staples sized for growing days.',
};

const DEFAULT_ANNOUNCEMENTS = [
  { text: `Free shipping on orders over ${formatMoney(FREE_SHIPPING_MIN)}`, link: '/shop' },
  { text: 'Cash on delivery across Egypt', link: '/shop' },
  { text: 'Pay by card or wallet — secured by Paymob', link: '/shop' },
  { text: '14-day easy returns on unworn pieces', link: '/returns' },
];

const QUICK_LINKS = [
  { to: '/account', label: 'Order status', icon: Package },
  { to: '/wishlist', label: 'Your saves', icon: Heart },
  { to: '/returns', label: 'Returns & exchanges', icon: ArrowUpRight },
  { to: '/contact', label: 'Shopping help', icon: ArrowUpRight },
];

function AnnouncementBar() {
  const config = useMarketingConfig();
  const configured = config?.campaigns?.announcements;
  const list = Array.isArray(configured) ? configured.filter((a) => a?.text) : DEFAULT_ANNOUNCEMENTS;
  const [i, setI] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || list.length < 2) return undefined;
    const t = setInterval(() => setI((n) => n + 1), 4200);
    return () => clearInterval(t);
  }, [list.length]);
  if (!list.length) return null;
  const current = list[i % list.length];
  const link = current.link || '/shop';
  const className =
    'ff-fade absolute inset-0 flex items-center justify-center px-4 text-center text-[10.5px] font-semibold uppercase tracking-[0.26em] text-bone/90 hover:text-white';
  return (
    <div className="relative h-9 overflow-hidden bg-timber-900 text-bone">
      {/^https?:\/\//i.test(link) ? (
        <a key={i} href={link} target="_blank" rel="noopener noreferrer" className={className}>
          {current.text}
        </a>
      ) : (
        <Link key={i} to={link} className={className}>
          {current.text}
        </Link>
      )}
    </div>
  );
}

export default function StoreHeader() {
  const { user, logout } = useAuth();
  const { count, openDrawer } = useCart();
  const { count: wishCount } = useWishlist();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const { tree, treeByAudience } = useCategories();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState(null);
  const [mobileDept, setMobileDept] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef(null);
  const closeTimer = useRef(null);

  const overHero = pathname === '/';
  const transparent = overHero && !scrolled && !openMenu && !searchOpen;
  const params = new URLSearchParams(search);
  const activeAudience = pathname === '/shop' ? params.get('audience') : null;

  const deptRoot = (aud) =>
    tree?.find((d) => (d.audience || d.slug) === aud && !d.parentId) ||
    treeByAudience?.[aud]?.[0] ||
    null;
  const deptImage = (aud) => deptRoot(aud)?.imageUrl || DEPT_IMAGES[aud] || null;
  const openSubs = subcategoriesForAudience(treeByAudience, openMenu);
  const openDept = AUDIENCES.find((a) => a.value === openMenu);
  const searchSuggestions = subcategoriesForAudience(treeByAudience, null).slice(0, 6);

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
    setSearchOpen(false);
    setAccountOpen(false);
  }, [pathname, search]);

  useEffect(() => {
    if (!searchOpen) return undefined;
    const t = requestAnimationFrame(() => searchInputRef.current?.focus());
    const onKey = (e) => e.key === 'Escape' && setSearchOpen(false);
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [searchOpen]);

  const submitSearch = (e) => {
    e?.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setSearchOpen(false);
    setSearchQuery('');
    navigate(`/shop?q=${encodeURIComponent(q)}`);
  };

  const enterMenu = (value) => {
    clearTimeout(closeTimer.current);
    setOpenMenu(value);
    setSearchOpen(false);
  };
  const leaveMenu = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenMenu(null), 120);
  };

  const iconBtn = `ff-icon-btn ${transparent ? 'text-white hover:bg-white/15' : 'text-timber-800 hover:bg-timber-100'}`;
  const navLink = (active) =>
    `nav-link-accent h-full py-2 ${
      transparent
        ? 'text-white/90 hover:text-white'
        : active
          ? 'text-timber-900'
          : 'text-timber-600 hover:text-timber-900'
    }`;
  const badge =
    'absolute -end-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-clay px-1 text-[10px] font-bold text-white';

  return (
    <>
      <header
        className={`${overHero ? 'fixed' : 'sticky'} inset-x-0 top-0 z-50 transition-[background-color,box-shadow] duration-500 ease-ff ${
          transparent ? 'bg-transparent' : 'ff-glass shadow-[0_1px_0_rgba(9,9,11,0.08)]'
        }`}
        onMouseLeave={leaveMenu}
      >
        <AnnouncementBar />

        <div className="ff-container relative grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-4 sm:h-[76px]">
          {/* Left — desktop nav / mobile menu + search */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              className={`${iconBtn} -ms-2 lg:hidden`}
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={21} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              aria-label="Search"
              onClick={() => {
                setSearchOpen((v) => !v);
                setOpenMenu(null);
              }}
              className={`${iconBtn} lg:hidden`}
            >
              <Search className="h-[19px] w-[19px]" strokeWidth={1.5} />
            </button>
            <nav className="hidden h-full items-center gap-8 lg:flex xl:gap-10">
              {AUDIENCES.map((dept) => (
                <div
                  key={dept.value}
                  className="flex h-full items-center"
                  onMouseEnter={() => enterMenu(dept.value)}
                >
                  <Link
                    to={`/shop?audience=${dept.value}`}
                    data-active={activeAudience === dept.value || openMenu === dept.value ? 'true' : 'false'}
                    className={navLink(activeAudience === dept.value)}
                    onFocus={() => enterMenu(dept.value)}
                  >
                    {dept.label}
                  </Link>
                </div>
              ))}
              <Link
                to="/shop"
                onMouseEnter={leaveMenu}
                data-active={pathname === '/shop' && !activeAudience ? 'true' : 'false'}
                className={navLink(pathname === '/shop' && !activeAudience)}
              >
                Shop all
              </Link>
            </nav>
          </div>

          {/* Center — logo */}
          <div className="flex justify-center" onMouseEnter={leaveMenu}>
            <BrandLogo size="header" invert={transparent} className="!h-12 sm:!h-[3.6rem]" />
          </div>

          {/* Right — utilities */}
          <div className="flex items-center justify-end gap-0.5 sm:gap-1" onMouseEnter={leaveMenu}>
            <button
              type="button"
              aria-label="Search"
              aria-expanded={searchOpen}
              onClick={() => {
                setSearchOpen((v) => !v);
                setOpenMenu(null);
              }}
              className={`${iconBtn} hidden lg:grid`}
            >
              <Search className="h-[19px] w-[19px]" strokeWidth={1.5} />
            </button>

            <div
              className="relative hidden sm:block"
              onMouseEnter={() => user && setAccountOpen(true)}
              onMouseLeave={() => setAccountOpen(false)}
            >
              <Link
                to={user ? '/account' : '/login'}
                aria-label={user ? 'Account' : 'Sign in'}
                className={iconBtn}
              >
                <User className="h-[19px] w-[19px]" strokeWidth={1.5} />
              </Link>
              {user && accountOpen && (
                <div className="absolute end-0 top-full z-10 pt-2">
                  <div className="mega-dropdown w-60 overflow-hidden rounded-2xl border border-timber-200/70 bg-white p-2 text-sm text-timber-700">
                    <p className="px-3 pb-2 pt-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-timber-400">
                      Hi, {(user.name || 'there').split(' ')[0]}
                    </p>
                    <Link to="/account" className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-timber-50">
                      <Package size={16} strokeWidth={1.5} /> Orders &amp; account
                    </Link>
                    <Link to="/wishlist" className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-timber-50">
                      <Heart size={16} strokeWidth={1.5} /> Your saves
                    </Link>
                    {isStaff(user) && (
                      <Link to="/staff" className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-timber-50">
                        <ArrowUpRight size={16} strokeWidth={1.5} /> Staff dashboard
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={logout}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-timber-500 hover:bg-timber-50 hover:text-timber-900"
                    >
                      <LogOut size={16} strokeWidth={1.5} /> Log out
                    </button>
                  </div>
                </div>
              )}
            </div>

            <Link to="/wishlist" aria-label="Wishlist" className={`${iconBtn} hidden sm:grid`}>
              <Heart className="h-[19px] w-[19px]" strokeWidth={1.5} />
              {wishCount > 0 && <span className={badge}>{wishCount}</span>}
            </Link>
            <button type="button" aria-label="Open bag" onClick={openDrawer} className={`${iconBtn} -me-2 sm:me-0`}>
              <ShoppingBag className="h-[19px] w-[19px]" strokeWidth={1.5} />
              {count > 0 && <span className={badge}>{count}</span>}
            </button>
          </div>
        </div>

        {/* Search panel */}
        {searchOpen && (
          <div className="mega-dropdown border-t border-timber-200/60 bg-bone">
            <div className="ff-container py-6 sm:py-8">
              <form onSubmit={submitSearch} className="flex items-center gap-3 border-b border-timber-900/80 pb-3">
                <Search className="h-5 w-5 shrink-0 text-timber-500" strokeWidth={1.5} />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search FutureFit"
                  className="min-w-0 flex-1 border-0 bg-transparent py-2 font-display text-2xl text-timber-900 outline-none placeholder:text-timber-300 sm:text-3xl"
                  aria-label="Search products"
                />
                <button
                  type="button"
                  onClick={() => {
                    setSearchOpen(false);
                    setSearchQuery('');
                  }}
                  className="ff-icon-btn text-timber-600 hover:bg-timber-100"
                  aria-label="Close search"
                >
                  <X className="h-5 w-5" strokeWidth={1.5} />
                </button>
              </form>
              <div className="mt-6 grid gap-8 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-timber-400">
                    Popular
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(searchSuggestions.length
                      ? searchSuggestions.map((c) => ({ key: c.id, label: c.name, to: `/shop?category=${c.slug}` }))
                      : AUDIENCES.map((a) => ({ key: a.value, label: a.label, to: `/shop?audience=${a.value}` }))
                    ).map((s) => (
                      <Link key={s.key} to={s.to} className="ff-chip">
                        {s.label}
                      </Link>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-timber-400">
                    Quick links
                  </p>
                  <ul className="mt-2">
                    {QUICK_LINKS.map((q) => (
                      <li key={q.to}>
                        <Link
                          to={q.to}
                          className="group flex items-center gap-3 py-2 text-sm text-timber-700 hover:text-timber-900"
                        >
                          <ArrowRight className="h-3.5 w-3.5 text-timber-400 transition group-hover:translate-x-0.5 group-hover:text-clay" strokeWidth={1.75} />
                          {q.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Desktop mega menu */}
        {openMenu && (
          <div
            className="mega-dropdown hidden border-t border-timber-200/60 bg-bone lg:block"
            onMouseEnter={() => clearTimeout(closeTimer.current)}
          >
            <div className="ff-container grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.5fr)] gap-10 py-10">
              <div>
                <p className="ff-eyebrow">Department</p>
                <h3 className="mt-4 font-display text-5xl font-light tracking-tight text-timber-900">
                  {openDept?.label}
                </h3>
                <p className="mt-3 max-w-xs text-sm leading-relaxed text-timber-500">
                  {deptRoot(openMenu)?.statement || DEPT_COPY[openMenu]}
                </p>
                <Link to={`/shop?audience=${openMenu}`} className="btn-wheat btn-sm mt-7">
                  Shop all {openDept?.label}
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
                </Link>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-timber-400">
                  Categories
                </p>
                <ul className="mt-3 grid grid-cols-1 gap-x-8 xl:grid-cols-2">
                  {openSubs.length ? (
                    openSubs.map((c) => (
                      <li key={c.id}>
                        <Link
                          to={`/shop?audience=${openMenu}&category=${c.slug}`}
                          className="group flex items-center justify-between border-b border-timber-200/60 py-3 text-[15px] text-timber-700 transition hover:text-timber-900"
                        >
                          {c.name}
                          <ArrowRight
                            className="h-3.5 w-3.5 -translate-x-1 text-clay opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100"
                            strokeWidth={1.75}
                          />
                        </Link>
                      </li>
                    ))
                  ) : (
                    <li className="py-3 text-sm text-timber-500">
                      Browse the full {openDept?.label?.toLowerCase()} collection.
                    </li>
                  )}
                </ul>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Link
                  to={`/shop?audience=${openMenu}`}
                  className="group relative block aspect-[4/5] overflow-hidden rounded-2xl bg-timber-200"
                >
                  {deptImage(openMenu) ? (
                    <img
                      src={getImageUrl(deptImage(openMenu), { width: 520, aspect: '4:5' })}
                      alt=""
                      loading="lazy"
                      className="ff-img-zoom absolute inset-0 h-full w-full object-cover"
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                  <span className="absolute inset-x-4 bottom-4 flex items-center justify-between text-sm font-semibold text-white">
                    Best sellers
                    <ArrowUpRight className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                </Link>
                <Link
                  to={`/shop?audience=${openMenu}&sort=newest`}
                  className="ff-grain group flex aspect-[4/5] flex-col justify-between overflow-hidden rounded-2xl bg-blush/70 p-5"
                >
                  <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-clay">
                    Just landed
                  </span>
                  <span>
                    <span className="block font-display text-3xl font-light leading-tight text-timber-900">
                      New <em className="italic text-clay">arrivals</em>
                    </span>
                    <span className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-timber-800">
                      Shop new
                      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" strokeWidth={1.75} />
                    </span>
                  </span>
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Mobile sheet */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            type="button"
            className="ff-fade absolute inset-0 bg-timber-950/50 backdrop-blur-[2px]"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <div className="ff-sheet-in absolute inset-y-0 end-0 flex w-full max-w-[420px] flex-col bg-bone">
            <div className="flex h-16 items-center justify-between border-b border-timber-200/70 px-5">
              <BrandLogo size="md" to="/" className="!h-10" />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="ff-icon-btn text-timber-800 hover:bg-timber-100"
                aria-label="Close menu"
              >
                <X size={22} strokeWidth={1.5} />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-5 pb-8 pt-4">
              {AUDIENCES.map((dept) => {
                const open = mobileDept === dept.value;
                const img = deptImage(dept.value);
                return (
                  <div key={dept.value} className="border-b border-timber-200/70">
                    <button
                      type="button"
                      className="flex w-full items-center gap-4 py-4 text-start"
                      onClick={() => setMobileDept((v) => (v === dept.value ? null : dept.value))}
                      aria-expanded={open}
                    >
                      {img ? (
                        <img
                          src={getImageUrl(img, { width: 120, aspect: '1:1' })}
                          alt=""
                          className="h-12 w-12 shrink-0 rounded-full object-cover"
                        />
                      ) : null}
                      <span className="flex-1 font-display text-[1.75rem] font-light leading-none text-timber-900">
                        {dept.label}
                      </span>
                      <ChevronDown
                        className={`h-5 w-5 text-timber-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
                        strokeWidth={1.5}
                      />
                    </button>
                    {open && (
                      <div className="ff-fade grid grid-cols-2 gap-2 pb-5">
                        <Link
                          to={`/shop?audience=${dept.value}`}
                          className="col-span-2 flex items-center justify-between rounded-xl bg-timber-900 px-4 py-3 text-sm font-semibold text-white"
                        >
                          Shop all {dept.label}
                          <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
                        </Link>
                        {subcategoriesForAudience(treeByAudience, dept.value).map((c) => (
                          <Link
                            key={c.id}
                            to={`/shop?audience=${dept.value}&category=${c.slug}`}
                            className="rounded-xl border border-timber-200 bg-white px-4 py-3 text-sm text-timber-700"
                          >
                            {c.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              <Link
                to="/shop"
                className="flex items-center justify-between border-b border-timber-200/70 py-5 font-display text-[1.75rem] font-light leading-none text-timber-900"
              >
                Shop all
                <ArrowRight className="h-5 w-5 text-timber-400" strokeWidth={1.5} />
              </Link>

              <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.22em] text-timber-400">
                Quick links
              </p>
              <ul className="mt-2 divide-y divide-timber-200/70">
                {[
                  ...QUICK_LINKS,
                  { to: '/about', label: 'Our story' },
                  ...(user && isStaff(user) ? [{ to: '/staff', label: 'Staff dashboard' }] : []),
                ].map((q) => (
                  <li key={q.to}>
                    <Link to={q.to} className="flex items-center justify-between py-3.5 text-[15px] text-timber-700">
                      {q.label}
                      {q.to === '/wishlist' && wishCount > 0 ? (
                        <span className="rounded-full bg-timber-100 px-2 py-0.5 text-xs">{wishCount}</span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="space-y-2 border-t border-timber-200/70 p-5">
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  openDrawer();
                }}
                className="btn-wheat w-full"
              >
                <ShoppingBag className="h-4 w-4" strokeWidth={1.5} />
                View bag{count > 0 ? ` (${count})` : ''}
              </button>
              {user ? (
                <div className="flex gap-2">
                  <Link to="/account" className="btn-outline flex-1">
                    Account
                  </Link>
                  <button
                    type="button"
                    className="btn-outline flex-1"
                    onClick={() => {
                      logout();
                      setMobileOpen(false);
                    }}
                  >
                    Log out
                  </button>
                </div>
              ) : (
                <Link to="/login" className="btn-outline w-full">
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
