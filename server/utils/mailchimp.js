/**
 * Optional Mailchimp audience sync.
 * Set MAILCHIMP_API_KEY, MAILCHIMP_AUDIENCE_ID, and MAILCHIMP_SERVER_PREFIX
 * (e.g. "us21" from the API key suffix key-xxxxx-us21).
 * No-ops when unset — DB subscription still succeeds.
 */
const syncMailchimp = async (email, source) => {
  const apiKey = process.env.MAILCHIMP_API_KEY;
  const audienceId = process.env.MAILCHIMP_AUDIENCE_ID;
  let server = process.env.MAILCHIMP_SERVER_PREFIX;
  if (!apiKey || !audienceId) return { skipped: true };

  if (!server && apiKey.includes('-')) {
    server = apiKey.split('-').pop();
  }
  if (!server) return { skipped: true };

  const url = `https://${server}.api.mailchimp.com/3.0/lists/${audienceId}/members`;
  const auth = Buffer.from(`any:${apiKey}`).toString('base64');

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email_address: email,
      status: 'subscribed',
      tags: source ? [String(source)] : undefined,
      merge_fields: source ? { SOURCE: String(source).slice(0, 50) } : undefined,
    }),
  });

  if (res.ok || res.status === 400) {
    // 400 often means "Member Exists" — treat as success
    const body = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true };
    if (String(body.title || '').toLowerCase().includes('member exists')) {
      return { ok: true, existed: true };
    }
    if (String(body.detail || '').toLowerCase().includes('already a list member')) {
      return { ok: true, existed: true };
    }
    console.warn('Mailchimp sync warning:', body.title || body.detail || res.status);
    return { ok: false, warning: body.title || body.detail };
  }

  const text = await res.text().catch(() => '');
  console.warn('Mailchimp sync failed:', res.status, text.slice(0, 200));
  return { ok: false };
};

module.exports = { syncMailchimp };
