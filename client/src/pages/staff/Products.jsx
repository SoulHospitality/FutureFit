import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { FolderOpen, Loader2, Minus, Plus, Pencil, Trash2 } from 'lucide-react';
import api from '../../api/axios';
import Modal from '../../components/ui/Modal';
import { AUDIENCES, formatMoney, getImageUrl, asArray, totalStock, audienceLabel, categoryLabel } from '../../utils/helpers';

const DEFAULT_SIZE_ROWS = [
  { size: 'S', stock: 0 },
  { size: 'M', stock: 0 },
  { size: 'L', stock: 0 },
  { size: 'XL', stock: 0 },
];

const empty = {
  name: '',
  description: '',
  price: '',
  type: 'boxers',
  audience: 'men',
  categoryId: '',
  photos: '',
  driveFolder: '',
  colors: '',
  sizeRows: DEFAULT_SIZE_ROWS.map((row) => ({ ...row })),
  isSaleActive: false,
  salePrice: '',
};

const sizeRowsFromProduct = (p) => {
  if (Array.isArray(p.sizeStocks) && p.sizeStocks.length) {
    return p.sizeStocks.map((row) => ({ size: row.size, stock: row.stock }));
  }
  const sizes = p.sizes || [];
  if (!sizes.length) return DEFAULT_SIZE_ROWS.map((row) => ({ ...row }));
  const total = Number(p.stock) || 0;
  const base = Math.floor(total / sizes.length);
  const remainder = total % sizes.length;
  return sizes.map((size, i) => ({
    size,
    stock: base + (i < remainder ? 1 : 0),
  }));
};

const queueKey = (id, size) => `${id}::${size || ''}`;

