const prisma = require('../lib/prisma');
const { syncMailchimp } = require('../utils/mailchimp');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const subscribe = async (req, res) => {
  try {
    const email = String(req.body?.email || '')
      .trim()
      .toLowerCase();
    const source = req.body?.source ? String(req.body.source).slice(0, 40) : null;

    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ message: 'Valid email is required' });
    }

    await prisma.newsletterSubscriber.upsert({
      where: { email },
      create: { email, source },
      update: source ? { source } : {},
    });

    // Non-blocking ESP — never fail the storefront signup if Mailchimp is down
    syncMailchimp(email, source).catch((err) => {
      console.warn('Mailchimp sync error:', err.message);
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Could not save subscription' });
  }
};

const listSubscribers = async (req, res) => {
  try {
    const rows = await prisma.newsletterSubscriber.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Could not load subscribers' });
  }
};

module.exports = { subscribe, listSubscribers };
