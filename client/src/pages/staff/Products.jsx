import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { ChevronDown, Download, FolderOpen, LayoutGrid, Loader2, Minus, Plus, Pencil, Search, Trash2, Upload } from 'lucide-react';
import api from '../../api/axios';
import Modal from '../../components/ui/Modal';
import BulkUploadModal from '../../components/staff/BulkUploadModal';
import { AUDIENCES, formatMoney, getImageUrl, asArray, totalStock, audienceLabel, categoryLabel } from '../../utils/helpers';
import { downloadProductWorkbook } from '../../utils/productExport';

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
  status: 'active',
  categoryId: '',
  photos: '',
  driveFolder: '',
  colors: '',
  photoByColor: {},
  sizeRows: DEFAULT_SIZE_ROWS.map((row) => ({ ...row })),
  variantRows: [],
  isSaleActive: false,
  salePrice: '',
  saleQtyLimit: '',
  itemCode: '',
  cost: '',
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

const variantRowsFromProduct = (p) => {
  if (!Array.isArray(p.variants) || !p.variants.length) return [];
  return p.variants.map((v) => ({
    itemCode: v.itemCode || '',
    color: v.color || '',
    size: v.size || '',
    stock: v.stock ?? 0,
    price: v.price ?? '',
    cost: v.cost ?? '',
  }));
};

const queueKey = (id, color, size) => `${id}::${color || ''}::${size || ''}`;

