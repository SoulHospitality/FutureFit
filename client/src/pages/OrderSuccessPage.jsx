import { Link, useLocation, Navigate } from 'react-router-dom';
import {
  formatMoney,
  INSTAPAY_HANDLE,
  VODAFONE_CASH_NUMBER,
} from '../utils/helpers';

function SuccessMark() {
  return (
    <div className="success-mark relative mx-auto grid h-28 w-28 place-items-center sm:h-32 sm:w-32">
      <span className="absolute inset-0 rounded-full bg-timber-900/10" aria-hidden />
      <span className="absolute inset-3 rounded-full bg-timber-900/10" aria-hidden />
      <svg
        viewBox="0 0 96 96"
        className="relative h-20 w-20 sm:h-24 sm:w-24 drop-shadow-sm"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Order successful"
      >
        <circle cx="48" cy="48" r="44" fill="#18181b" />
        <circle cx="48" cy="48" r="44" fill="url(#ffGlow)" fillOpacity="0.4" />
        <circle cx="34" cy="40" r="5" fill="#ffffff" />
        <circle cx="62" cy="40" r="5" fill="#ffffff" />
        <path
          d="M30 55c5 10 13.5 15 18 15s13-5 18-15"
          stroke="#ffffff"
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
        />
        <defs>
          <radialGradient id="ffGlow" cx="32%" cy="28%" r="70%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#18181b" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>
      <span className="success-mark__badge absolute -bottom-1 -end-1 grid h-10 w-10 place-items-center rounded-full bg-timber-900 shadow-md sm:h-11 sm:w-11">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
          <path
            d="M5 12.5l4.5 4.5L19 7.5"
            stroke="#ffffff"
            strokeWidth="2.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="success-mark__check"
          />
        </svg>
      </span>
    </div>
  );
}

export default function OrderSuccessPage() {
  const { state } = useLocation();
  const order = state?.order;

  if (!order) return <Navigate to="/" replace />;

  const name = order.customerName || order.guestName;
  const method = order.paymentMethod;
  const isInstaPay = method === 'InstaPay';
  const isVodafone = method === 'Vodafone Cash';
  const isWallet = isInstaPay || isVodafone;

  return (
    <div className="relative min-h-[70vh] overflow-hidden bg-white">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background: `
            radial-gradient(ellipse 70% 50% at 50% 0%, rgba(24, 24, 27, 0.06), transparent 60%),
            radial-gradient(ellipse 40% 30% at 10% 80%, rgba(9, 9, 11, 0.04), transparent 50%)
          `,
        }}
      />

      <div className="relative z-10 mx-auto max-w-lg px-4 py-14 text-center sm:py-20">
        <SuccessMark />

        <p className="success-fade mt-6 text-[11px] font-medium uppercase tracking-[0.28em] text-timber-500">
          You’re all set
        </p>
        <h1 className="success-fade success-fade--delay font-display mt-2 text-5xl font-medium tracking-tight text-timber-900 sm:text-6xl">
          Thank you{name ? `, ${name.split(' ')[0]}` : ''}
        </h1>
        <p className="success-fade success-fade--delay2 mx-auto mt-4 max-w-md text-base leading-relaxed text-timber-600 sm:text-lg">
          Your order is in. We’ll contact you within{' '}
          <span className="font-semibold text-timber-800">12 hours</span> to confirm it.
        </p>

        <div className="success-fade success-fade--delay2 card mt-8 space-y-3 text-left text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-timber-500">Order</span>
            <span className="font-mono font-medium text-timber-800">
              {order.id.slice(0, 8).toUpperCase()}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-timber-500">Payment</span>
            <span className="text-timber-800">{order.paymentMethod}</span>
          </div>
          <div className="flex justify-between gap-4 border-t border-timber-100 pt-3 text-base font-semibold text-timber-900">
            <span>Total</span>
            <span>{formatMoney(order.totalPrice)}</span>
          </div>
        </div>

        {isInstaPay && (
          <div className="card mt-4 space-y-2 text-left text-sm">
            <p className="font-semibold text-timber-800">InstaPay transfer</p>
            {INSTAPAY_HANDLE ? (
              <p className="text-timber-600">
                Send <span className="font-semibold">{formatMoney(order.totalPrice)}</span> to{' '}
                <span className="font-semibold text-timber-900">{INSTAPAY_HANDLE}</span>.
              </p>
            ) : (
              <p className="text-timber-600">
                We’ll share our InstaPay details when we call. Use your order number as the note.
              </p>
            )}
          </div>
        )}

        {isVodafone && (
          <div className="card mt-4 space-y-2 text-left text-sm">
            <p className="font-semibold text-timber-800">Vodafone Cash transfer</p>
            {VODAFONE_CASH_NUMBER ? (
              <p className="text-timber-600">
                Send <span className="font-semibold">{formatMoney(order.totalPrice)}</span> to{' '}
                <span className="font-semibold text-timber-900">{VODAFONE_CASH_NUMBER}</span>.
              </p>
            ) : (
              <p className="text-timber-600">
                We’ll share our Vodafone Cash number when we call. Use your name as the note.
              </p>
            )}
          </div>
        )}

        <p className="mt-6 text-sm text-timber-500">
          {isWallet
            ? 'Delivery usually takes 2–3 business days after payment is confirmed.'
            : 'Delivery usually takes 2–3 business days · Cash on delivery.'}
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/shop" className="btn-wheat min-h-12 px-6 py-3">
            Continue shopping
          </Link>
          <Link to="/" className="btn-outline min-h-12 px-6 py-3">
            Home
          </Link>
        </div>
      </div>

      <style>{`
        .success-mark {
          animation: success-pop 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .success-mark__check {
          stroke-dasharray: 28;
          stroke-dashoffset: 28;
          animation: success-draw 0.4s ease 0.5s forwards;
        }
        .success-mark__badge {
          animation: success-pop 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.35s both;
        }
        .success-fade {
          opacity: 0;
          transform: translateY(10px);
          animation: success-up 0.55s ease forwards;
        }
        .success-fade--delay { animation-delay: 0.12s; }
        .success-fade--delay2 { animation-delay: 0.22s; }

        @keyframes success-pop {
          from { opacity: 0; transform: scale(0.7); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes success-draw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes success-up {
          to { opacity: 1; transform: translateY(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .success-mark,
          .success-mark__check,
          .success-fade {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
            stroke-dashoffset: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
