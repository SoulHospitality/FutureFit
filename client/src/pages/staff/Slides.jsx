import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Pencil } from 'lucide-react';
import api from '../../api/axios';
import Modal from '../../components/ui/Modal';
import { getImageUrl, asArray } from '../../utils/helpers';

const emptyForm = { title: '', description: '', imageUrl: '', sortOrder: 0 };

export default function StaffSlides() {
  const [slides, setSlides] = useState([]);
  const [cloudOk, setCloudOk] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [fileData, setFileData] = useState(null);

  const load = () => {
    api.get('/slides').then((r) => setSlides(asArray(r.data)));
    api.get('/slides/cloudinary-status').then((r) => setCloudOk(r.data.configured)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

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
      sortOrder: s.sortOrder || 0,
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
        sortOrder: Number(form.sortOrder) || 0,
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
      toast.error(err.response?.data?.message || 'Failed — set Cloudinary keys or paste an image URL');
    }
  };

  const remove = async (id) => {
    await api.delete(`/slides/${id}`);
    load();
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Slideshow</h1>
          <p className="page-subtitle">
            Homepage hero images via Cloudinary
            {!cloudOk && (
              <span className="text-amber-600"> — Cloudinary not configured; you can still paste a hosted image URL.</span>
            )}
          </p>
        </div>
        <button type="button" className="btn-wheat" onClick={openCreate}>Add slide</button>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {slides.map((s) => (
          <div key={s.id} className="card !p-0 overflow-hidden">
            <img src={getImageUrl(s.cloudinaryUrl)} alt={s.title} className="h-40 w-full object-cover" />
            <div className="p-4">
              <h3 className="font-semibold">{s.title}</h3>
              <p className="text-sm text-timber-500 mt-1">{s.description}</p>
              <div className="mt-3 flex gap-2">
                <button type="button" className="btn-ghost btn-sm" onClick={() => openEdit(s)}>
                  <Pencil className="w-4 h-4" />
                  Edit
                </button>
                <button type="button" className="btn-ghost btn-sm text-red-600" onClick={() => remove(s.id)}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit slide' : 'New slide'}>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="label">Title</label>
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="label">Description</label>
            <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <label className="label">Sort order</label>
            <input type="number" className="input" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
          </div>
          <div>
            <label className="label">{editing ? 'Replace image (optional)' : 'Upload (Cloudinary)'}</label>
            <input type="file" accept="image/*" onChange={onFile} className="input" />
          </div>
          <div>
            <label className="label">Or image URL</label>
            <input className="input" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://…" />
          </div>
          <button type="submit" className="btn-wheat w-full">Save slide</button>
        </form>
      </Modal>
    </>
  );
}
