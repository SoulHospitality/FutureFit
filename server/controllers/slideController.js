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
    res.status(500).json({ message: error.message });
  }
};

const updateSlide = async (req, res) => {
  try {
    const data = {};
    if (req.body.title !== undefined) data.title = req.body.title;
    if (req.body.description !== undefined) data.description = req.body.description;
    if (req.body.sortOrder !== undefined) data.sortOrder = Number(req.body.sortOrder) || 0;
    if (req.body.device !== undefined) data.device = normalizeDevice(req.body.device);
    if (req.body.imageData) {
      const device = data.device || normalizeDevice(req.body.device);
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
    res.status(500).json({ message: error.message });
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
