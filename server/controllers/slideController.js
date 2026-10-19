const prisma = require('../lib/prisma');
const cache = require('../lib/cache');
const { uploadImage, isCloudinaryConfigured } = require('../utils/cloudinary');

const SLIDES_TTL_MS = 60_000;
const DEVICES = ['desktop', 'mobile'];

const normalizeDevice = (value) => {
  const d = String(value || 'desktop').toLowerCase();
  return DEVICES.includes(d) ? d : 'desktop';
};

const listSlides = async (req, res) => {
  try {
    const device = req.query.device ? normalizeDevice(req.query.device) : null;
    const cacheKey = device ? `slides:list:${device}` : 'slides:list';
    const { data: slides } = await cache.wrap(cacheKey, SLIDES_TTL_MS, () =>
      prisma.slide.findMany({
        where: device ? { device } : undefined,
        orderBy: [{ device: 'asc' }, { sortOrder: 'asc' }],
        select: {
          id: true,
          cloudinaryUrl: true,
          title: true,
          description: true,
          device: true,
          sortOrder: true,
        },
      })
    );
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
    res.json(slides);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const slideErrorMessage = (error) => {
  if (error?.type === 'entity.too.large' || error?.status === 413) {
    return 'Image is too large. Try a smaller file (under ~8MB) or paste a hosted image URL.';
  }
  if (/Cloudinary is not configured/i.test(error?.message || '')) {
    return 'Cloudinary is not configured. Paste a hosted image URL, or add CLOUDINARY_* env vars.';
  }
  return error?.message || 'Could not save slide';
};

const createSlide = async (req, res) => {
  try {
    const { title, description, sortOrder, imageUrl, imageData } = req.body;
    const device = normalizeDevice(req.body.device);
    let cloudinaryUrl = imageUrl;

    if (imageData) {
      cloudinaryUrl = await uploadImage(
        imageData,
        device === 'mobile' ? 'futurefit/slides/mobile' : 'futurefit/slides/desktop'
      );
    } else if (!cloudinaryUrl) {
      return res.status(400).json({ message: 'imageUrl or imageData required' });
    }

    const slide = await prisma.slide.create({
      data: {
        cloudinaryUrl,
        title: title || 'New Arrival',
        description: description || 'Shop the collection',
        device,
        sortOrder: sortOrder ?? 0,
      },
    });
    cache.invalidate('slides');
    res.status(201).json(slide);
  } catch (error) {
    const status = error?.status === 413 ? 413 : 500;
    res.status(status).json({ message: slideErrorMessage(error) });
  }
};

const updateSlide = async (req, res) => {
  try {
    const existing = await prisma.slide.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Slide not found' });

    const data = {};
    if (req.body.title !== undefined) data.title = req.body.title;
    if (req.body.description !== undefined) data.description = req.body.description;
    if (req.body.sortOrder !== undefined) data.sortOrder = Number(req.body.sortOrder) || 0;
    if (req.body.device !== undefined) data.device = normalizeDevice(req.body.device);

    const device = data.device || existing.device || 'desktop';
    if (req.body.imageData) {
      data.cloudinaryUrl = await uploadImage(
        req.body.imageData,
        device === 'mobile' ? 'futurefit/slides/mobile' : 'futurefit/slides/desktop'
      );
    } else if (req.body.imageUrl) {
      data.cloudinaryUrl = req.body.imageUrl;
    }

    const slide = await prisma.slide.update({
      where: { id: req.params.id },
      data,
    });
    cache.invalidate('slides');
    res.json(slide);
  } catch (error) {
    const status = error?.status === 413 ? 413 : 500;
    res.status(status).json({ message: slideErrorMessage(error) });
  }
};

const deleteSlide = async (req, res) => {
  try {
    await prisma.slide.delete({ where: { id: req.params.id } });
    cache.invalidate('slides');
    res.json({ message: 'Slide deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const cloudinaryStatus = async (req, res) => {
  res.json({ configured: isCloudinaryConfigured() });
};

module.exports = { listSlides, createSlide, updateSlide, deleteSlide, cloudinaryStatus };
