import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import Modal from '../../components/ui/Modal';
import { asArray } from '../../utils/helpers';

export default function StaffPromotions() {
  const [coupons, setCoupons] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: '', discountPercentage: 10, isActive: true });

  const load = () => api.get('/coupons').then((r) => setCoupons(asArray(r.data)));
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    try {
      await api.post('/coupons', form);
      toast.success('Coupon created');
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const toggle = async (c) => {
    await api.put(`/coupons/${c.id}`, { isActive: !c.isActive });
    load();
  };

  const remove = async (id) => {
    await api.delete(`/coupons/${id}`);
    load();
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Promotions</h1>
          <p className="page-subtitle">Promo codes — product sales are toggled on the Products page</p>
        </div>
        <button type="button" className="btn-wheat" onClick={() => setOpen(true)}>Add coupon</button>
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Discount</th>
              <th>Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {coupons.map((c) => (
              <tr key={c.id}>
                <td className="font-mono font-semibold">{c.code}</td>
                <td>{c.discountPercentage}%</td>
                <td>
                  <button type="button" className={c.isActive ? 'badge-green' : 'badge-gray'} onClick={() => toggle(c)}>
                    {c.isActive ? 'Active' : 'Off'}
                  </button>
                </td>
                <td>
                  <button type="button" className="btn-ghost btn-sm text-red-600" onClick={() => remove(c.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New coupon">
        <form onSubmit={create} className="space-y-4">
          <div>
            <label className="label">Code</label>
            <input required className="input uppercase" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </div>
          <div>
            <label className="label">Discount %</label>
            <input required type="number" min={1} max={90} className="input" value={form.discountPercentage} onChange={(e) => setForm({ ...form, discountPercentage: Number(e.target.value) })} />
          </div>
          <button type="submit" className="btn-wheat w-full">Create</button>
        </form>
      </Modal>
    </>
  );
}
