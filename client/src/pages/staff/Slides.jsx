import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { Monitor, Pencil, Smartphone, Trash2 } from 'lucide-react';
import api from '../../api/axios';
import Modal from '../../components/ui/Modal';
import DragSortList from '../../components/staff/DragSortList';
import {
  asArray,
  getImageUrl,
  SLIDE_DESKTOP_ASPECT,
  SLIDE_DESKTOP_SIZE,
  SLIDE_MOBILE_ASPECT,
  SLIDE_MOBILE_SIZE,
} from '../../utils/helpers';

const DEVICE_TABS = [
  {
    key: 'desktop',
    label: 'PC / Desktop',
    icon: Monitor,
    aspect: SLIDE_DESKTOP_ASPECT,
    size: SLIDE_DESKTOP_SIZE,
    hint: 'Landscape hero for laptops and large screens. Keep the subject in the center third.',
  },
  {
    key: 'mobile',
    label: 'Phone',
    icon: Smartphone,
    aspect: SLIDE_MOBILE_ASPECT,
    size: SLIDE_MOBILE_SIZE,
    hint: 'Portrait hero for phones. Design tall — top and bottom crop less than the sides.',
  },
];

const emptyForm = { title: '', description: '', imageUrl: '' };

/** Resize/compress before base64 upload so large phone photos don't hit the API body limit. */
function fileToSlideDataUri(file, device) {
  const maxW = device === 'mobile' ? 1440 : 2400;
  const maxH = device === 'mobile' ? 2560 : 1440;
  const quality = 0.85;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not load image'));
      img.onload = () => {
        let { width, height } = img;
        const scale = Math.min(1, maxW / width, maxH / height);
        width = Math.max(1, Math.round(width * scale));
        height = Math.max(1, Math.round(height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        try {
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch {
          resolve(reader.result);
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function StaffSlides({ embedded = false, onChanged } = {}) {
  const [device, setDevice] = useState('desktop');
  const [slides, setSlides] = useState([]);
  const [cloudOk, setCloudOk] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [fileData, setFileData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);

  const tab = DEVICE_TABS.find((t) => t.key === device) || DEVICE_TABS[0];
  const visible = useMemo(
    () => slides.filter((s) => (s.device || 'desktop') === device),
    [slides, device]
  );

  const load = () => {
    api.get('/slides').then((r) => setSlides(asArray(r.data)));
    api
      .get('/slides/cloudinary-status')
      .then((r) => setCloudOk(r.data.configured))
      .catch(() => {});
  };
  useEffect(() => {
    load();
  }, []);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      e.target.value = '';
      return;
    }
    try {
      const dataUri = await fileToSlideDataUri(file, device);
      setFileData(dataUri);
      toast.success('Image ready to save');
    } catch (err) {
      toast.error(err.message || 'Could not prepare image');
      setFileData(null);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFileData(null);
    setOpen(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    setForm({
      title: s.title || '',
      description: s.description || '',
      imageUrl: '',
    });
    setFileData(null);
    setOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!editing && !fileData && !form.imageUrl.trim()) {
      return toast.error('Upload an image or paste an image URL');
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        device,
        sortOrder: editing ? editing.sortOrder ?? visible.length : visible.length,
        ...(form.imageUrl.trim() ? { imageUrl: form.imageUrl.trim() } : {}),
        ...(fileData ? { imageData: fileData } : {}),
      };
      if (editing) await api.put(`/slides/${editing.id}`, payload);
      else await api.post('/slides', payload);
      toast.success(editing ? 'Slide updated' : `${tab.label} slide added`);
      setOpen(false);
      setForm(emptyForm);
      setFileData(null);
      load();
      onChanged?.();
    } catch (err) {
      const status = err.response?.status;
      toast.error(
        err.response?.data?.message ||
          (status === 413
            ? 'Image is too large — try a smaller file or paste a URL'
            : 'Failed — set Cloudinary keys or paste an image URL')
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    await api.delete(`/slides/${id}`);
    load();
    onChanged?.();
  };

  const onReorder = async (next) => {
    const others = slides.filter((s) => (s.device || 'desktop') !== device);
    setSlides([...others, ...next]);
    setSavingOrder(true);
    try {
      await Promise.all(next.map((s, i) => api.put(`/slides/${s.id}`, { sortOrder: i, device })));
      toast.success(`${tab.label} order saved`);
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save slide order');
      load();
    } finally {
      setSavingOrder(false);
    }
  };

  const thumbAspect = tab.aspect;
  const thumbClass =
    device === 'mobile'
      ? 'h-16 w-10 shrink-0 rounded object-cover bg-zinc-100'
      : 'h-14 w-24 shrink-0 rounded object-cover bg-zinc-100';

  return (
    <>
      <div className={`flex flex-wrap items-center justify-between gap-3 ${embedded ? 'mb-4' : 'mb-6'}`}>
        {!embedded ? (
          <div>
            <h1 className="page-title">Slideshows</h1>
            <p className="page-subtitle">
              Separate heroes for PC and phone — upload the right aspect for each
              {!cloudOk && (
                <span className="text-amber-600">
                  {' '}
                  — Cloudinary not configured; you can still paste a hosted image URL.
                </span>
              )}
            </p>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">
            Separate PC and phone heroes with recommended aspect ratios
            {!cloudOk && (
              <span className="text-amber-600"> — Cloudinary not configured; paste a URL instead.</span>
            )}
          </p>
        )}
        <button type="button" className="btn-wheat" onClick={openCreate}>
          Add {device === 'mobile' ? 'phone' : 'PC'} slide
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-1 border-b border-zinc-200">
        {DEVICE_TABS.map((t) => {
          const Icon = t.icon;
          const count = slides.filter((s) => (s.device || 'desktop') === t.key).length;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setDevice(t.key)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition ${
                device === t.key
                  ? 'border-b-2 border-zinc-900 text-zinc-900'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} />
              {t.label}
              <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] tabular-nums text-zinc-600">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mb-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
        <p className="text-sm font-medium text-zinc-900">
          Recommended: {tab.aspect} · {tab.size}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">{tab.hint}</p>
        <div
          className={`mt-3 overflow-hidden rounded-md border border-dashed border-zinc-300 bg-white ${
            device === 'mobile' ? 'mx-auto aspect-[9/16] w-16' : 'aspect-video max-w-xs'
          }`}
          aria-hidden
        >
          <div className="grid h-full place-items-center text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            {tab.aspect}
          </div>
        </div>
      </div>

      <div className="sp-card overflow-clip">
        {visible.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-zinc-400">
            No {tab.label.toLowerCase()} slides yet — add one at {tab.aspect}.
          </p>
        ) : (
          <DragSortList
            items={visible}
            onReorder={onReorder}
            disabled={savingOrder}
            itemLabel="slide"
            className="px-4"
            renderItem={(s) => (
              <div className="flex items-center gap-3">
                <img
                  src={getImageUrl(s.cloudinaryUrl, { width: 160, aspect: thumbAspect })}
                  alt={s.title}
                  className={thumbClass}
                  draggable={false}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900">{s.title}</p>
                  <p className="truncate text-xs text-zinc-500">{s.description}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button type="button" className="btn-ghost btn-sm" onClick={() => openEdit(s)}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="btn-ghost btn-sm text-red-600"
                    onClick={() => remove(s.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          />
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Edit ${tab.label} slide` : `New ${tab.label} slide`}
      >
        <form onSubmit={save} className="space-y-4">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
            Uploading for <span className="font-semibold text-zinc-900">{tab.label}</span> · aim for{' '}
            <span className="font-semibold text-zinc-900">
              {tab.aspect} ({tab.size})
            </span>
          </div>
          <div>
            <label className="label">Title</label>
            <input
              className="input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Description</label>
            <input
              className="input"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div>
            <label className="label">{editing ? 'Replace image (optional)' : 'Upload (Cloudinary)'}</label>
            <input type="file" accept="image/*" onChange={onFile} className="input" />
            {fileData ? (
              <img
                src={fileData}
                alt=""
                className={`mt-3 rounded-lg object-cover bg-zinc-100 ${
                  device === 'mobile' ? 'mx-auto aspect-[9/16] w-24' : 'aspect-video max-w-xs'
                }`}
              />
            ) : editing?.cloudinaryUrl ? (
              <img
                src={getImageUrl(editing.cloudinaryUrl, { width: 480, aspect: thumbAspect })}
                alt=""
                className={`mt-3 rounded-lg object-cover bg-zinc-100 ${
                  device === 'mobile' ? 'mx-auto aspect-[9/16] w-24' : 'aspect-video max-w-xs'
                }`}
              />
            ) : null}
            <p className="mt-1.5 text-xs text-zinc-500">
              Recommended:{' '}
              <span className="font-medium text-zinc-700">
                {tab.aspect}
              </span>{' '}
              ({tab.size}). {tab.hint}
            </p>
          </div>
          <div>
            <label className="label">Or image URL</label>
            <input
              className="input"
              value={form.imageUrl}
              onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              placeholder="https://…"
            />
          </div>
          <button type="submit" className="btn-wheat w-full" disabled={saving}>
            {saving ? 'Saving…' : 'Save slide'}
          </button>
        </form>
      </Modal>
    </>
  );
}
