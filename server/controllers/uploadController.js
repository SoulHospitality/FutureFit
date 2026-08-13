const multer = require('multer');
const { uploadImage, isCloudinaryConfigured } = require('../utils/cloudinary');
const prisma = require('../lib/prisma');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

const uploadSiteAsset = [
  upload.single('image'),
  async (req, res) => {
    try {
      if (!isCloudinaryConfigured()) {
        return res.status(503).json({
          message: 'Cloudinary not configured. Set CLOUDINARY_CLOUD_NAME, API_KEY, API_SECRET.',
        });
      }
      if (!req.file && !req.body.imageData) {
        return res.status(400).json({ message: 'No image provided' });
      }

      let dataUri = req.body.imageData;
      if (req.file) {
        const b64 = req.file.buffer.toString('base64');
        dataUri = `data:${req.file.mimetype};base64,${b64}`;
      }

      const folder = req.body.folder || 'futurefit/site';
      const url = await uploadImage(dataUri, folder);

      if (req.body.key) {
        await prisma.siteAsset.upsert({
          where: { key: req.body.key },
          create: { key: req.body.key, cloudinaryUrl: url },
          update: { cloudinaryUrl: url },
        });
      }

      res.status(201).json({ url });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },
];

module.exports = { uploadSiteAsset };
