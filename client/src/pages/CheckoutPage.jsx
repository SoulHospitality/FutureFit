import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Truck, ShieldCheck } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import {
  formatMoney,
  getImageUrl,
  calcShipping,
  FREE_SHIPPING_MIN,
  PAYMENT_METHODS,
  EGYPT_GOVERNORATES,
} from '../utils/helpers';
import { getStoreSessionKey } from '../utils/sessionKey';
import { trackInitiateCheckout } from '../utils/metaPixel';

const ADDRESS_FIELDS = [
  { key: 'street', label: 'Street address', span: true },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'Governorate' },
  { key: 'zip', label: 'Postal code' },
  { key: 'country', label: 'Country' },
];

const STEPS = [
  { id: 1, label: 'Contact', path: '/checkout/contact' },
  { id: 2, label: 'Shipping', path: '/checkout/shipping' },
  { id: 3, label: 'Payment', path: '/checkout/payment' },
];

const stepFromPath = (pathname) => {
  if (pathname.includes('/payment')) return 3;
  if (pathname.includes('/shipping')) return 2;
  return 1;
};

const FORM_KEY = 'ff_checkout_form';

const allowedPayment = (method) =>
  PAYMENT_METHODS.some((m) => m.value === method) ? method : 'Cash on Delivery';

const loadSavedForm = (user) => {
  const addr = user?.address || {};
  const base = {
    name: user?.name || '',
    phone: user?.phone || '',
    email: user?.email || '',
    street: addr.street || '',
    city: addr.city || '',
    state: addr.state || '',
    zip: addr.zip || '',
    country: addr.country || 'Egypt',
    paymentMethod: 'Cash on Delivery',
    couponCode: '',
  };
  try {
    const saved = JSON.parse(sessionStorage.getItem(FORM_KEY) || 'null');
    if (saved && typeof saved === 'object') {
      const merged = { ...base, ...saved, email: user?.email || saved.email || '' };
      merged.paymentMethod = allowedPayment(merged.paymentMethod);
      return merged;
    }
  } catch {
    /* ignore */
  }
  return base;
};

