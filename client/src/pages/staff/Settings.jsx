import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Copy, ExternalLink, Settings2, XCircle } from 'lucide-react';
import api from '../../api/axios';
import BrandLoader from '../../components/ui/BrandLoader';
import { toast } from 'react-toastify';

function StatusRow({ label, ok, hint }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-zinc-100 py-3 last:border-0">
      <div>
        <p className="text-sm font-medium text-zinc-900">{label}</p>
        {hint ? <p className="mt-0.5 text-xs text-zinc-500">{hint}</p> : null}
      </div>
      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${ok ? 'text-emerald-700' : 'text-zinc-400'}`}>
        {ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
        {ok ? 'Connected' : 'Not configured'}
      </span>
    </div>
  );
}

export default function StaffSettings() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/analytics/integrations')
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const copy = async (text) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied');
    } catch {
      toast.error('Copy failed');
    }
  };

  return (
    <>
      <div className="mb-5 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-zinc-900 text-white">
          <Settings2 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Integrations, webhooks, and store links</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="sp-card p-5">
          <h2 className="text-sm font-semibold text-zinc-900">Integrations</h2>
          {loading ? (
            <div className="mt-6 grid place-items-center py-6">
              <BrandLoader size="sm" label="Loading" />
            </div>
          ) : (
            <div className="mt-2">
              <StatusRow
                label="Paymob"
                ok={data?.paymobEnabled}
                hint="Card / wallet checkout"
              />
              <StatusRow
                label="Bosta"
                ok={data?.bostaEnabled}
                hint="Auto-ship on confirmed orders"
              />
              <StatusRow
                label="Mailchimp"
                ok={data?.mailchimpEnabled}
                hint="Optional newsletter sync"
              />
              <StatusRow
                label="Cloudinary"
                ok={data?.cloudinaryEnabled}
                hint="Product & slide images"
              />
            </div>
          )}
        </div>

        <div className="sp-card p-5">
          <h2 className="text-sm font-semibold text-zinc-900">URLs & webhooks</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Paste these in Paymob / Bosta dashboards. Currency: {data?.currency || 'EGP'}
          </p>
          <ul className="mt-4 space-y-3 text-sm">
            {[
              ['Storefront', data?.urls?.client],
              ['API', data?.urls?.api],
              ['Paymob webhook', data?.urls?.paymobWebhook],
              ['Bosta webhook', data?.urls?.bostaWebhook],
            ].map(([label, value]) => (
              <li key={label}>
                <p className="text-xs font-medium text-zinc-500">{label}</p>
                <div className="mt-1 flex items-center gap-2">
                  <code className="flex-1 truncate rounded-lg bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-700">
                    {value || '— set CLIENT_URL / API_PUBLIC_URL'}
                  </code>
                  {value && (
                    <button
                      type="button"
                      className="rounded-lg border border-zinc-200 p-1.5 hover:bg-zinc-50"
                      onClick={() => copy(value)}
                      title="Copy"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="sp-card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-zinc-900">Quick links</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to="/staff/analytics"
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
            >
              Analytics
            </Link>
            <Link
              to="/staff/finance"
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
            >
              Finance
            </Link>
            <Link
              to="/staff/inventory"
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
            >
              Inventory
            </Link>
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
            >
              View store <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-zinc-500">
            Keys live in Railway env vars (`PAYMOB_*`, `BOSTA_API_KEY`, etc.). See{' '}
            <code className="rounded bg-zinc-100 px-1">server/.env.example</code>.
          </p>
        </div>
      </div>
    </>
  );
}
