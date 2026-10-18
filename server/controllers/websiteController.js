const { getWebsiteContent, saveWebsiteContent } = require('../utils/website');

const getPublic = async (_req, res) => {
  try {
    const content = await getWebsiteContent();
    res.json(content);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAdmin = async (_req, res) => {
  try {
    const content = await getWebsiteContent();
    res.json(content);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const update = async (req, res) => {
  try {
    const content = await saveWebsiteContent(req.body || {});
    res.json(content);
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ message: error.message });
  }
};

module.exports = { getPublic, getAdmin, update };