export default function CheckoutPage() {
  const { user } = useAuth();
  const { items, subtotal, clear } = useCart();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const orderPlacedRef = useRef(false);
  const step = stepFromPath(pathname);
  const [form, setForm] = useState(() => loadSavedForm(user));
  const [loading, setLoading] = useState(false);
  const shipping = calcShipping(subtotal, form.state);
  const shippingAmount = shipping ?? 0;
  const total = subtotal + shippingAmount;

  useEffect(() => {
    sessionStorage.setItem(FORM_KEY, JSON.stringify(form));
  }, [form]);

  useEffect(() => {
    if (!items.length) return;
    trackInitiateCheckout({ items, value: subtotal });
  }, []); // once per checkout session mount

  // Sync abandoned checkout draft (debounced)
  useEffect(() => {
    if (orderPlacedRef.current) return undefined;
    const stepName = step === 3 ? 'payment' : step === 2 ? 'shipping' : 'contact';
    const t = setTimeout(() => {
      const payload = {
        sessionKey: getStoreSessionKey(),
        guestName: form.name || undefined,
        guestPhone: form.phone || undefined,
        guestEmail: form.email || undefined,
        shippingAddress: {
          street: form.street,
          city: form.city,
          state: form.state,
          zip: form.zip,
          country: form.country,
        },
        cartItems: items.map((i) => ({
          productId: i.productId,
          name: i.name,
          qty: i.qty,
          price: i.price,
          image: i.image,
          color: i.color,
          size: i.size,
        })),
        subtotal,
        lastStep: stepName,
      };
      api.post('/analytics/abandoned', payload).catch(() => {});
      // Enrich Live View with checkout city when known
      if (form.city) {
        api
          .post('/analytics/presence', {
            sessionKey: getStoreSessionKey(),
            path: pathname,
            city: form.city,
            state: form.state,
            country: form.country || 'Egypt',
          })
          .catch(() => {});
      }
    }, 900);
    return () => clearTimeout(t);
  }, [form, items, subtotal, step, pathname]);

  useEffect(() => {
    if (!items.length && !orderPlacedRef.current && !loading) {
      navigate('/cart', { replace: true });
    }
  }, [items.length, navigate, loading]);

  if (pathname === '/checkout' || pathname === '/checkout/') {
    return <Navigate to="/checkout/contact" replace />;
  }

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const validateStep = (s) => {
    if (s === 1) {
      if (!form.name.trim() || !form.phone.trim()) {
        toast.error('Name and phone are required');
        return false;
      }
      return true;
    }
    if (s === 2) {
      if (!form.street.trim() || !form.city.trim() || !form.state.trim() || !form.country.trim()) {
        toast.error('Street, city, governorate, and country are required');
        return false;
      }
      return true;
    }
    return true;
  };

  const goToStep = (target) => {
    if (target === step) return;
    if (target > step) {
      for (let n = step; n < target; n += 1) {
        if (!validateStep(n)) return;
      }
    }
    navigate(STEPS[target - 1].path);
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    if (step < 3) navigate(STEPS[step].path);
  };

  const goBack = () => {
    if (step > 1) navigate(STEPS[step - 2].path);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (step !== 3) {
      goNext();
      return;
    }
    if (!items.length) return toast.error('Cart is empty');
    if (!validateStep(1) || !validateStep(2)) {
      navigate(!form.name.trim() || !form.phone.trim() ? '/checkout/contact' : '/checkout/shipping');
      return;
    }

    const shippingAddress = {
      street: form.street,
      city: form.city,
      state: form.state,
      zip: form.zip,
      country: form.country,
    };

    const orderItems = items.map((i) => ({
      productId: i.productId,
      qty: i.qty,
      color: i.color,
      size: i.size,
    }));

    setLoading(true);
    try {
      let data;
      if (user) {
        ({ data } = await api.post('/orders', {
          orderItems,
          paymentMethod: form.paymentMethod,
          shippingAddress,
          couponCode: form.couponCode || undefined,
        }));
        if (form.phone && form.phone !== user.phone) {
          try {
            await api.put('/auth/profile', { phone: form.phone });
          } catch {
            /* non-blocking */
          }
        }
      } else {
        ({ data } = await api.post('/orders/guest', {
          orderItems,
          paymentMethod: form.paymentMethod,
          shippingAddress,
          couponCode: form.couponCode || undefined,
          guestName: form.name.trim(),
          guestPhone: form.phone.trim(),
          guestEmail: form.email.trim() || undefined,
        }));
      }

      orderPlacedRef.current = true;
      sessionStorage.removeItem(FORM_KEY);
      clear();
      api
        .post('/analytics/abandoned/complete', {
          sessionKey: getStoreSessionKey(),
          orderId: data?.id,
        })
        .catch(() => {});

      if (data?.paymobCheckoutUrl) {
        toast.success('Redirecting to secure payment…');
        window.location.href = data.paymobCheckoutUrl;
        return;
      }

      navigate('/order-success', { state: { order: data }, replace: true });
      toast.success('Order placed');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Checkout failed');
    } finally {
      setLoading(false);
    }
  };

  if (!items.length && !orderPlacedRef.current) return null;

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="mb-8 border-b border-timber-100 pb-6">
          <p className="text-[10px] font-medium uppercase tracking-[0.32em] text-timber-400">
            Secure checkout
          </p>
          <h1 className="mt-2 font-display text-5xl font-medium tracking-tight text-timber-900">
            Checkout
          </h1>
          <nav
            className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 text-[10px] font-semibold uppercase tracking-[0.22em]"
            aria-label="Checkout steps"
          >
            {STEPS.map((s, i) => (
              <span key={s.id} className="inline-flex items-center gap-3">
                {i > 0 && <span className="text-timber-300" aria-hidden>·</span>}
                <button
                  type="button"
                  onClick={() => goToStep(s.id)}
                  className={
                    step === s.id
                      ? 'text-timber-900'
                      : step > s.id
                        ? 'text-timber-600 hover:text-timber-900'
                        : 'text-timber-300'
                  }
                  aria-current={step === s.id ? 'step' : undefined}
                >
                  {s.id} {s.label}
                </button>
              </span>
            ))}
          </nav>
        </div>

        <form onSubmit={submit} className="grid gap-10 lg:grid-cols-5 lg:gap-12">
          <div className="space-y-8 lg:col-span-3">
            {step === 1 && (
              <section className="space-y-4">
                <h2 className="text-[10px] font-medium uppercase tracking-[0.28em] text-timber-700">
                  Contact
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="label">Full name</label>
                    <input required className="input" value={form.name} onChange={set('name')} />
                  </div>
                  <div>
                    <label className="label">Phone</label>
                    <input
                      required
                      type="tel"
                      className="input"
                      value={form.phone}
                      onChange={set('phone')}
                      placeholder="01xxxxxxxxx"
                    />
                  </div>
                  <div>
                    <label className="label">Email {user ? '' : '(optional)'}</label>
                    <input
                      type="email"
                      className="input"
                      value={form.email}
                      onChange={set('email')}
                      disabled={Boolean(user)}
                    />
                  </div>
                </div>
                {!user && (
                  <p className="text-sm text-timber-500">
                    Checking out as guest.{' '}
                    <Link
                      to="/login?redirect=/checkout/contact"
                      className="font-medium text-timber-800 underline-offset-4 hover:underline"
                    >
                      Sign in
                    </Link>{' '}
                    if you already have an account.
                  </p>
                )}
                <div className="flex justify-end pt-2">
                  <button type="button" className="btn-wheat min-h-12 px-8" onClick={goNext}>
                    Continue
                  </button>
                </div>
              </section>
            )}

            {step === 2 && (
              <section className="space-y-4">
                <h2 className="text-[10px] font-medium uppercase tracking-[0.28em] text-timber-700">
                  Shipping address
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {ADDRESS_FIELDS.map(({ key, label, span }) => (
                    <div key={key} className={span ? 'md:col-span-2' : ''}>
                      <label className="label">{label}</label>
                      {key === 'state' ? (
                        <select
                          required
                          className="input"
                          value={form.state}
                          onChange={set('state')}
                        >
                          <option value="">Select governorate</option>
                          {EGYPT_GOVERNORATES.map((g) => (
                            <option key={g} value={g}>
                              {g}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          required={key === 'street' || key === 'city' || key === 'country'}
                          className="input"
                          value={form[key]}
                          onChange={set(key)}
                        />
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap justify-between gap-3 pt-2">
                  <button type="button" className="btn-outline min-h-12 px-6" onClick={goBack}>
                    Back
                  </button>
                  <button type="button" className="btn-wheat min-h-12 px-8" onClick={goNext}>
                    Continue
                  </button>
                </div>
              </section>
            )}

            {step === 3 && (
              <section className="space-y-4">
                <div>
                  <h2 className="mb-4 text-[10px] font-medium uppercase tracking-[0.28em] text-timber-700">
                    Payment
                  </h2>
                  <div className="space-y-2">
                    {PAYMENT_METHODS.map((method) => {
                      const selected = form.paymentMethod === method.value;
                      return (
                        <label
                          key={method.value}
                          className={`flex cursor-pointer items-start gap-3 border px-3.5 py-3.5 transition ${
                            selected
                              ? 'border-timber-900 bg-timber-50'
                              : 'border-timber-200 bg-white hover:border-timber-400'
                          }`}
                        >
                          <input
                            type="radio"
                            name="paymentMethod"
                            className="mt-1 h-4 w-4 border-timber-300 text-timber-900 focus:ring-timber-800"
                            checked={selected}
                            onChange={() => setForm({ ...form, paymentMethod: method.value })}
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-timber-800">
                              {method.label}
                            </span>
                            <span className="mt-0.5 block text-xs text-timber-500">
                              {method.hint}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {form.paymentMethod === 'Paymob' && (
                    <p className="mt-3 border border-timber-100 bg-timber-50 px-3 py-2.5 text-sm text-timber-600">
                      You’ll be redirected to Paymob’s secure checkout to finish card or wallet
                      payment.
                    </p>
                  )}
                </div>
                <div>
                  <label className="label">Promo code</label>
                  <input
                    className="input"
                    value={form.couponCode}
                    onChange={set('couponCode')}
                    placeholder="Optional"
                  />
                </div>
                <div className="flex flex-wrap justify-between gap-3 pt-2">
                  <button type="button" className="btn-outline min-h-12 px-6" onClick={goBack}>
                    Back
                  </button>
                  <button
                    type="submit"
                    className="btn-wheat min-h-12 px-8 lg:hidden"
                    disabled={loading}
                  >
                    {loading ? 'Placing…' : 'Place order'}
                  </button>
                </div>
              </section>
            )}
          </div>

          <div className="lg:col-span-2">
            <div className="space-y-5 border border-timber-200 p-6 lg:sticky lg:top-28">
              <div className="flex items-center justify-between">
                <h2 className="text-[10px] font-medium uppercase tracking-[0.28em] text-timber-700">
                  Order summary
                </h2>
                <Link
                  to="/cart"
                  className="text-[10px] uppercase tracking-[0.18em] text-timber-500 underline-offset-4 hover:underline"
                >
                  Edit cart
                </Link>
              </div>

              <ul className="max-h-64 space-y-4 overflow-y-auto">
                {items.map((item) => (
                  <li
                    key={`${item.productId}-${item.color}-${item.size}`}
                    className="flex gap-3"
                  >
                    <img
                      src={getImageUrl(item.image)}
                      alt=""
                      className="h-16 w-14 object-cover bg-timber-100"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-timber-500">
                        {[item.color, item.size && `Size ${item.size}`, `×${item.qty}`]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <p className="text-sm tabular-nums">
                      {formatMoney(item.price * item.qty)}
                    </p>
                  </li>
                ))}
              </ul>

              <div className="space-y-2 border-t border-timber-100 pt-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-timber-500">Subtotal</span>
                  <span className="tabular-nums">{formatMoney(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-timber-500">Shipping</span>
                  <span className="tabular-nums">
                    {shipping === 0
                      ? 'Free'
                      : shipping == null
                        ? 'Select governorate'
                        : `${formatMoney(shipping)} · free over ${formatMoney(FREE_SHIPPING_MIN)}`}
                  </span>
                </div>
                <div className="flex justify-between border-t border-timber-100 pt-3 text-base font-medium">
                  <span>Total</span>
                  <span className="tabular-nums">{formatMoney(total)}</span>
                </div>
              </div>

              <div className="space-y-2 text-xs text-timber-500">
                <p className="flex items-center gap-2">
                  <Truck className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                  Ships in 2–3 business days · Cash on delivery
                </p>
                <p className="flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                  <Link to="/returns" className="underline-offset-4 hover:underline">
                    14-day returns
                  </Link>{' '}
                  on unworn items
                </p>
              </div>

              {step === 3 ? (
                <button
                  type="submit"
                  className="btn-wheat hidden w-full py-3.5 text-[11px] uppercase tracking-[0.22em] lg:block"
                  disabled={loading}
                >
                  {loading ? 'Placing…' : 'Place order'}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-wheat hidden w-full py-3.5 text-[11px] uppercase tracking-[0.22em] lg:block"
                  onClick={goNext}
                >
                  Continue
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
