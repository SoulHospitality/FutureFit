import { Link } from 'react-router-dom';
import { usePageMeta } from '../utils/seo';
import { useSiteCopy } from '../utils/websiteContent';

function Legal({ title, description, body }) {
  usePageMeta({ title, description });
  const paragraphs = String(body || '')
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return (
    <div className="bg-bone">
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
        <p className="text-[10px] font-medium uppercase tracking-[0.32em] text-timber-400">
          FutureFit
        </p>
        <h1 className="mt-3 font-display text-5xl font-medium tracking-tight text-timber-900">
          {title}
        </h1>
        <div className="mt-8 space-y-4 border-t border-timber-100 pt-8 text-base leading-relaxed text-timber-600">
          {paragraphs.length ? (
            paragraphs.map((p) => <p key={p.slice(0, 40)}>{p}</p>)
          ) : (
            <p>Content coming soon.</p>
          )}
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

function usePolicy(key, fallbackTitle, fallbackBody, description) {
  const copy = useSiteCopy();
  const policy = copy.policies?.[key] || {};
  return {
    title: policy.title || fallbackTitle,
    body: policy.body || fallbackBody,
    description,
  };
}

export function PrivacyPage() {
  const p = usePolicy(
    'privacy',
    'Privacy',
    'We collect your name, email, phone, and address to fulfill orders. We do not sell your data.\n\nWe use cookies and similar technologies from analytics and advertising partners (such as Google, Meta and TikTok) to understand how the store is used and to measure our ads.',
    'How FutureFit collects and uses your information.'
  );
  return <Legal {...p} />;
}

export function TermsPage() {
  const p = usePolicy(
    'terms',
    'Terms',
    'By shopping at FutureFit you agree to our checkout terms, product availability, and delivery timelines.',
    'Terms for shopping at FutureFit.'
  );
  return <Legal {...p} />;
}

export function ReturnsPage() {
  const p = usePolicy(
    'returns',
    'Returns',
    'Unworn items may be returned within 14 days. Contact Ops via your order if there is a delivery issue.',
    'Return or exchange unworn FutureFit pieces within 14 days.'
  );
  return <Legal {...p} />;
}
