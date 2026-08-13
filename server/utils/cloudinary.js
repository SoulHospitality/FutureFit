const { v2: cloudinary } = require('cloudinary');

const configured =
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET;

if (configured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

const isCloudinaryConfigured = () => Boolean(configured);

const uploadImage = async (filePathOrDataUri, folder = 'futurefit') => {
  if (!configured) {
    throw new Error('Cloudinary is not configured. Add CLOUDINARY_* env vars.');
  }
  const result = await cloudinary.uploader.upload(filePathOrDataUri, {
    folder,
    resource_type: 'image',
  });
  return result.secure_url;
};

module.exports = { cloudinary, uploadImage, isCloudinaryConfigured };
