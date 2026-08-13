import { Link } from 'react-router-dom';
import BrandLogo from './BrandLogo';

/** Shared shell for login / signup — brand-led, phone-first. */
export default function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}) {
  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-timber-50">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% -15%, rgba(24, 24, 27, 0.08), transparent 55%),
            linear-gradient(180deg, #ffffff 0%, #f4f4f5 100%)
          `,
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 sm:py-10">
        <div className="mb-6 flex items-center justify-between sm:mb-8">
          <BrandLogo size="lg" className="h-12 sm:h-14" />
          <Link
            to="/"
            className="min-h-11 min-w-11 inline-flex items-center justify-center px-3 text-[10px] font-medium uppercase tracking-[0.24em] text-timber-500 transition hover:bg-white hover:text-timber-900"
          >
            Home
          </Link>
        </div>

        <div className="flex flex-1 flex-col justify-center">
          <header className="mb-6 sm:mb-8">
            <h1 className="font-display text-[2.75rem] font-medium leading-none tracking-tight text-timber-900 sm:text-6xl">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-timber-500 sm:text-base">
                {subtitle}
              </p>
            )}
          </header>

          <div className="border border-timber-200 bg-white/95 p-5 shadow-[0_24px_60px_-36px_rgba(9,9,11,0.35)] backdrop-blur-sm sm:p-7">
            {children}
          </div>

          {footer && <div className="mt-6 text-center text-sm text-timber-500">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
