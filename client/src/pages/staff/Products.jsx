import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { FolderOpen, Loader2, Minus, Plus, Pencil, Trash2 } from 'lucide-react';
import api from '../../api/axios';
import Modal from '../../components/ui/Modal';
import { PRODUCT_TYPES, formatMoney, getImageUrl } from '../../utils/helpers';

const empty = {
  name: '',
  description: '',
  price: '',
  type: 'boxers',
  photos: '',
  driveFolder: '',
  colors: '',
  sizes: '',
  stock: 0,
  isSaleActive: false,
  salePrice: '',
};

export default function StaffProducts() {
  const [products, setProducts] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [loadingFolder, setLoadingFolder] = useState(false);
  // Batch stock deltas so rapid +/- taps stay instant and send one request
  const stockQueue = useRef({});

  const load = () => api.get('/products').then((r) => setProducts(r.data));
  useEffect(() => {
    load();
  }, []);

  const flushStock = async (id) => {
    const q = stockQueue.current[id];
    if (!q || q.inFlight || q.pending === 0) return;

    q.inFlight = true;
    const delta = q.pending;
    q.pending = 0;

    try {
      const { data } = await api.patch(`/products/${id}/stock`, { delta });
      // Re-apply any clicks made while this request was in flight so the
      // counter never jumps backwards.
      const stillPending = stockQueue.current[id]?.pending || 0;
      setProducts((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, stock: Math.max(0, data.stock + stillPending) } : p
        )
      );
    } catch (err) {
      toast.error(err.response?.data?.message || 'Stock update failed');
      if (stockQueue.current[id]) stockQueue.current[id].pending = 0;
      await load();
    } finally {
      const queue = stockQueue.current[id];
      if (queue) {
        queue.inFlight = false;
        if (queue.pending !== 0) flushStock(id);
      }
    }
  };

  const adjust = (id, delta) => {
    let applied = true;
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        if (delta < 0 && p.stock <= 0) {
          applied = false;
          return p;
        }
        return { ...p, stock: Math.max(0, p.stock + delta) };
      })
    );
    if (!applied) return;

    if (!stockQueue.current[id]) {
      stockQueue.current[id] = { pending: 0, inFlight: false, timer: null };
    }
    const queue = stockQueue.current[id];
    queue.pending += delta;

    // Collapse a burst of clicks into a single request
    clearTimeout(queue.timer);
    queue.timer = setTimeout(() => flushStock(id), 400);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description,
      price: p.price,
      type: p.type,
      photos: (p.photos || []).join('\n'),
      driveFolder: '',
      colors: (p.colors || []).join(', '),
      sizes: (p.sizes || []).join(', '),
      stock: p.stock,
      isSaleActive: p.isSaleActive,
      salePrice: p.salePrice ?? '',
    });
    setOpen(true);
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
      photos: links,
      colors: form.colors.split(',').map((s) => s.trim()).filter(Boolean),
      sizes: form.sizes.split(',').map((s) => s.trim()).filter(Boolean),
      stock: Number(form.stock) || 0,
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
              <th>Type</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Sale</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
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
                <td className="capitalize">{p.type.replace('_', ' ')}</td>
                <td>{formatMoney(p.price)}</td>
                <td>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="btn-outline btn-sm !px-2"
                      onClick={() => adjust(p.id, -1)}
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-8 text-center font-semibold tabular-nums">
                      {p.stock}
                    </span>
                    <button
                      type="button"
                      className="btn-outline btn-sm !px-2"
                      onClick={() => adjust(p.id, 1)}
                    >
                      <Plus className="w-3 h-3" />
                    </button>
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
            ))}
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
              <label className="label">Type</label>
              <select
                className="input"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                {PRODUCT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Stock</label>
              <input
                type="number"
                className="input"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
              />
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
            <div>
              <label className="label">Sizes (comma-separated)</label>
              <input
                className="input"
                value={form.sizes}
                onChange={(e) => setForm({ ...form, sizes: e.target.value })}
                placeholder="40, 41, 42, 43, 44"
              />
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
