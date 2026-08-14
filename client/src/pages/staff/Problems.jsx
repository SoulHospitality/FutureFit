import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import Modal from '../../components/ui/Modal';
import { asArray } from '../../utils/helpers';

const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

export default function StaffProblems() {
  const [problems, setProblems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ orderId: '', subject: '', details: '' });

  const load = () => {
    api.get('/problems').then((r) => setProblems(asArray(r.data)));
    api.get('/orders').then((r) => setOrders(asArray(r.data)));
  };
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    try {
      await api.post('/problems', form);
      toast.success('Problem request created');
      setOpen(false);
      setForm({ orderId: '', subject: '', details: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const updateStatus = async (id, status) => {
    await api.patch(`/problems/${id}`, { status });
    load();
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Problem requests</h1>
          <p className="page-subtitle">Issues with deliveries or customers</p>
        </div>
        <button type="button" className="btn-wheat" onClick={() => setOpen(true)}>New request</button>
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Subject</th>
              <th>Customer</th>
              <th>Order</th>
              <th>Status</th>
              <th>Created by</th>
              <th>Update</th>
            </tr>
          </thead>
          <tbody>
            {problems.map((p) => (
              <tr key={p.id}>
                <td>
                  <div className="font-medium">{p.subject}</div>
                  <div className="text-xs text-timber-400 max-w-xs truncate">{p.details}</div>
                </td>
                <td>{p.customer?.name}</td>
                <td className="font-mono text-xs">{p.orderId?.slice(0, 8)}</td>
                <td className="capitalize">{p.status.replace('_', ' ')}</td>
                <td>{p.createdBy?.name}</td>
                <td>
                  <select
                    className="input !py-1 !text-xs w-32"
                    value={p.status}
                    onChange={(e) => updateStatus(p.id, e.target.value)}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s.replace('_', ' ')}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New problem request">
        <form onSubmit={create} className="space-y-4">
          <div>
            <label className="label">Order</label>
            <select
              required
              className="input"
              value={form.orderId}
              onChange={(e) => setForm({ ...form, orderId: e.target.value })}
            >
              <option value="">Select order</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.id.slice(0, 8)} — {o.user?.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Subject</label>
            <input required className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          </div>
          <div>
            <label className="label">Details</label>
            <textarea required rows={4} className="input" value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} />
          </div>
          <button type="submit" className="btn-wheat w-full">Create</button>
        </form>
      </Modal>
    </>
  );
}
