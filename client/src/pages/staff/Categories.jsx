import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import api from '../../api/axios';
import Modal from '../../components/ui/Modal';
import { AUDIENCES, asArray, audienceLabel } from '../../utils/helpers';

const empty = { name: '', slug: '', audience: 'men', sortOrder: 0 };

export default function StaffCategories() {
  const [categories, setCategories] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [tab, setTab] = useState('men');

  const load = () => api.get('/categories').then((r) => setCategories(asArray(r.data)));
  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(
    () => categories.filter((c) => c.audience === tab).sort((a, b) => a.sortOrder - b.sortOrder),
    [categories, tab]
  );

  const openCreate = () => {
    setEditing(null);
    setForm({ ...empty, audience: tab });
    setOpen(true);
  };

  const openEdit = (c) => {
    setEditing(c);
    setForm({
      name: c.name,
      slug: c.slug,
      audience: c.audience,
      sortOrder: c.sortOrder,
    });
    setOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: form.name,
        slug: form.slug || undefined,
        audience: form.audience,
        sortOrder: Number(form.sortOrder) || 0,
      };
      if (editing) await api.put(`/categories/${editing.id}`, payload);
      else await api.post('/categories', payload);
      toast.success(editing ? 'Subcategory updated' : 'Subcategory added');
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete “${c.name}”?`)) return;
    try {
      await api.delete(`/categories/${c.id}`);
      toast.success('Deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cannot delete');
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Categories</h1>
          <p className="page-subtitle">Subcategories under Men, Women, and Kids</p>
        </div>
        <button type="button" className="btn-wheat" onClick={openCreate}>
          <Plus className="w-4 h-4" />
          Add subcategory
        </button>
      </div>

      <div className="mb-6 flex gap-4 border-b border-timber-100">
        {AUDIENCES.map((a) => (
          <button
            key={a.value}
            type="button"
            onClick={() => setTab(a.value)}
            className={`pb-3 text-[11px] font-medium uppercase tracking-[0.2em] ${
              tab === a.value
                ? 'border-b-2 border-timber-900 text-timber-900'
                : 'text-timber-400'
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              <th>Order</th>
              <th>Products</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((c) => (
              <tr key={c.id}>
                <td className="font-medium">{c.name}</td>
                <td className="font-mono text-xs text-timber-500">{c.slug}</td>
                <td>{c.sortOrder}</td>
                <td>{c.productCount ?? 0}</td>
                <td>
                  <div className="flex gap-1">
                    <button type="button" className="btn-ghost btn-sm" onClick={() => openEdit(c)}>
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      className="btn-ghost btn-sm text-red-600"
                      onClick={() => remove(c)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={5} className="text-sm text-timber-500">
                  No subcategories yet for {audienceLabel(tab)}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit subcategory' : 'New subcategory'}
      >
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="label">Department</label>
            <select
              className="input"
              value={form.audience}
              onChange={(e) => setForm({ ...form, audience: e.target.value })}
            >
              {AUDIENCES.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Name</label>
            <input
              required
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Slug (optional)</label>
            <input
              className="input font-mono text-sm"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder="boxers"
            />
          </div>
          <div>
            <label className="label">Sort order</label>
            <input
              type="number"
              className="input"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
            />
          </div>
          <button type="submit" className="btn-wheat w-full">
            Save
          </button>
        </form>
      </Modal>
    </>
  );
}
