import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Pencil, Trash2 } from 'lucide-react';
import api from '../../api/axios';
import Modal from '../../components/ui/Modal';
import DragSortList from '../../components/staff/DragSortList';
import { getImageUrl, asArray } from '../../utils/helpers';

const emptyForm = { title: '', description: '', imageUrl: '' };

export default function StaffSlides() {
  const [slides, setSlides] = useState([]);
  const [cloudOk, setCloudOk] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [fileData, setFileData] = useState(null);
  const [savingOrder, setSavingOrder] = useState(false);

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

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setFileData(reader.result);
    reader.readAsDataURL(file);
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
    try {
      const payload = {
        title: form.title,
        description: form.description,
        sortOrder: editing ? editing.sortOrder ?? slides.length : slides.length,
        imageUrl: form.imageUrl || undefined,
        imageData: fileData || undefined,
      };
      if (editing) await api.put(`/slides/${editing.id}`, payload);
      else await api.post('/slides', payload);
      toast.success(editing ? 'Slide updated' : 'Slide added');
      setOpen(false);
      setForm(emptyForm);
      setFileData(null);
      load();
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          'Failed — set Cloudinary keys or paste an image URL'
      );
    }
  };

  const remove = async (id) => {
    await api.delete(`/slides/${id}`);
    load();
  };

  const onReorder = async (next) => {
    setSlides(next);
    setSavingOrder(true);
    try {
      await Promise.all(
        next.map((s, i) => api.put(`/slides/${s.id}`, { sortOrder: i }))
      );
      toast.success('Slide order saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save slide order');
      load();
    } finally {
      setSavingOrder(false);
    }
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="page-title">Slideshow</h1>
          <p className="page-subtitle">
            Homepage hero images via Cloudinary — drag to set order
            {!cloudOk && (
              <span className="text-amber-600">
                {' '}
                — Cloudinary not configured; you can still paste a hosted image URL.
              </span>
            )}
          </p>
        </div>
        <button type="button" className="btn-wheat" onClick={openCreate}>
          Add slide
        </button>
      </div>

      <div className="sp-card overflow-hidden">
        {slides.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-zinc-400">No slides yet</p>
        ) : (
          <DragSortList
            items={slides}
            onReorder={onReorder}
            disabled={savingOrder}
            className="px-4"
            renderItem={(s) => (
              <div className="flex items-center gap-3">
                <img
                  src={getImageUrl(s.cloudinaryUrl, { width: 160, aspect: '16:9' })}
                  alt={s.title}
                  className="h-14 w-24 shrink-0 rounded object-cover bg-zinc-100"
                  draggable={false}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900">{s.title}</p>
                  <p className="truncate text-xs text-zinc-500">{s.description}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => openEdit(s)}
                  >
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

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit slide' : 'New slide'}>
        <form onSubmit={save} className="space-y-4">
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
            <p className="mt-1.5 text-xs text-zinc-500">
              Recommended: <span className="font-medium text-zinc-700">16:9</span> landscape
              (e.g. 1920×1080). Keep the main subject centered — edges may crop on mobile.
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
          <button type="submit" className="btn-wheat w-full">
            Save slide
          </button>
        </form>
      </Modal>
    </>
  );
}
