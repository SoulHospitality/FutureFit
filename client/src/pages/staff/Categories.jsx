import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import api from '../../api/axios';
import Modal from '../../components/ui/Modal';
import { asArray } from '../../utils/helpers';

const emptySub = { name: '', slug: '', parentId: '', sortOrder: 0 };

export default function StaffCategories() {
  const [categories, setCategories] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptySub);
  const [mode, setMode] = useState('subcategory'); // subcategory | category

  const load = () => api.get('/categories').then((r) => setCategories(asArray(r.data)));
  useEffect(() => {
    load();
  }, []);

  const roots = useMemo(
    () =>
      categories
        .filter((c) => !c.parentId && ['men', 'women', 'kids'].includes(c.slug))
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [categories]
  );

  const childrenOf = (parentId) =>
    categories
      .filter((c) => c.parentId === parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  const openCreateSub = (parentId = '') => {
    setMode('subcategory');
    setEditing(null);
    setForm({ ...emptySub, parentId: parentId || roots[0]?.id || '' });
    setOpen(true);
  };

  const openEditSub = (c) => {
    setMode('subcategory');
    setEditing(c);
    setForm({
      name: c.name,
      slug: c.slug,
      parentId: c.parentId || '',
      sortOrder: c.sortOrder,
    });
    setOpen(true);
  };

  const openEditCategory = (c) => {
    setMode('category');
    setEditing(c);
    setForm({
      name: c.name,
      slug: c.slug,
      parentId: '',
      sortOrder: c.sortOrder,
    });
    setOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (mode === 'category') {
        await api.put(`/categories/${editing.id}`, {
          name: form.name,
          sortOrder: Number(form.sortOrder) || 0,
        });
        toast.success('Category updated');
      } else {
        if (!form.parentId) {
          toast.error('Choose Men, Women, or Kids');
          return;
        }
        const payload = {
          name: form.name,
          slug: form.slug || undefined,
          parentId: form.parentId,
          sortOrder: Number(form.sortOrder) || 0,
        };
        if (editing) await api.put(`/categories/${editing.id}`, payload);
        else await api.post('/categories', payload);
        toast.success(editing ? 'Subcategory updated' : 'Subcategory added');
      }
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete subcategory “${c.name}”?`)) return;
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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Categories</h1>
          <p className="page-subtitle">
            Categories are Men, Women, and Kids. Subcategories are Boxers, Trunks, Underwear, and
            so on.
          </p>
        </div>
        <button type="button" className="btn-wheat" onClick={() => openCreateSub()}>
          <Plus className="h-4 w-4" />
          Add subcategory
        </button>
      </div>

      <div className="space-y-4">
        {roots.map((parent) => {
          const kids = childrenOf(parent.id);
          return (
            <div
              key={parent.id}
              className="overflow-hidden rounded-xl border border-timber-100 bg-white"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-timber-50 bg-timber-50/60 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-timber-400">
                    Category
                  </p>
                  <p className="mt-0.5 text-lg font-medium text-timber-900">{parent.name}</p>
                  <p className="mt-0.5 text-xs text-timber-400">
                    {kids.length} subcategor{kids.length === 1 ? 'y' : 'ies'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => openCreateSub(parent.id)}
                  >
                    <Plus className="h-4 w-4" />
                    Subcategory
                  </button>
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => openEditCategory(parent)}
                    title="Rename category"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {kids.length > 0 ? (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Subcategory</th>
                      <th>Slug</th>
                      <th>Order</th>
                      <th>Products</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {kids.map((c) => (
                      <tr key={c.id}>
                        <td className="font-medium">{c.name}</td>
                        <td className="font-mono text-xs text-timber-500">{c.slug}</td>
                        <td>{c.sortOrder}</td>
                        <td>{c.productCount ?? 0}</td>
                        <td>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              className="btn-ghost btn-sm"
                              onClick={() => openEditSub(c)}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="btn-ghost btn-sm text-red-600"
                              onClick={() => remove(c)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="px-4 py-3 text-sm text-timber-400">
                  No subcategories yet — add Boxers, Trunks, Underwear, etc.
                </p>
              )}
            </div>
          );
        })}

        {roots.length === 0 && (
          <div className="rounded-xl border border-dashed border-timber-200 px-4 py-10 text-center text-sm text-timber-500">
            Categories will appear after the server seeds Men, Women, and Kids. Refresh in a moment.
          </div>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={
          mode === 'category'
            ? 'Edit category'
            : editing
              ? 'Edit subcategory'
              : 'New subcategory'
        }
      >
        <form onSubmit={save} className="space-y-4">
          {mode === 'subcategory' && (
            <div>
              <label className="label">Category</label>
              <select
                required
                className="input"
                value={form.parentId}
                onChange={(e) => setForm({ ...form, parentId: e.target.value })}
              >
                <option value="">Select…</option>
                {roots.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label">Name</label>
            <input
              required
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={mode === 'category' ? 'Men' : 'Boxers'}
            />
          </div>
          {mode === 'subcategory' && (
            <div>
              <label className="label">Slug (optional)</label>
              <input
                className="input font-mono text-sm"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="boxers"
              />
            </div>
          )}
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
