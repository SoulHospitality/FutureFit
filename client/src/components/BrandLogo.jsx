import { Link } from 'react-router-dom';

const SIZES = {
  sm: 'h-9',
  md: 'h-12',
  lg: 'h-16',
  xl: 'h-20',
  header: 'h-[3.75rem] sm:h-[4.75rem]',
};

/** FutureFit wordmark — transparent PNG (black or white). */
export default function BrandLogo({
  to = '/',
  size = 'md',
  className = '',
  style,
  invert = false,
}) {
  const img = (
    <img
      src={invert ? '/images/logo-white.png' : '/images/logo.png'}
      alt="FutureFit"
      className={`${SIZES[size] || SIZES.md} w-auto object-contain ${className}`}
      style={style}
      draggable={false}
    />
  );

  if (!to) return img;
  return (
    <Link to={to} className="inline-flex items-center shrink-0" aria-label="FutureFit home">
      {img}
    </Link>
  );
}
