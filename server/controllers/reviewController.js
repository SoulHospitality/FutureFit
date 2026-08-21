const prisma = require('../lib/prisma');
const cache = require('../lib/cache');

const serializeReview = (r) => ({
  id: r.id,
  productId: r.productId,
  name: r.name,
  rating: r.rating,
  comment: r.comment,
  isVisible: r.isVisible,
  createdAt: r.createdAt,
  product: r.product
    ? { id: r.product.id, name: r.product.name, photos: r.product.photos }
    : undefined,
});

const listProductReviews = async (req, res) => {
  try {
    const reviews = await prisma.review.findMany({
      where: { productId: req.params.id, isVisible: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(reviews.map(serializeReview));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createProductReview = async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const comment = String(req.body.comment || '').trim();
    const rating = Math.round(Number(req.body.rating));
    if (!name) return res.status(400).json({ message: 'Name is required' });
    if (!comment) return res.status(400).json({ message: 'Comment is required' });
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const review = await prisma.review.create({
      data: {
        productId: product.id,
        name: name.slice(0, 80),
        comment: comment.slice(0, 2000),
        rating,
      },
    });
    cache.invalidate('products');
    cache.invalidate('product');
    cache.invalidate('reviews');
    res.status(201).json(serializeReview(review));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const listReviews = async (req, res) => {
  try {
    const take = Math.min(Number(req.query.limit) || 50, 100);
    const visibleOnly = req.query.visible === 'true';
    const reviews = await prisma.review.findMany({
      where: visibleOnly ? { isVisible: true } : undefined,
      include: { product: { select: { id: true, name: true, photos: true } } },
      orderBy: { createdAt: 'desc' },
      take,
    });
    res.json(reviews.map(serializeReview));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateReview = async (req, res) => {
  try {
    const data = {};
    if (req.body.isVisible !== undefined) data.isVisible = Boolean(req.body.isVisible);
    const review = await prisma.review.update({
      where: { id: req.params.id },
      data,
      include: { product: { select: { id: true, name: true, photos: true } } },
    });
    cache.invalidate('products');
    cache.invalidate('product');
    cache.invalidate('reviews');
    res.json(serializeReview(review));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteReview = async (req, res) => {
  try {
    await prisma.review.delete({ where: { id: req.params.id } });
    cache.invalidate('products');
    cache.invalidate('product');
    cache.invalidate('reviews');
    res.json({ message: 'Review deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  listProductReviews,
  createProductReview,
  listReviews,
  updateReview,
  deleteReview,
};
