import { Link } from 'react-router-dom';
import BrandLogo from '../BrandLogo';

const FACEBOOK = 'https://www.facebook.com/FutureFit.eg';

export default function StoreFooter() {
  return (
    <footer className="mt-auto bg-timber-900 text-timber-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 grid md:grid-cols-3 gap-12">
        <div>
          <BrandLogo to="/" size="md" invert className="opacity-95" />
          <p className="mt-5 text-sm leading-relaxed text-timber-400 max-w-xs">
            Setting trends with every stitch — refined apparel designed for presence, fit, and
            everyday confidence.
          </p>
          <a
            href={FACEBOOK}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-block text-[10px] font-medium uppercase tracking-[0.28em] text-white/80 hover:text-white transition"
          >
            Facebook
          </a>
        </div>
        <div>
          <h4 className="text-white text-[11px] font-medium uppercase tracking-[0.28em] mb-4">
            Explore
          </h4>
          <div className="space-y-3 text-sm">
            <Link to="/shop" className="block hover:text-white transition">Shop</Link>
            <Link to="/about" className="block hover:text-white transition">About</Link>
            <Link to="/contact" className="block hover:text-white transition">Contact</Link>
            <Link to="/wishlist" className="block hover:text-white transition">Wishlist</Link>
          </div>
        </div>
        <div>
          <h4 className="text-white text-[11px] font-medium uppercase tracking-[0.28em] mb-4">
            Help
          </h4>
          <div className="space-y-3 text-sm">
            <Link to="/returns" className="block hover:text-white transition">Returns</Link>
            <Link to="/privacy" className="block hover:text-white transition">Privacy</Link>
            <Link to="/terms" className="block hover:text-white transition">Terms</Link>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 text-center text-[10px] uppercase tracking-[0.22em] text-timber-500 py-5">
        © {new Date().getFullYear()} FutureFit. All rights reserved.
      </div>
    </footer>
  );
}
