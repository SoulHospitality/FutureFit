import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { STORE_WHATSAPP_URL } from '../../utils/helpers';

const MOBILE_HIDDEN = ['/product/', '/checkout', '/cart'];
const SHOW_AFTER_PX = 300;

/** Floating "chat with us" shortcut — the quickest path to an answer for COD shoppers. */
export default function WhatsAppButton() {
  const { pathname } = useLocation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SHOW_AFTER_PX);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [pathname]);

  if (!STORE_WHATSAPP_URL) return null;
  const hideOnMobile = MOBILE_HIDDEN.some((p) => pathname.startsWith(p));

  return (
    <a
      href={`${STORE_WHATSAPP_URL}?text=${encodeURIComponent('Hi FutureFit 👋')}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      title="Chat with us on WhatsApp"
      aria-hidden={!visible}
      tabIndex={visible ? undefined : -1}
      className={`${hideOnMobile ? 'max-lg:hidden ' : ''}group fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] end-[max(1.25rem,env(safe-area-inset-right))] z-40 grid h-14 w-14 place-items-center rounded-full bg-timber-900 text-white shadow-[0_18px_40px_-12px_rgba(9,9,11,0.6)] ring-4 ring-blush/60 transition duration-500 ease-ff hover:bg-timber-700 hover:ring-blush md:bottom-7 md:end-7 ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
      }`}
    >
      <span
        className="absolute end-0.5 top-0.5 h-3 w-3 rounded-full border-2 border-bone bg-[#25d366]"
        aria-hidden="true"
      />
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="transition-transform duration-500 group-hover:scale-110"
        aria-hidden="true"
      >
        <path d="M20.52 3.48A11.94 11.94 0 0012.04 0C5.5 0 .18 5.32.18 11.86c0 2.09.55 4.13 1.6 5.93L0 24l6.36-1.66a11.86 11.86 0 005.68 1.45h.01c6.54 0 11.86-5.32 11.86-11.86 0-3.17-1.23-6.15-3.39-8.45zM12.05 21.79h-.01a9.86 9.86 0 01-5.03-1.38l-.36-.21-3.77.99 1.01-3.68-.24-.38a9.84 9.84 0 01-1.51-5.26c0-5.44 4.43-9.87 9.88-9.87 2.64 0 5.12 1.03 6.98 2.9a9.81 9.81 0 012.89 6.98c0 5.44-4.43 9.87-9.84 9.87zm5.41-7.39c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.34.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.76-1.66-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.34.45-.51.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.5l-.57-.01a1.1 1.1 0 00-.79.37c-.27.3-1.04 1.01-1.04 2.47s1.07 2.87 1.21 3.07c.15.2 2.1 3.21 5.08 4.5.71.31 1.26.49 1.7.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2-1.42.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35z" />
      </svg>
    </a>
  );
}
