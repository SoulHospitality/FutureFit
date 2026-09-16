import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { ImagePlus, Pencil, Plus, Trash2 } from 'lucide-react';
import api from '../../api/axios';
import Modal from '../../components/ui/Modal';
import { asArray, getImageUrl } from '../../utils/helpers';

const emptySub = { name: '', slug: '', parentId: '', sortOrder: 0 };

export default function StaffCategories() {
  const [categories, setCategories] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptySub);
  const [mode, setMode] = useState('subcategory');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

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
      statement: c.statement || '',
      imageUrl: c.imageUrl || '',
      sortOrder: c.sortOrder,
    });
    setOpen(true);
  };

  const onPickPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append('image', file);
      body.append('folder', 'futurefit/categories');
      const { data } = await api.post('/upload', body);
      setForm((f) => ({ ...f, imageUrl: data.url }));
      toast.success('Photo uploaded');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (mode === 'category') {
        await api.put(`/categories/${editing.id}`, {
          name: form.name,
          statement: form.statement,
          imageUrl: form.imageUrl || null,
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
            Categories are Men, Women, and Kids (name, photo, homepage statement). Subcategories
            are Boxers, Dresses, Hoodies, and the rest.
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
                <div className="flex min-w-0 items-center gap-3">
                  <div className="h-14 w-11 shrink-0 overflow-hidden rounded-lg bg-timber-200">
                    {parent.imageUrl ? (
                      <img
                        src={getImageUrl(parent.imageUrl, { width: 120, aspect: '4:5' })}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-timber-400">
                        <ImagePlus className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-timber-400">
                      Category
                    </p>
                    <p className="mt-0.5 text-lg font-medium text-timber-900">{parent.name}</p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-timber-500">
                      {parent.statement || 'No homepage statement yet'}
                    </p>
                    <p className="mt-0.5 text-xs text-timber-400">
                      {kids.length} subcategor{kids.length === 1 ? 'y' : 'ies'}
                    </p>
                  </div>
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
                    title="Edit category"
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
                  No subcategories yet — add Boxers, Dresses, Hoodies, etc.
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
          {mode === 'category' ? (
            <>
              <div>
                <label className="label">Name</label>
                <input
                  required
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Men"
                />
              </div>
              <div>
                <label className="label">Homepage statement</label>
                <textarea
                  className="input min-h-[72px]"
                  value={form.statement || ''}
                  onChange={(e) => setForm({ ...form, statement: e.target.value })}
                  placeholder="Short line under the name on Departments"
                  maxLength={200}
                />
                <p className="mt-1 text-[11px] text-timber-400">
                  Shown on the homepage Departments section.
                </p>
              </div>
              <div>
                <label className="label">Photo</label>
                <div className="flex flex-wrap items-start gap-3">
                  <div className="aspect-[4/5] w-24 overflow-hidden rounded-lg bg-timber-100">
                    {form.imageUrl ? (
                      <img
                        src={getImageUrl(form.imageUrl, { width: 200, aspect: '4:5' })}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <input
                      className="input font-mono text-xs"
                      value={form.imageUrl || ''}
                      onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                      placeholder="Image URL"
                    />
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={onPickPhoto}
                    />
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      disabled={uploading}
                      onClick={() => fileRef.current?.click()}
                    >
                      <ImagePlus className="h-4 w-4" />
                      {uploading ? 'Uploading…' : 'Upload photo'}
                    </button>
                    <p className="text-xs text-zinc-500">
                      Recommended:{' '}
                      <span className="font-medium text-zinc-700">4:5</span> portrait
                      (e.g. 1080×1350). Keep the subject centered — edges may crop.
                    </p>
                  </div>
                </div>
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
            </>
          ) : (
            <>
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
              <div>
                <label className="label">Name</label>
                <input
                  required
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Boxers"
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
            </>
          )}
          <button type="submit" className="btn-wheat w-full">
            Save
          </button>
        </form>
      </Modal>
    </>
  );
}
