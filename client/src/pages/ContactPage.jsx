import { Link } from 'react-router-dom';
import { Mail, MessageCircle, Phone, Truck } from 'lucide-react';
import {
  FREE_SHIPPING_MIN,
  formatMoney,
  STORE_EMAIL,
  STORE_PHONE_DISPLAY,
  STORE_PHONE_TEL,
  STORE_WHATSAPP_URL,
} from '../utils/helpers';
import { usePageMeta } from '../utils/seo';
import { useSiteCopy } from '../utils/websiteContent';

const DEFAULT_FACEBOOK = 'https://www.facebook.com/FutureFit.eg';

export default function ContactPage() {
  const copy = useSiteCopy();
  const c = copy.contacts || {};

  const email = c.email || STORE_EMAIL;
  const phoneDisplay = c.phoneDisplay || STORE_PHONE_DISPLAY;
  const digits = String(c.phoneDigits || '').replace(/\D/g, '');
  const whatsappUrl =
    c.whatsappUrl ||
    (digits ? `https://wa.me/${digits}` : '') ||
    STORE_WHATSAPP_URL;
  const phoneTel = digits ? `tel:+${digits}` : STORE_PHONE_TEL;
  const facebookUrl = c.facebookUrl || DEFAULT_FACEBOOK;
  const facebookHandle = c.facebookHandle || '@FutureFit.eg';

  usePageMeta({
    title: 'Contact us',
    description: `Questions about sizing, orders or delivery? Reach FutureFit on WhatsApp, phone or email — ${phoneDisplay}.`,
  });

  return (
    <div className="bg-bone">
      <section className="mx-auto max-w-3xl px-5 py-14 sm:px-8 sm:py-20">
        <p className="brand-eyebrow">{c.eyebrow || 'Contact'}</p>
        <h1 className="mt-3 font-display text-5xl font-medium tracking-tight text-timber-900 sm:text-6xl">
          {c.title || 'Let’s talk'}
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-timber-500 sm:text-lg">
          {c.body ||
            'Questions about sizing, delivery, or an order? Reach out — we confirm every order within 12 hours.'}
        </p>

        <div className="mt-10 space-y-3">
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-14 items-center gap-4 rounded-2xl border border-timber-200 bg-white px-5 py-4 transition hover:border-timber-900"
            >
              <MessageCircle className="h-5 w-5 shrink-0 text-timber-800" strokeWidth={1.5} />
              <span>
                <span className="block text-sm font-medium text-timber-800">WhatsApp</span>
                <span className="text-sm text-timber-500">{phoneDisplay}</span>
              </span>
            </a>
          )}
          {phoneTel && (
            <a
              href={phoneTel}
              className="flex min-h-14 items-center gap-4 rounded-2xl border border-timber-200 bg-white px-5 py-4 transition hover:border-timber-900"
            >
              <Phone className="h-5 w-5 shrink-0 text-timber-800" strokeWidth={1.5} />
              <span>
                <span className="block text-sm font-medium text-timber-800">Call us</span>
                <span className="text-sm text-timber-500">{phoneDisplay}</span>
              </span>
            </a>
          )}
          {email && (
            <a
              href={`mailto:${email}`}
              className="flex min-h-14 items-center gap-4 rounded-2xl border border-timber-200 bg-white px-5 py-4 transition hover:border-timber-900"
            >
              <Mail className="h-5 w-5 shrink-0 text-timber-800" strokeWidth={1.5} />
              <span>
                <span className="block text-sm font-medium text-timber-800">Email</span>
                <span className="text-sm text-timber-500">{email}</span>
              </span>
            </a>
          )}
          <a
            href={facebookUrl}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-14 items-center gap-4 rounded-2xl border border-timber-200 bg-white px-5 py-4 transition hover:border-timber-900"
          >
            <span className="grid h-5 w-5 place-items-center text-[11px] font-bold text-timber-800">
              f
            </span>
            <span>
              <span className="block text-sm font-medium text-timber-800">Facebook</span>
              <span className="text-sm text-timber-500">{facebookHandle}</span>
            </span>
          </a>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="border border-timber-100 bg-timber-50/80 p-5">
            <Truck className="h-5 w-5 text-timber-800" strokeWidth={1.5} />
            <h2 className="mt-3 font-display text-2xl font-medium tracking-tight text-timber-900">
              {c.deliveryTitle || 'Delivery'}
            </h2>
            <p className="mt-2 text-sm text-timber-500">
              {c.deliveryBody ||
                `Orders ship in 2–3 business days after confirmation. Free shipping over ${formatMoney(FREE_SHIPPING_MIN)}.`}
            </p>
          </div>
          <div className="border border-timber-100 bg-timber-50/80 p-5">
            <h2 className="font-display text-2xl font-medium tracking-tight text-timber-900">
              {c.returnsTitle || 'Returns'}
            </h2>
            <p className="mt-2 text-sm text-timber-500">
              {c.returnsBody || 'Unworn items can be returned within 14 days.'}{' '}
              <Link
                to="/returns"
                className="font-medium text-timber-800 underline-offset-2 hover:underline"
              >
                Read the policy
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-10">
          <Link
            to="/shop"
            className="btn-wheat min-h-12 inline-flex px-7 py-3 text-[11px] uppercase tracking-[0.22em]"
          >
            {c.ctaLabel || 'Shop collection'}
          </Link>
        </div>
      </section>
    </div>
  );
}
