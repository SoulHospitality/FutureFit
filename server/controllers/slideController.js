const prisma = require('../lib/prisma');
const cache = require('../lib/cache');
const { uploadImage, isCloudinaryConfigured } = require('../utils/cloudinary');

const SLIDES_TTL_MS = 60_000;

const listSlides = async (req, res) => {
  try {
    const { data: slides } = await cache.wrap('slides:list', SLIDES_TTL_MS, () =>
      prisma.slide.findMany({
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          cloudinaryUrl: true,
          title: true,
          description: true,
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
    let cloudinaryUrl = imageUrl;

    if (imageData) {
      cloudinaryUrl = await uploadImage(imageData, 'futurefit/slides');
    } else if (!cloudinaryUrl) {
      return res.status(400).json({ message: 'imageUrl or imageData required' });
    }

    const slide = await prisma.slide.create({
      data: {
        cloudinaryUrl,
        title: title || 'New Arrival',
        description: description || 'Shop the collection',
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
    const data = { ...req.body };
    if (data.imageData) {
      data.cloudinaryUrl = await uploadImage(data.imageData, 'futurefit/slides');
      delete data.imageData;
    }
    if (data.imageUrl) {
      data.cloudinaryUrl = data.imageUrl;
      delete data.imageUrl;
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
