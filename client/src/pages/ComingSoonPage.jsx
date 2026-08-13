const INK = '#18181b';

export default function ComingSoonPage() {
  return (
    <main className="coming-soon relative min-h-[100dvh] overflow-hidden bg-white text-[color:var(--cs-ink)]">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background: `
            radial-gradient(ellipse 70% 55% at 50% 38%, rgba(24, 24, 27, 0.05), transparent 70%),
            radial-gradient(ellipse 50% 40% at 50% 100%, rgba(9, 9, 11, 0.04), transparent 65%)
          `,
        }}
      />

      <div className="relative z-10 flex min-h-[100dvh] flex-col items-center justify-between px-5 py-8 sm:px-8 sm:py-10">
        <div className="coming-soon__mark h-px w-12 opacity-0 bg-timber-900" />

        <figure className="coming-soon__hero m-0 flex w-full max-w-xl flex-1 flex-col items-center justify-center">
          <img
            src="/images/logo.png"
            alt="FutureFit — Coming Soon"
            className="coming-soon__art h-auto w-full max-h-[min(50dvh,420px)] object-contain select-none"
            draggable={false}
          />
          <figcaption className="sr-only">
            FutureFit coming soon. Setting trends with every stitch.
          </figcaption>
        </figure>

        <p
          className="coming-soon__line max-w-sm text-center text-[10px] font-medium uppercase tracking-[0.35em] sm:text-[11px]"
          style={{ color: INK }}
        >
          Setting trends with every stitch
        </p>
      </div>

      <style>{`
        .coming-soon {
          --cs-ink: ${INK};
        }

        .coming-soon__mark {
          animation: cs-fade 1s ease 0.15s forwards;
        }

        .coming-soon__art {
          opacity: 0;
          transform: translateY(18px) scale(0.985);
          animation: cs-rise 1.15s cubic-bezier(0.22, 1, 0.36, 1) 0.2s forwards;
          filter: drop-shadow(0 28px 50px rgba(9, 9, 11, 0.08));
        }

        .coming-soon__line {
          opacity: 0;
          letter-spacing: 0.35em;
          animation: cs-fade 1s ease 0.85s forwards, cs-breathe 4.5s ease-in-out 1.6s infinite;
        }

        @keyframes cs-rise {
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes cs-fade {
          to { opacity: 0.72; }
        }

        @keyframes cs-breathe {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 0.9; }
        }

        @media (prefers-reduced-motion: reduce) {
          .coming-soon__mark,
          .coming-soon__art,
          .coming-soon__line {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>
    </main>
  );
}
