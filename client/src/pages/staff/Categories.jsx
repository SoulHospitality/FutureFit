import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { ImagePlus, Pencil, Plus, Trash2 } from 'lucide-react';
import api from '../../api/axios';
import Modal from '../../components/ui/Modal';
import DragSortList from '../../components/staff/DragSortList';
import { asArray, getImageUrl, AUDIENCES } from '../../utils/helpers';

const emptyCategory = {
  name: '',
  slug: '',
  audience: 'men',
  statement: '',
  imageUrl: '',
  sortOrder: 0,
};

const emptySub = { name: '', slug: '', parentId: '', sortOrder: 0 };

const SYSTEM_ROOTS = new Set(['men', 'women', 'kids']);

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
        .filter((c) => !c.parentId)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [categories]
  );

  const childrenOf = (parentId) =>
    categories
      .filter((c) => c.parentId === parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  const openCreateCategory = () => {
    setMode('category');
    setEditing(null);
    setForm({
      ...emptyCategory,
      sortOrder: roots.length,
    });
    setOpen(true);
  };

  const openCreateSub = (parentId = '') => {
    setMode('subcategory');
    setEditing(null);
    setForm({ ...emptySub, parentId: parentId || roots[0]?.id || '' });
    setOpen(true);
  };

  const saveOrder = async (ordered) => {
    const indexById = new Map(ordered.map((c, i) => [c.id, i]));
    const changed = ordered.filter((c, i) => c.sortOrder !== i);
    if (!changed.length) return;
    setCategories((prev) =>
      prev.map((c) => (indexById.has(c.id) ? { ...c, sortOrder: indexById.get(c.id) } : c))
    );
    try {
      await Promise.all(
        changed.map((c) => api.put(`/categories/${c.id}`, { sortOrder: indexById.get(c.id) }))
      );
      toast.success('Order saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save order');
      load();
    }
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
      slug: c.slug || '',
      audience: c.audience || 'men',
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
        const payload = {
          name: form.name,
          statement: form.statement,
          imageUrl: form.imageUrl || null,
          sortOrder: Number(form.sortOrder) || 0,
          audience: form.audience,
          slug: form.slug || undefined,
        };
        if (editing) await api.put(`/categories/${editing.id}`, payload);
        else await api.post('/categories', payload);
        toast.success(editing ? 'Category updated' : 'Category added');
      } else {
        if (!form.parentId) {
          toast.error('Choose a category');
          return;
        }
        const movedParent = !editing || editing.parentId !== form.parentId;
        const payload = {
          name: form.name,
          slug: form.slug || undefined,
          parentId: form.parentId,
          sortOrder: movedParent ? childrenOf(form.parentId).length : Number(form.sortOrder) || 0,
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

  const modalTitle =
    mode === 'category'
      ? editing
        ? 'Edit category'
        : 'New category'
      : editing
        ? 'Edit subcategory'
        : 'New subcategory';

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Categories</h1>
          <p className="page-subtitle">
            Add top-level categories (Men, Women, Kids, or custom) and nest subcategories under
            them.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-outline" onClick={openCreateCategory}>
            <Plus className="h-4 w-4" />
            Add category
          </button>
          <button type="button" className="btn-wheat" onClick={() => openCreateSub()}>
            <Plus className="h-4 w-4" />
            Add subcategory
          </button>
        </div>
      </div>

      {roots.length > 1 && (
        <div className="mb-6 overflow-clip rounded-xl border border-timber-100 bg-white">
          <div className="border-b border-timber-50 bg-timber-50/60 px-4 py-3">
            <h2 className="text-sm font-semibold text-timber-900">Category order</h2>
            <p className="mt-0.5 text-xs text-timber-500">
              Drag to set the order of departments on the storefront. Saves automatically.
            </p>
          </div>
          <DragSortList
            items={roots}
            onReorder={saveOrder}
            itemLabel="category"
            className="px-4"
            renderItem={(c) => (
              <div className="flex items-center gap-3">
                <div className="h-10 w-8 shrink-0 overflow-hidden rounded bg-timber-100">
                  {c.imageUrl ? (
                    <img
                      src={getImageUrl(c.imageUrl, { width: 64, aspect: '4:5' })}
                      alt=""
                      className="h-full w-full object-cover"
                      draggable={false}
                    />
                  ) : null}
                </div>
                <p className="truncate text-sm font-medium text-timber-900">{c.name}</p>
                <span className="text-xs text-timber-400">{c.audience}</span>
              </div>
            )}
          />
        </div>
      )}

      <div className="space-y-4">
        {roots.map((parent) => {
          const kids = childrenOf(parent.id);
          const isSystem = SYSTEM_ROOTS.has(parent.slug);
          return (
            <div
              key={parent.id}
              className="overflow-clip rounded-xl border border-timber-100 bg-white"
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
                      {!isSystem ? (
                        <span className="ms-2 font-medium normal-case tracking-normal text-timber-500">
                          · {parent.audience}
                        </span>
                      ) : null}
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
                  {!isSystem ? (
                    <button
                      type="button"
                      className="btn-ghost btn-sm text-red-600"
                      onClick={() => remove(parent)}
                      title="Delete category"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </div>

              {kids.length > 0 ? (
                <DragSortList
                  items={kids}
                  onReorder={saveOrder}
                  itemLabel="subcategory"
                  className="px-4"
                  renderItem={(c) => (
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-timber-900">{c.name}</p>
                        <p className="mt-0.5 text-xs text-timber-500">
                          <span className="font-mono">{c.slug}</span> · {c.productCount ?? 0} product
                          {(c.productCount ?? 0) === 1 ? '' : 's'}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          className="btn-ghost btn-sm"
                          onClick={() => openEditSub(c)}
                          title="Edit subcategory"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="btn-ghost btn-sm text-red-600"
                          onClick={() => remove(c)}
                          title="Delete subcategory"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                />
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
            No categories yet.{' '}
            <button type="button" className="font-medium text-timber-800 underline" onClick={openCreateCategory}>
              Add your first category
            </button>
          </div>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={modalTitle}>
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
                <label className="label">Audience</label>
                <select
                  required
                  className="input"
                  value={form.audience}
                  onChange={(e) => setForm({ ...form, audience: e.target.value })}
                  disabled={editing && SYSTEM_ROOTS.has(editing.slug)}
                >
                  {AUDIENCES.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-timber-400">
                  Used for product filtering. For Men / Women / Kids, name the category to match
                  (or use those exact names).
                </p>
              </div>
              {!(editing && SYSTEM_ROOTS.has(editing.slug)) ? (
                <div>
                  <label className="label">Slug (optional)</label>
                  <input
                    className="input font-mono text-sm"
                    value={form.slug || ''}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    placeholder="auto from name"
                  />
                </div>
              ) : null}
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
