import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import { asArray } from '../../utils/helpers';

export default function StaffNewsletter() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/newsletter')
      .then((r) => setRows(asArray(r.data)))
      .catch((err) => toast.error(err.response?.data?.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const copyEmails = async () => {
    const text = rows.map((r) => r.email).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Emails copied');
    } catch {
      toast.error('Could not copy');
    }
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Newsletter</h1>
          <p className="page-subtitle">
            {loading ? 'Loading…' : `${rows.length} subscriber${rows.length === 1 ? '' : 's'}`}
          </p>
        </div>
        {rows.length > 0 && (
          <button type="button" className="btn-outline btn-sm" onClick={copyEmails}>
            Copy emails
          </button>
        )}
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Source</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={3} className="text-sm text-timber-500">
                  No subscribers yet.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="font-medium">{r.email}</td>
                <td className="text-sm text-timber-500">{r.source || '—'}</td>
                <td className="text-sm text-timber-500">
                  {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
