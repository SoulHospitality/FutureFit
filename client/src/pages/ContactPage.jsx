import { Link } from 'react-router-dom';
import { MessageCircle, Phone, Truck } from 'lucide-react';

const WHATSAPP = import.meta.env.VITE_WHATSAPP_NUMBER || '';
const PHONE = import.meta.env.VITE_CONTACT_PHONE || '';
const FACEBOOK = 'https://www.facebook.com/FutureFit.eg';

export default function ContactPage() {
  const whatsappHref = WHATSAPP
    ? `https://wa.me/${String(WHATSAPP).replace(/\D/g, '')}`
    : null;
  const phoneHref = PHONE ? `tel:${String(PHONE).replace(/\s+/g, '')}` : null;

  return (
    <div className="bg-white">
      <section className="mx-auto max-w-3xl px-5 py-14 sm:px-8 sm:py-20">
        <p className="brand-eyebrow">Contact</p>
        <h1 className="mt-3 font-display text-5xl font-medium tracking-tight text-timber-900 sm:text-6xl">
          Let’s talk
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-timber-500 sm:text-lg">
          Questions about sizing, delivery, or an order? Reach out — we confirm every order within
          12 hours.
        </p>

        <div className="mt-10 space-y-3">
          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-14 items-center gap-4 border border-timber-200 bg-white px-5 py-4 transition hover:border-timber-900"
            >
              <MessageCircle className="h-5 w-5 shrink-0 text-timber-800" strokeWidth={1.5} />
              <span>
                <span className="block text-sm font-medium text-timber-800">WhatsApp</span>
                <span className="text-sm text-timber-500">{WHATSAPP}</span>
              </span>
            </a>
          )}
          {phoneHref && (
            <a
              href={phoneHref}
              className="flex min-h-14 items-center gap-4 border border-timber-200 bg-white px-5 py-4 transition hover:border-timber-900"
            >
              <Phone className="h-5 w-5 shrink-0 text-timber-800" strokeWidth={1.5} />
              <span>
                <span className="block text-sm font-medium text-timber-800">Call us</span>
                <span className="text-sm text-timber-500">{PHONE}</span>
              </span>
            </a>
          )}
          <a
            href={FACEBOOK}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-14 items-center gap-4 border border-timber-200 bg-white px-5 py-4 transition hover:border-timber-900"
          >
            <span className="grid h-5 w-5 place-items-center text-[11px] font-bold text-timber-800">
              f
            </span>
            <span>
              <span className="block text-sm font-medium text-timber-800">Facebook</span>
              <span className="text-sm text-timber-500">@FutureFit.eg</span>
            </span>
          </a>
          {!whatsappHref && !phoneHref && (
            <div className="border border-timber-200 bg-timber-50 px-5 py-5 text-sm text-timber-600">
              Place an order and we’ll contact you on the phone number you provide at checkout.
            </div>
          )}
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="border border-timber-100 bg-timber-50/80 p-5">
            <Truck className="h-5 w-5 text-timber-800" strokeWidth={1.5} />
            <h2 className="mt-3 font-display text-2xl font-medium tracking-tight text-timber-900">
              Delivery
            </h2>
            <p className="mt-2 text-sm text-timber-500">
              Orders ship in 2–3 business days after confirmation. Free shipping over EGP 2,000.
            </p>
          </div>
          <div className="border border-timber-100 bg-timber-50/80 p-5">
            <h2 className="font-display text-2xl font-medium tracking-tight text-timber-900">
              Returns
            </h2>
            <p className="mt-2 text-sm text-timber-500">
              Unworn items can be returned within 14 days.{' '}
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
            Shop collection
          </Link>
        </div>
      </section>
    </div>
  );
}