export default function StaffProducts() {
  const [products, setProducts] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [loadingFolder, setLoadingFolder] = useState(false);
  const [categories, setCategories] = useState([]);
  const stockQueue = useRef({});

  const load = () => api.get('/products').then((r) => setProducts(asArray(r.data)));
  useEffect(() => {
    load();
    api.get('/categories').then((r) => setCategories(asArray(r.data))).catch(() => {});
  }, []);

  const flushStock = async (id, size) => {
    const key = queueKey(id, size);
    const q = stockQueue.current[key];
    if (!q || q.inFlight || q.pending === 0) return;

    q.inFlight = true;
    const delta = q.pending;
    q.pending = 0;

    try {
      const { data } = await api.patch(`/products/${id}/stock`, {
        delta,
        ...(size ? { size } : {}),
      });
      const stillPending = stockQueue.current[key]?.pending || 0;
      setProducts((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          if (size && p.sizeStocks?.length) {
            const sizeStocks = p.sizeStocks.map((row) =>
              row.size === size
                ? { ...row, stock: Math.max(0, data.stock + stillPending) }
                : row
            );
            return {
              ...p,
              sizeStocks,
              stock: sizeStocks.reduce((n, row) => n + row.stock, 0),
            };
          }
          return { ...p, stock: Math.max(0, data.stock + stillPending) };
        })
      );
    } catch (err) {
      toast.error(err.response?.data?.message || 'Stock update failed');
      if (stockQueue.current[key]) stockQueue.current[key].pending = 0;
      await load();
    } finally {
      const queue = stockQueue.current[key];
      if (queue) {
        queue.inFlight = false;
        if (queue.pending !== 0) flushStock(id, size);
      }
    }
  };

  const adjust = (id, delta, size) => {
    let applied = true;
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        if (size && p.sizeStocks?.length) {
          const current = p.sizeStocks.find((row) => row.size === size);
          if (delta < 0 && (!current || current.stock <= 0)) {
            applied = false;
            return p;
          }
          const sizeStocks = p.sizeStocks.map((row) =>
            row.size === size ? { ...row, stock: Math.max(0, row.stock + delta) } : row
          );
          return {
            ...p,
            sizeStocks,
            stock: sizeStocks.reduce((n, row) => n + row.stock, 0),
          };
        }
        if (delta < 0 && p.stock <= 0) {
          applied = false;
          return p;
        }
        return { ...p, stock: Math.max(0, p.stock + delta) };
      })
    );
    if (!applied) return;

    const key = queueKey(id, size);
    if (!stockQueue.current[key]) {
      stockQueue.current[key] = { pending: 0, inFlight: false, timer: null };
    }
    const queue = stockQueue.current[key];
    queue.pending += delta;

    clearTimeout(queue.timer);
    queue.timer = setTimeout(() => flushStock(id, size), 400);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...empty,
      sizeRows: DEFAULT_SIZE_ROWS.map((row) => ({ ...row })),
    });
    setOpen(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description,
      price: p.price,
      type: p.type,
      audience: p.audience || 'men',
      categoryId: p.category?.id || p.categoryId || '',
      photos: (p.photos || []).join('\n'),
      driveFolder: '',
      colors: (p.colors || []).join(', '),
      sizeRows: sizeRowsFromProduct(p),
      isSaleActive: p.isSaleActive,
      salePrice: p.salePrice ?? '',
    });
    setOpen(true);
  };

  const updateSizeRow = (index, field, value) => {
    setForm((f) => ({
      ...f,
      sizeRows: f.sizeRows.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    }));
  };

  const addSizeRow = () => {
    setForm((f) => ({ ...f, sizeRows: [...f.sizeRows, { size: '', stock: 0 }] }));
  };

  const removeSizeRow = (index) => {
    setForm((f) => ({
      ...f,
      sizeRows: f.sizeRows.length <= 1 ? f.sizeRows : f.sizeRows.filter((_, i) => i !== index),
    }));
  };

  const loadDriveFolder = async () => {
    const folder = form.driveFolder.trim();
    if (!folder) return toast.error('Paste a Google Drive folder link first');
    setLoadingFolder(true);
    try {
      const { data } = await api.post('/products/resolve-photos', { links: [folder] });
      const existing = form.photos
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const merged = [...new Set([...existing, ...data.photos])];
      setForm((f) => ({ ...f, photos: merged.join('\n') }));
      toast.success(`Loaded ${data.count} image${data.count === 1 ? '' : 's'} from Drive`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not read Drive folder');
    } finally {
      setLoadingFolder(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    const sizeStocks = form.sizeRows
      .map((row) => ({
        size: String(row.size || '').trim(),
        stock: Math.max(0, Number(row.stock) || 0),
      }))
      .filter((row) => row.size);
    if (!sizeStocks.length) {
      return toast.error('Add at least one size with a name');
    }
    setSaving(true);
    const links = [
      ...form.photos.split(/[\n,]/).map((s) => s.trim()).filter(Boolean),
      ...(form.driveFolder.trim() ? [form.driveFolder.trim()] : []),
    ];
    const payload = {
      name: form.name,
      description: form.description,
      price: Number(form.price),
      type: form.type,
      audience: form.audience,
      categoryId: form.categoryId || null,
      photos: links,
      colors: form.colors.split(',').map((s) => s.trim()).filter(Boolean),
      sizeStocks,
      isSaleActive: Boolean(form.isSaleActive),
      salePrice: form.salePrice === '' ? null : Number(form.salePrice),
    };
    try {
      if (editing) await api.put(`/products/${editing.id}`, payload);
      else await api.post('/products', payload);
      toast.success(editing ? 'Product updated' : 'Product created');
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    await api.delete(`/products/${id}`);
    toast.success('Deleted');
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const previewPhotos = form.photos
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8);

  const formTotalStock = form.sizeRows.reduce((n, row) => n + (Number(row.stock) || 0), 0);

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Products</h1>
          <p className="page-subtitle">
            Manage catalog, stock, colors, and Drive photo folders
          </p>
        </div>
        <button type="button" className="btn-wheat" onClick={openCreate}>
          Add product
        </button>
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Dept</th>
              <th>Price</th>
              <th>Stock by size</th>
              <th>Sale</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const rows = p.sizeStocks?.length
                ? p.sizeStocks
                : [{ size: '', stock: p.stock }];
              return (
                <tr key={p.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <img
                        src={getImageUrl(p.photos?.[0])}
                        alt=""
                        className="w-10 h-10 rounded object-cover bg-timber-100"
                      />
                      <span className="font-medium">{p.name}</span>
                    </div>
                  </td>
                  <td>
                  {audienceLabel(p.audience)}
                  {categoryLabel(p) ? ` · ${categoryLabel(p)}` : ''}
                </td>
                  <td>{formatMoney(p.price)}</td>
                  <td>
                    <div className="space-y-1">
                      {rows.map((row) => (
                        <div key={row.size || 'total'} className="flex items-center gap-1">
                          {row.size ? (
                            <span className="w-10 shrink-0 text-xs font-medium text-timber-500">
                              {row.size}
                            </span>
                          ) : null}
                          <button
                            type="button"
                            className="btn-outline btn-sm !px-2"
                            onClick={() => adjust(p.id, -1, row.size || undefined)}
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-8 text-center font-semibold tabular-nums">
                            {row.stock}
                          </span>
                          <button
                            type="button"
                            className="btn-outline btn-sm !px-2"
                            onClick={() => adjust(p.id, 1, row.size || undefined)}
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {p.sizeStocks?.length > 1 && (
                        <p className="text-[10px] uppercase tracking-wide text-timber-400">
                          Total {totalStock(p)}
                        </p>
                      )}
                    </div>
                  </td>
                  <td>{p.isSaleActive ? formatMoney(p.salePrice) : '—'}</td>
                  <td>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="btn-ghost btn-sm"
                        onClick={() => openEdit(p)}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        className="btn-ghost btn-sm text-red-600"
                        onClick={() => remove(p.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit product' : 'New product'}
        wide
      >
        <form onSubmit={save} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">Name</label>
              <input
                required
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Description</label>
              <textarea
                required
                rows={3}
                className="input"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Price (EGP)</label>
              <input
                required
                type="number"
                className="input"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Department</label>
              <select
                className="input"
                value={form.audience}
                onChange={(e) =>
                  setForm({ ...form, audience: e.target.value, categoryId: '' })
                }
              >
                {AUDIENCES.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Subcategory</label>
              <select
                className="input"
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              >
                <option value="">Select…</option>
                {categories
                  .filter((c) => c.audience === form.audience)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="label">Colors (comma-separated)</label>
              <input
                className="input"
                value={form.colors}
                onChange={(e) => setForm({ ...form, colors: e.target.value })}
                placeholder="Wheat, Black, Brown"
              />
            </div>
            <div className="flex items-end text-sm text-timber-500">
              Total stock: <span className="ms-1 font-semibold tabular-nums text-timber-800">{formTotalStock}</span>
            </div>

            <div className="md:col-span-2 rounded-xl border border-timber-100 bg-cream/50 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <label className="label !mb-0">Sizes & stock</label>
                  <p className="mt-1 text-xs text-timber-400">
                    Each size has its own inventory. Sold-out sizes are hidden from checkout.
                  </p>
                </div>
                <button type="button" className="btn-outline btn-sm" onClick={addSizeRow}>
                  <Plus className="w-3 h-3" />
                  Add size
                </button>
              </div>
              <div className="space-y-2">
                {form.sizeRows.map((row, index) => (
                  <div key={index} className="grid grid-cols-[1fr_7rem_auto] gap-2">
                    <input
                      className="input"
                      value={row.size}
                      onChange={(e) => updateSizeRow(index, 'size', e.target.value)}
                      placeholder="Size (S, M, 41…)"
                      required
                    />
                    <input
                      type="number"
                      min="0"
                      className="input"
                      value={row.stock}
                      onChange={(e) => updateSizeRow(index, 'stock', e.target.value)}
                      placeholder="Qty"
                    />
                    <button
                      type="button"
                      className="btn-ghost btn-sm text-red-600"
                      onClick={() => removeSizeRow(index)}
                      disabled={form.sizeRows.length <= 1}
                      aria-label="Remove size"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="md:col-span-2 rounded-xl border border-timber-100 bg-cream/50 p-4 space-y-3">
              <div>
                <label className="label">Google Drive folder link</label>
                <div className="flex gap-2">
                  <input
                    className="input font-mono text-xs"
                    value={form.driveFolder}
                    onChange={(e) => setForm({ ...form, driveFolder: e.target.value })}
                    placeholder="https://drive.google.com/drive/folders/..."
                  />
                  <button
                    type="button"
                    className="btn-dark btn-sm whitespace-nowrap"
                    onClick={loadDriveFolder}
                    disabled={loadingFolder}
                  >
                    {loadingFolder ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FolderOpen className="w-4 h-4" />
                    )}
                    Load
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-timber-400">
                  Folder must be shared as “Anyone with the link”. All images inside are added
                  automatically on Load or Save.
                </p>
              </div>

              <div>
                <label className="label">Photo URLs (optional extras, one per line)</label>
                <textarea
                  rows={3}
                  className="input font-mono text-xs"
                  value={form.photos}
                  onChange={(e) => setForm({ ...form, photos: e.target.value })}
                  placeholder="Individual Drive file links or direct image URLs"
                />
              </div>

              {previewPhotos.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {previewPhotos.map((url) => (
                    <img
                      key={url}
                      src={getImageUrl(url)}
                      alt=""
                      className="h-14 w-14 rounded-lg object-cover border border-timber-100 bg-timber-50"
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="sale"
                checked={form.isSaleActive}
                onChange={(e) => setForm({ ...form, isSaleActive: e.target.checked })}
              />
              <label htmlFor="sale" className="text-sm">
                Sale active
              </label>
            </div>
            <div>
              <label className="label">Sale price</label>
              <input
                type="number"
                className="input"
                value={form.salePrice}
                onChange={(e) => setForm({ ...form, salePrice: e.target.value })}
              />
            </div>
          </div>
          <button type="submit" className="btn-wheat w-full" disabled={saving || loadingFolder}>
            {saving ? 'Saving…' : 'Save product'}
          </button>
        </form>
      </Modal>
    </>
  );
}
