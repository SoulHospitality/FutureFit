import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Eye, EyeOff, Trash2 } from 'lucide-react';
import api from '../../api/axios';
import { asArray } from '../../utils/helpers';
import StarRating from '../../components/store/StarRating';

export default function StaffReviews() {
  const [reviews, setReviews] = useState([]);

  const load = () => api.get('/reviews').then((r) => setReviews(asArray(r.data)));
  useEffect(() => {
    load();
  }, []);

  const toggleVisible = async (r) => {
    try {
      const { data } = await api.patch(`/reviews/${r.id}`, { isVisible: !r.isVisible });
      setReviews((prev) => prev.map((row) => (row.id === r.id ? { ...row, ...data } : row)));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    }
  };

  const remove = async (r) => {
    if (!window.confirm('Delete this review?')) return;
    await api.delete(`/reviews/${r.id}`);
    toast.success('Deleted');
    setReviews((prev) => prev.filter((row) => row.id !== r.id));
  };

  return (
    <>
      <div className="mb-6">
        <h1 className="page-title">Reviews</h1>
        <p className="page-subtitle">Hide or delete customer reviews</p>
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Name</th>
              <th>Rating</th>
              <th>Comment</th>
              <th>Visible</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {reviews.map((r) => (
              <tr key={r.id} className={r.isVisible ? '' : 'opacity-50'}>
                <td className="max-w-[10rem] truncate">{r.product?.name || '—'}</td>
                <td>{r.name}</td>
                <td>
                  <StarRating value={r.rating} readOnly size={12} />
                </td>
                <td className="max-w-xs truncate text-sm text-timber-600">{r.comment}</td>
                <td>{r.isVisible ? 'Yes' : 'Hidden'}</td>
                <td>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => toggleVisible(r)}
                      title={r.isVisible ? 'Hide' : 'Show'}
                    >
                      {r.isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      className="btn-ghost btn-sm text-red-600"
                      onClick={() => remove(r)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {reviews.length === 0 && (
              <tr>
                <td colSpan={6} className="text-sm text-timber-500">
                  No reviews yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
