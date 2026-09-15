import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import api from '../../api/axios';
import Modal from '../../components/ui/Modal';
import { AUDIENCES, asArray, audienceLabel } from '../../utils/helpers';

const empty = {
  name: '',
  slug: '',
  audience: 'men',
  parentId: '',
  sortOrder: 0,
  kind: 'category',
};

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

  const roots = useMemo(
    () =>
      categories
        .filter((c) => c.audience === tab && !c.parentId)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [categories, tab]
  );

  const childrenOf = (parentId) =>
    categories
      .filter((c) => c.parentId === parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  const openCreate = (kind, parentId = '') => {
    setEditing(null);
    setForm({
      ...empty,
      kind,
      audience: tab,
      parentId: kind === 'subcategory' ? parentId : '',
    });
    setOpen(true);
  };

  const openEdit = (c) => {
    setEditing(c);
    setForm({
      name: c.name,
      slug: c.slug,
      audience: c.audience,
      parentId: c.parentId || '',
      sortOrder: c.sortOrder,
      kind: c.parentId ? 'subcategory' : 'category',
    });
    setOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      const isSub = form.kind === 'subcategory' || Boolean(form.parentId);
      const payload = {
        name: form.name,
        slug: form.slug || undefined,
        audience: form.audience,
        parentId: isSub ? form.parentId || null : null,
        sortOrder: Number(form.sortOrder) || 0,
      };
      if (!isSub) payload.parentId = null;
      if (isSub && !payload.parentId) {
        toast.error('Choose a parent category');
        return;
      }
      if (editing) await api.put(`/categories/${editing.id}`, payload);
      else await api.post('/categories', payload);
      toast.success(
        editing
          ? isSub
            ? 'Subcategory updated'
            : 'Category updated'
          : isSub
            ? 'Subcategory added'
            : 'Category added'
      );
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    }
  };

  const remove = async (c) => {
    const label = c.parentId ? 'subcategory' : 'category';
    if (!window.confirm(`Delete ${label} “${c.name}”?`)) return;
    try {
      await api.delete(`/categories/${c.id}`);
      toast.success('Deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cannot delete');
    }
  };

  const parentOptions = roots;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Categories</h1>
          <p className="page-subtitle">
            Categories and subcategories under Men, Women, and Kids
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-ghost" onClick={() => openCreate('subcategory')}>
            <Plus className="h-4 w-4" />
            Add subcategory
          </button>
          <button type="button" className="btn-wheat" onClick={() => openCreate('category')}>
            <Plus className="h-4 w-4" />
            Add category
          </button>
        </div>
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

      <div className="space-y-4">
        {roots.map((parent) => {
          const kids = childrenOf(parent.id);
          return (
            <div key={parent.id} className="overflow-hidden rounded-xl border border-timber-100 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-timber-50 bg-timber-50/60 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-timber-900">{parent.name}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-timber-400">
                    {parent.slug}
                    <span className="mx-2 text-timber-200">·</span>
                    {parent.productCount ?? 0} products
                    <span className="mx-2 text-timber-200">·</span>
                    {kids.length} subcategor{kids.length === 1 ? 'y' : 'ies'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => openCreate('subcategory', parent.id)}
                  >
                    <Plus className="h-4 w-4" />
                    Subcategory
                  </button>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => openEdit(parent)}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="btn-ghost btn-sm text-red-600"
                    onClick={() => remove(parent)}
                  >
                    <Trash2 className="h-4 w-4" />
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
                              onClick={() => openEdit(c)}
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
                  No subcategories yet — products can use this category directly, or add
                  subcategories below it.
                </p>
              )}
            </div>
          );
        })}

        {roots.length === 0 && (
          <div className="rounded-xl border border-dashed border-timber-200 px-4 py-10 text-center text-sm text-timber-500">
            No categories yet for {audienceLabel(tab)}. Add a category to get started.
          </div>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={
          editing
            ? form.kind === 'subcategory'
              ? 'Edit subcategory'
              : 'Edit category'
            : form.kind === 'subcategory'
              ? 'New subcategory'
              : 'New category'
        }
      >
        <form onSubmit={save} className="space-y-4">
          {!editing && (
            <div>
              <label className="label">Type</label>
              <select
                className="input"
                value={form.kind}
                onChange={(e) =>
                  setForm({
                    ...form,
                    kind: e.target.value,
                    parentId: e.target.value === 'category' ? '' : form.parentId,
                  })
                }
              >
                <option value="category">Category</option>
                <option value="subcategory">Subcategory</option>
              </select>
            </div>
          )}

          {form.kind === 'category' ? (
            <div>
              <label className="label">Department</label>
              <select
                className="input"
                value={form.audience}
                onChange={(e) => setForm({ ...form, audience: e.target.value })}
                disabled={Boolean(editing?.parentId)}
              >
                {AUDIENCES.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="label">Parent category</label>
              <select
                required
                className="input"
                value={form.parentId}
                onChange={(e) => setForm({ ...form, parentId: e.target.value })}
              >
                <option value="">Select…</option>
                {parentOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {parentOptions.length === 0 && (
                <p className="mt-1 text-xs text-timber-400">
                  Add a category in {audienceLabel(tab)} first.
                </p>
              )}
            </div>
          )}

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
              placeholder={form.kind === 'subcategory' ? 'boxers' : 'underwear'}
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
