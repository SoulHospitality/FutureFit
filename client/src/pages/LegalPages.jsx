import { Link } from 'react-router-dom';

function Legal({ title, children }) {
  return (
    <div className="bg-white">
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
        <p className="text-[10px] font-medium uppercase tracking-[0.32em] text-timber-400">
          FutureFit
        </p>
        <h1 className="mt-3 font-display text-5xl font-medium tracking-tight text-timber-900">
          {title}
        </h1>
        <div className="mt-8 space-y-4 border-t border-timber-100 pt-8 text-base leading-relaxed text-timber-600">
          {children}
        </div>
        <Link
          to="/"
          className="btn-outline btn-sm mt-10 inline-flex text-[10px] uppercase tracking-[0.2em]"
        >
          Back home
        </Link>
      </div>
    </div>
  );
}

export function PrivacyPage() {
  return (
    <Legal title="Privacy">
      <p>
        We collect your name, email, phone, and address to fulfill orders. We do not sell your data.
      </p>
    </Legal>
  );
}

export function TermsPage() {
  return (
    <Legal title="Terms">
      <p>
        By shopping at FutureFit you agree to our checkout terms, product availability, and delivery
        timelines.
      </p>
    </Legal>
  );
}

export function ReturnsPage() {
  return (
    <Legal title="Returns">
      <p>
        Unworn items may be returned within 14 days. Contact Ops via your order if there is a
        delivery issue.
      </p>
    </Legal>
  );
}
