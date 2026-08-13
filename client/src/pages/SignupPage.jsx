import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';

const ADDRESS_FIELDS = [
  { key: 'street', label: 'Street address', autoComplete: 'street-address', span: true },
  { key: 'city', label: 'City', autoComplete: 'address-level2' },
  { key: 'state', label: 'Governorate', autoComplete: 'address-level1' },
  { key: 'zip', label: 'Postal code', autoComplete: 'postal-code', inputMode: 'numeric' },
  { key: 'country', label: 'Country', autoComplete: 'country-name' },
];

export default function SignupPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get('redirect') || '/';
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    street: '',
    city: '',
    state: '',
    zip: '',
    country: 'Egypt',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register({
        name: form.name,
        email: form.email,
        password: form.password,
        phone: form.phone,
        address: {
          street: form.street,
          city: form.city,
          state: form.state,
          zip: form.zip,
          country: form.country,
        },
      });
      toast.success('Account created');
      navigate(redirect);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Join FutureFit"
      subtitle="Create an account for faster checkout — or continue as a guest from your cart."
      footer={
        <>
          Already have an account?{' '}
          <Link
            to={`/login${redirect !== '/' ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}
            className="font-semibold text-wheat-500 underline-offset-2 hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-6">
        <section className="space-y-4">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-timber-400">
            Account
          </h2>
          <div>
            <label htmlFor="signup-name" className="label">
              Full name
            </label>
            <input
              id="signup-name"
              required
              autoComplete="name"
              enterKeyHint="next"
              className="auth-input"
              value={form.name}
              onChange={set('name')}
              placeholder="Your name"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="signup-email" className="label">
                Email
              </label>
              <input
                id="signup-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                enterKeyHint="next"
                required
                className="auth-input"
                value={form.email}
                onChange={set('email')}
                placeholder="you@email.com"
              />
            </div>
            <div>
              <label htmlFor="signup-phone" className="label">
                Phone
              </label>
              <input
                id="signup-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                enterKeyHint="next"
                required
                className="auth-input"
                value={form.phone}
                onChange={set('phone')}
                placeholder="01xxxxxxxxx"
              />
            </div>
          </div>
          <div>
            <label htmlFor="signup-password" className="label">
              Password
            </label>
            <div className="relative">
              <input
                id="signup-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                enterKeyHint="next"
                required
                minLength={6}
                className="auth-input pr-12"
                value={form.password}
                onChange={set('password')}
                placeholder="At least 6 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 end-0 flex min-w-12 items-center justify-center text-timber-400 hover:text-timber-700"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </section>

        <section className="space-y-4 border-t border-timber-100 pt-5">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-timber-400">
            Delivery address
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {ADDRESS_FIELDS.map(({ key, label, autoComplete, inputMode, span }) => (
              <div key={key} className={span ? 'sm:col-span-2' : ''}>
                <label htmlFor={`signup-${key}`} className="label">
                  {label}
                </label>
                <input
                  id={`signup-${key}`}
                  required
                  autoComplete={autoComplete}
                  inputMode={inputMode}
                  enterKeyHint={key === 'country' ? 'done' : 'next'}
                  className="auth-input"
                  value={form[key]}
                  onChange={set(key)}
                />
              </div>
            ))}
          </div>
        </section>

        <div className="sticky bottom-0 -mx-5 border-t border-timber-100 bg-white/95 px-5 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur-sm sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:pt-1 sm:backdrop-blur-none">
          <button
            type="submit"
            className="btn-wheat min-h-12 w-full py-3.5 text-sm font-bold uppercase tracking-[0.14em]"
            disabled={loading}
          >
            {loading ? 'Creating…' : 'Create account'}
          </button>
          <p className="mt-3 text-center text-xs text-timber-400 sm:hidden">
            Prefer not to register?{' '}
            <Link to="/checkout" className="font-medium text-wheat-500">
              Guest checkout
            </Link>
          </p>
        </div>
      </form>
    </AuthLayout>
  );
}
