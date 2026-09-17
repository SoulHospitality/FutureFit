import BrandLogo from '../BrandLogo';

const SIZES = {
  sm: { wrap: 'h-10 w-10', logo: 'sm', ring: 'border' },
  md: { wrap: 'h-16 w-16', logo: 'md', ring: 'border-[1.5px]' },
  lg: { wrap: 'h-24 w-24', logo: 'lg', ring: 'border-2' },
  xl: { wrap: 'h-28 w-28', logo: 'xl', ring: 'border-2' },
};

/**
 * Branded FutureFit loader — logo + soft orbit animation.
 * Use for page/section loads; keep button text for tiny inline actions.
 */
export default function BrandLoader({
  size = 'md',
  label,
  invert = false,
  fullPage = false,
  className = '',
}) {
  const s = SIZES[size] || SIZES.md;
  const tone = invert ? 'text-white/70' : 'text-timber-500';
  const ring = invert ? 'border-white/25 border-t-white' : 'border-timber-200 border-t-timber-900';

  const core = (
    <div
      className={`brand-loader inline-flex flex-col items-center justify-center gap-4 ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className={`brand-loader__mark relative ${s.wrap}`}>
        <span
          className={`brand-loader__ring absolute inset-0 rounded-full ${s.ring} ${ring}`}
          aria-hidden
        />
        <span
          className={`brand-loader__ring brand-loader__ring--lag absolute inset-1 rounded-full border border-dashed opacity-40 ${
            invert ? 'border-white/40' : 'border-timber-400'
          }`}
          aria-hidden
        />
        <div className="brand-loader__logo absolute inset-0 grid place-items-center p-[18%]">
          <BrandLogo to={null} size={s.logo} invert={invert} className="!h-full max-h-full" />
        </div>
      </div>
      {label ? (
        <p className={`brand-loader__label text-[10px] font-medium uppercase tracking-[0.28em] ${tone}`}>
          {label}
        </p>
      ) : (
        <span className="sr-only">Loading</span>
      )}
    </div>
  );

  if (!fullPage) return core;

  return (
    <div
      className={`grid min-h-[40vh] w-full place-items-center px-4 ${
        invert ? 'bg-timber-900' : 'bg-white'
      }`}
    >
      {core}
    </div>
  );
}
