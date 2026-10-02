import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { ArrowRight, Banknote, CreditCard, RefreshCw, Truck } from 'lucide-react';
import BrandLogo from '../BrandLogo';
import {
  AUDIENCES,
  FREE_SHIPPING_MIN,
  formatMoney,
  STORE_EMAIL,
  STORE_PHONE_DISPLAY,
  STORE_WHATSAPP_URL,
} from '../../utils/helpers';
import api from '../../api/axios';

const FACEBOOK = 'https://www.facebook.com/FutureFit.eg';

const PROMISES = [
  { icon: Truck, label: `Free shipping over ${formatMoney(FREE_SHIPPING_MIN)}` },
  { icon: Banknote, label: 'Cash on delivery' },
  { icon: CreditCard, label: 'Card & wallet via Paymob' },
  { icon: RefreshCw, label: '14-day returns' },
];

function FooterColumn({ title, children }) {
  return (
    <div>
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.24em] text-bone/50">{title}</h4>
      <ul className="mt-5 space-y-3 text-[15px]">{children}</ul>
    </div>
  );
}

function FooterLink({ to, href, children }) {
  const cls = 'text-bone/80 transition hover:text-white';
  return (
    <li>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className={cls}>
          {children}
        </a>
      ) : (
        <Link to={to} className={cls}>
          {children}
        </Link>
      )}
    </li>
  );
}

export default function StoreFooter() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  const subscribe = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      await api.post('/newsletter', { email, source: 'footer' });
      toast.success('You’re on the list — thanks for signing up');
      setEmail('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save email');
    } finally {
      setSending(false);
    }
  };

  return (
    <footer className="mt-auto overflow-hidden bg-timber-950 text-bone">
      <div className="border-b border-white/10">
        <ul className="ff-container grid grid-cols-2 gap-x-6 gap-y-4 py-6 lg:grid-cols-4">
          {PROMISES.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.label} className="flex items-center gap-3 text-[13px] text-bone/75">
                <Icon className="h-4 w-4 shrink-0 text-nude" strokeWidth={1.5} />
                {item.label}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="ff-container grid gap-14 py-16 lg:grid-cols-[1.2fr_2fr] lg:gap-20 lg:py-20">
        <div>
          <BrandLogo to="/" size="md" invert className="opacity-95" />
          <p className="mt-6 max-w-sm font-display text-[1.7rem] font-light leading-snug text-bone">
            Setting trends with <em className="italic text-nude">every stitch.</em>
          </p>
          <form onSubmit={subscribe} className="mt-8 max-w-sm">
            <label htmlFor="footer-email" className="text-[13px] text-bone/60">
              New drops and restocks, first.
            </label>
            <div className="mt-3 flex items-center rounded-full border border-white/20 bg-white/5 p-1 focus-within:border-white/50">
              <input
                id="footer-email"
                type="email"
                required
                className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-[15px] text-white outline-none placeholder:text-white/35"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button
                type="submit"
                disabled={sending}
                aria-label="Subscribe"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-bone text-timber-900 transition hover:bg-blush disabled:opacity-50"
              >
                <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>
          </form>
        </div>

        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
          <FooterColumn title="Shop">
            {AUDIENCES.map((a) => (
              <FooterLink key={a.value} to={`/shop?audience=${a.value}`}>
                {a.label}
              </FooterLink>
            ))}
            <FooterLink to="/shop?sort=newest">New arrivals</FooterLink>
            <FooterLink to="/shop">Shop all</FooterLink>
          </FooterColumn>
          <FooterColumn title="Help">
            <FooterLink to="/account">Order status</FooterLink>
            <FooterLink to="/returns">Returns &amp; exchanges</FooterLink>
            <FooterLink to="/contact">Contact us</FooterLink>
            <FooterLink to="/wishlist">Your saves</FooterLink>
          </FooterColumn>
          <FooterColumn title="FutureFit">
            <FooterLink to="/about">Our story</FooterLink>
            {STORE_WHATSAPP_URL ? <FooterLink href={STORE_WHATSAPP_URL}>WhatsApp</FooterLink> : null}
            <FooterLink href={FACEBOOK}>Facebook</FooterLink>
            {STORE_EMAIL ? (
              <li>
                <a href={`mailto:${STORE_EMAIL}`} className="break-all text-bone/80 transition hover:text-white">
                  {STORE_EMAIL}
                </a>
              </li>
            ) : null}
            {STORE_PHONE_DISPLAY ? <li className="text-bone/60">{STORE_PHONE_DISPLAY}</li> : null}
          </FooterColumn>
        </div>
      </div>

      <div className="ff-container relative">
        <p
          className="pointer-events-none select-none whitespace-nowrap text-center font-display text-[clamp(4.5rem,19vw,17rem)] font-light leading-[0.8] tracking-[-0.04em] text-white/[0.06]"
          aria-hidden
        >
          FutureFit
        </p>
      </div>

      <div className="border-t border-white/10">
        <div className="ff-container flex flex-col items-center justify-between gap-4 py-6 text-[12px] text-bone/50 sm:flex-row">
          <p>© {new Date().getFullYear()} FutureFit. All rights reserved.</p>
          <div className="flex items-center gap-5">
            <Link to="/privacy" className="hover:text-white">Privacy</Link>
            <Link to="/terms" className="hover:text-white">Terms</Link>
            <Link to="/returns" className="hover:text-white">Returns</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