export default function StaffProducts() {
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [loadingFolder, setLoadingFolder] = useState(false);
  const [categories, setCategories] = useState([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set());
  const stockQueue = useRef({});

  const load = () => api.get('/products').then((r) => setProducts(asArray(r.data)));
  useEffect(() => {
    load();
    api.get('/categories').then((r) => setCategories(asArray(r.data))).catch(() => {});
  }, []);

  const toggleExpanded = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return products;
    return products.filter((p) => {
      const childCodes = (p.variants || []).map((v) => v.itemCode).filter(Boolean);
      return [
        p.name,
        p.itemCode,
        p.description,
        p.type,
        p.status,
        audienceLabel(p.audience),
        categoryLabel(p),
        ...(p.colors || []),
        ...childCodes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [products, q]);

  const flushStock = async (id, color, size) => {
    const key = queueKey(id, color, size);
    const q = stockQueue.current[key];
    if (!q || q.inFlight || q.pending === 0) return;

    q.inFlight = true;
    const delta = q.pending;
    q.pending = 0;

    try {
      const { data } = await api.patch(`/products/${id}/stock`, {
        delta,
        ...(color ? { color } : {}),
        ...(size ? { size } : {}),
      });
      const stillPending = stockQueue.current[key]?.pending || 0;
      setProducts((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          if (color && size && p.variants?.length) {
            const variants = p.variants.map((row) =>
              row.color === color && row.size === size
                ? { ...row, stock: Math.max(0, data.stock + stillPending) }
                : row
            );
            return {
              ...p,
              variants,
              stock: variants.reduce((n, row) => n + row.stock, 0),
            };
          }
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
        if (queue.pending !== 0) flushStock(id, color, size);
      }
    }
  };

  const adjust = (id, delta, color, size) => {
    let applied = true;
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        if (color && size && p.variants?.length) {
          const current = p.variants.find(
            (row) => row.color === color && row.size === size
          );
          if (delta < 0 && (!current || current.stock <= 0)) {
            applied = false;
            return p;
          }
          const variants = p.variants.map((row) =>
            row.color === color && row.size === size
              ? { ...row, stock: Math.max(0, row.stock + delta) }
              : row
          );
          return {
            ...p,
            variants,
            stock: variants.reduce((n, row) => n + row.stock, 0),
          };
        }
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

    const key = queueKey(id, color, size);
    if (!stockQueue.current[key]) {
      stockQueue.current[key] = { pending: 0, inFlight: false, timer: null };
    }
    const queue = stockQueue.current[key];
    queue.pending += delta;

    clearTimeout(queue.timer);
    queue.timer = setTimeout(() => flushStock(id, color, size), 400);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...empty,
      sizeRows: DEFAULT_SIZE_ROWS.map((row) => ({ ...row })),
      variantRows: [],
    });
    setOpen(true);
  };

  const openEdit = (p) => {
    const map = {};
    if (p.photoByColor && typeof p.photoByColor === 'object') {
      Object.entries(p.photoByColor).forEach(([color, value]) => {
        map[color] = Array.isArray(value) ? value[0] || '' : value || '';
      });
    }
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description,
      price: p.price,
      type: p.type,
      audience: p.audience || 'men',
      status: p.status === 'draft' ? 'draft' : 'active',
      categoryId: p.category?.id || p.categoryId || '',
      photos: (p.photos || []).join('\n'),
      driveFolder: '',
      colors: (p.colors || []).join(', '),
      photoByColor: map,
      sizeRows: sizeRowsFromProduct(p),
      variantRows: variantRowsFromProduct(p),
      isSaleActive: p.isSaleActive,
      salePrice: p.salePrice ?? '',
      saleQtyLimit: p.saleQtyLimit ?? '',
      itemCode: p.itemCode || '',
      cost: p.cost ?? '',
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
    const variants = (form.variantRows || [])
      .map((row) => ({
        itemCode: String(row.itemCode || '').trim(),
        color: String(row.color || '').trim(),
        size: String(row.size || '').trim(),
        stock: Math.max(0, Number(row.stock) || 0),
        price: row.price === '' || row.price == null ? null : Number(row.price),
        cost: row.cost === '' || row.cost == null ? null : Number(row.cost),
      }))
      .filter((row) => row.color && row.size && row.itemCode);
    const sizeStocks = form.sizeRows
      .map((row) => ({
        size: String(row.size || '').trim(),
        stock: Math.max(0, Number(row.stock) || 0),
      }))
      .filter((row) => row.size);
    if (!variants.length && !sizeStocks.length) {
      return toast.error('Add at least one color/size variant or size row');
    }
    setSaving(true);
    const links = [
      ...form.photos.split(/[\n,]/).map((s) => s.trim()).filter(Boolean),
      ...(form.driveFolder.trim() ? [form.driveFolder.trim()] : []),
    ];
    const colors = form.colors.split(',').map((s) => s.trim()).filter(Boolean);
    const photoByColor = {};
    colors.forEach((c) => {
      const url = String(form.photoByColor?.[c] || '').trim();
      if (url) photoByColor[c] = url;
    });
    const payload = {
      name: form.name,
      description: form.description,
      price: Number(form.price),
      type: form.type,
      audience: form.audience,
      status: form.status === 'draft' ? 'draft' : 'active',
      categoryId: form.categoryId || null,
      photos: links,
      colors,
      photoByColor,
      ...(variants.length ? { variants } : { sizeStocks }),
      isSaleActive: Boolean(form.isSaleActive),
      salePrice: form.salePrice === '' ? null : Number(form.salePrice),
      saleQtyLimit: form.saleQtyLimit === '' ? null : Number(form.saleQtyLimit),
      itemCode: form.itemCode.trim(),
      cost: form.cost === '' ? null : Number(form.cost),
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

  const exportSheet = async () => {
    setExporting(true);
    try {
      await downloadProductWorkbook(products);
    } catch {
      toast.error('Could not export the sheet');
    } finally {
      setExporting(false);
    }
  };

  const previewPhotos = form.photos
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8);

  const formTotalStock = (form.variantRows?.length
    ? form.variantRows
    : form.sizeRows
  ).reduce((n, row) => n + (Number(row.stock) || 0), 0);

  const updateVariantRow = (index, field, value) => {
    setForm((f) => ({
      ...f,
      variantRows: f.variantRows.map((row, i) =>
        i === index ? { ...row, [field]: value } : row
      ),
    }));
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Products</h1>
          <p className="page-subtitle">
            Manage catalog, stock, colors, and Drive photo folders
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/staff/website/shop" className="btn-outline">
            <LayoutGrid className="h-4 w-4" />
            Shop Control
          </Link>
          <button type="button" className="btn-outline" onClick={exportSheet} disabled={exporting || !products.length}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {exporting ? 'Exporting…' : 'Export Excel'}
          </button>
          <button type="button" className="btn-outline" onClick={() => setBulkOpen(true)}>
            <Upload className="h-4 w-4" />
            Bulk upload
          </button>
          <button type="button" className="btn-wheat" onClick={openCreate}>
            Add product
          </button>
        </div>
      </div>

      <div className="table-wrapper">
        <div className="flex flex-wrap items-center gap-2 border-b border-timber-100 px-3 py-2.5">
          <div className="relative min-w-[180px] flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-timber-400" />
            <input
              className="w-full rounded-lg border border-timber-200 bg-white py-2 pl-9 pr-3 text-sm"
              placeholder="Search name or item ID"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search products"
            />
          </div>
          <p className="ml-auto text-xs text-timber-400 tabular-nums">
            {filtered.length}
            {q.trim() ? ` of ${products.length}` : ''} product{filtered.length === 1 ? '' : 's'}
          </p>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Status</th>
              <th>Dept</th>
              <th>Price</th>
              <th>Cost</th>
              <th>Stock</th>
              <th>Sale</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="py-10 text-center text-sm text-timber-500">
                  {q.trim() ? 'No products match your search.' : 'No products yet.'}
                </td>
              </tr>
            )}
            {filtered.map((p) => {
              const hasVariants = p.variants?.length > 0;
              const legacySizes = !hasVariants && p.sizeStocks?.length ? p.sizeStocks : [];
              const isOpen = expanded.has(p.id);
              const canExpand = hasVariants || legacySizes.length > 0;
              const isDraft = p.status === 'draft';
              return (
                <Fragment key={p.id}>
                  <tr
                    className={`${isDraft ? 'bg-timber-50/70' : ''} ${canExpand ? 'cursor-pointer' : ''}`}
                    onClick={() => canExpand && toggleExpanded(p.id)}
                  >
                    <td>
                      <div className="flex items-center gap-3">
                        {canExpand ? (
                          <ChevronDown
                            className={`h-4 w-4 shrink-0 text-timber-400 transition ${
                              isOpen ? 'rotate-0' : '-rotate-90'
                            }`}
                          />
                        ) : (
                          <span className="inline-block w-4" />
                        )}
                        <img
                          src={getImageUrl(p.photos?.[0])}
                          alt=""
                          className="w-10 h-10 rounded object-cover bg-timber-100"
                        />
                        <span>
                          <span className="block font-medium">{p.name}</span>
                          {p.itemCode ? (
                            <span className="mt-0.5 block font-mono text-[11px] tracking-wide text-timber-400">
                              {p.itemCode}
                              {hasVariants ? ` · ${p.variants.length} children` : ''}
                            </span>
                          ) : null}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`inline-flex rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                          isDraft
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {isDraft ? 'Draft' : 'Active'}
                      </span>
                    </td>
                    <td>
                      {audienceLabel(p.audience)}
                      {categoryLabel(p) ? ` · ${categoryLabel(p)}` : ''}
                    </td>
                    <td>{formatMoney(p.price)}</td>
                    <td>{p.cost != null && p.cost !== '' ? formatMoney(p.cost) : '—'}</td>
                    <td>
                      <span className="font-semibold tabular-nums">{totalStock(p)}</span>
                      {canExpand ? (
                        <span className="ml-1 text-[10px] uppercase tracking-wide text-timber-400">
                          total
                        </span>
                      ) : null}
                    </td>
                    <td>
                      {p.isSaleActive ? formatMoney(p.salePrice) : '—'}
                      {p.isSaleActive && p.saleQtyLimit != null && (
                        <span className="block text-[10px] uppercase tracking-wide text-timber-400">
                          {p.saleQtySold || 0}/{p.saleQtyLimit} sold
                        </span>
                      )}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
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
                  {isOpen &&
                    hasVariants &&
                    p.variants.map((row) => (
                      <tr key={`${p.id}-${row.id || row.itemCode}`} className="bg-timber-50/40">
                        <td colSpan={2}>
                          <div className="flex items-center gap-3 pl-10">
                            <span className="font-mono text-[11px] font-medium tracking-wide text-timber-700">
                              {row.itemCode || '—'}
                            </span>
                            <span className="text-sm text-timber-600">
                              {row.color} / {row.size}
                            </span>
                          </div>
                        </td>
                        <td className="text-xs text-timber-400">Child</td>
                        <td className="text-sm tabular-nums text-timber-700">
                          {row.price != null ? formatMoney(row.price) : (
                            <span className="text-timber-400">Parent</span>
                          )}
                        </td>
                        <td className="text-sm tabular-nums text-timber-500">
                          {row.cost != null ? formatMoney(row.cost) : '—'}
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              className="btn-outline btn-sm !px-2"
                              onClick={() => adjust(p.id, -1, row.color, row.size)}
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-8 text-center font-semibold tabular-nums">
                              {row.stock}
                            </span>
                            <button
                              type="button"
                              className="btn-outline btn-sm !px-2"
                              onClick={() => adjust(p.id, 1, row.color, row.size)}
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td colSpan={2} />
                      </tr>
                    ))}
                  {isOpen &&
                    !hasVariants &&
                    legacySizes.map((row) => (
                      <tr key={`${p.id}-${row.size}`} className="bg-timber-50/40">
                        <td colSpan={2}>
                          <div className="pl-10 text-sm text-timber-600">Size {row.size}</div>
                        </td>
                        <td className="text-xs text-timber-400">Size</td>
                        <td colSpan={2} />
                        <td>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              className="btn-outline btn-sm !px-2"
                              onClick={() => adjust(p.id, -1, undefined, row.size)}
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-8 text-center font-semibold tabular-nums">
                              {row.stock}
                            </span>
                            <button
                              type="button"
                              className="btn-outline btn-sm !px-2"
                              onClick={() => adjust(p.id, 1, undefined, row.size)}
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td colSpan={2} />
                      </tr>
                    ))}
                </Fragment>
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
            <div>
              <label className="label" htmlFor="item-code">Item ID</label>
              <input
                id="item-code"
                className="input font-mono uppercase"
                placeholder={editing ? 'FF-10001' : 'Leave blank to assign one'}
                required={Boolean(editing)}
                maxLength={32}
                value={form.itemCode}
                onChange={(e) => setForm({ ...form, itemCode: e.target.value })}
              />
              <p className="mt-1 text-xs text-timber-500">
                Letters, numbers, and hyphens. Not shown on the website.
              </p>
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
                min="0"
                step="0.01"
                className="input"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="item-cost">Cost (EGP)</label>
              <input
                id="item-cost"
                type="number"
                min="0"
                step="0.01"
                className="input"
                placeholder="Optional"
                value={form.cost}
                onChange={(e) => setForm({ ...form, cost: e.target.value })}
              />
              <p className="mt-1 text-xs text-timber-500">What this item costs you. Not shown on the website.</p>
            </div>
            <div>
              <label className="label">Status</label>
              <select
                className="input"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="active">Active</option>
                <option value="draft">Draft</option>
              </select>
              <p className="mt-1 text-[11px] text-timber-400">
                Draft items stay in staff only and are hidden on the storefront.
              </p>
            </div>
            <div>
              <label className="label">Category</label>
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
                  .filter(
                    (c) =>
                      c.audience === form.audience &&
                      c.parentId &&
                      !['men', 'women', 'boys', 'girls', 'baby'].includes(c.slug)
                  )
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

            {form.variantRows?.length > 0 ? (
              <div className="md:col-span-2 rounded-xl border border-timber-100 bg-cream/50 p-4 space-y-3">
                <div>
                  <label className="label !mb-0">Child variants (color × size)</label>
                  <p className="mt-1 text-xs text-timber-400">
                    Storefront shows the parent; each child can have its own price, cost, and stock.
                  </p>
                </div>
                <div className="max-h-72 space-y-2 overflow-y-auto">
                  {form.variantRows.map((row, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-[7rem_1fr_4rem_4.5rem_5rem_5rem] gap-2"
                    >
                      <input
                        className="input font-mono text-xs"
                        value={row.itemCode}
                        onChange={(e) => updateVariantRow(index, 'itemCode', e.target.value)}
                        placeholder="Item ID"
                        required
                      />
                      <input
                        className="input"
                        value={row.color}
                        onChange={(e) => updateVariantRow(index, 'color', e.target.value)}
                        placeholder="Colour"
                        required
                      />
                      <input
                        className="input"
                        value={row.size}
                        onChange={(e) => updateVariantRow(index, 'size', e.target.value)}
                        placeholder="Size"
                        required
                      />
                      <input
                        type="number"
                        min="0"
                        className="input"
                        value={row.stock}
                        onChange={(e) => updateVariantRow(index, 'stock', e.target.value)}
                        placeholder="Qty"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="input"
                        value={row.price}
                        onChange={(e) => updateVariantRow(index, 'price', e.target.value)}
                        placeholder="Price"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="input"
                        value={row.cost}
                        onChange={(e) => updateVariantRow(index, 'cost', e.target.value)}
                        placeholder="Cost"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
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
            )}

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

            {form.colors
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean).length > 0 &&
              previewPhotos.length > 0 && (
                <div className="md:col-span-2 rounded-xl border border-timber-100 bg-cream/50 p-4 space-y-3">
                  <div>
                    <label className="label !mb-0">Colour hero photos</label>
                    <p className="mt-1 text-xs text-timber-400">
                      Map each colour to a photo from the gallery. Shoppers see that image when they
                      pick the colour.
                    </p>
                  </div>
                  <div className="space-y-2">
                    {form.colors
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .map((colorName) => (
                        <div
                          key={colorName}
                          className="grid grid-cols-[7rem_1fr] items-center gap-3 sm:grid-cols-[9rem_1fr]"
                        >
                          <span className="truncate text-sm font-medium text-timber-800">
                            {colorName}
                          </span>
                          <select
                            className="input"
                            value={form.photoByColor?.[colorName] || ''}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                photoByColor: { ...f.photoByColor, [colorName]: e.target.value },
                              }))
                            }
                          >
                            <option value="">Default gallery order</option>
                            {previewPhotos.map((url, i) => (
                              <option key={`${url}-${i}`} value={url}>
                                Photo {i + 1}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                  </div>
                </div>
              )}

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
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Sale price</label>
                <input
                  type="number"
                  className="input"
                  value={form.salePrice}
                  onChange={(e) => setForm({ ...form, salePrice: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Sale stock (optional)</label>
                <input
                  type="number"
                  min={1}
                  className="input"
                  placeholder="No limit"
                  value={form.saleQtyLimit}
                  onChange={(e) => setForm({ ...form, saleQtyLimit: e.target.value })}
                />
              </div>
            </div>
            <p className="text-xs text-timber-500">
              Sale stock: only this many units sell at the sale price — after that the sale switches
              off automatically. The count restarts each time you switch the sale on.
              {editing && editing.saleQtyLimit != null && (
                <span className="mt-1 block font-medium text-timber-700">
                  {editing.saleQtySold || 0} of {editing.saleQtyLimit} sold at the sale price
                  {!editing.isSaleActive && (editing.saleQtySold || 0) >= editing.saleQtyLimit
                    ? ' — sale ended automatically'
                    : ''}
                </span>
              )}
            </p>
          </div>
          <button type="submit" className="btn-wheat w-full" disabled={saving || loadingFolder}>
            {saving ? 'Saving…' : 'Save product'}
          </button>
        </form>
      </Modal>

      <BulkUploadModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onComplete={load}
      />
    </>
  );
}
