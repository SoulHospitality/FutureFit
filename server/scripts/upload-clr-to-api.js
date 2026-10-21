/**
 * Upload Future Fit - CLR (2).xlsx to the live API (parent/child variants).
 * Skips Item IDs that already exist.
 *
 * Usage:
 *   set ADMIN_EMAIL / ADMIN_PASSWORD (optional defaults)
 *   node scripts/upload-clr-to-api.js ["path.xlsx"] [API_BASE]
 */
const path = require('path');
const XLSX = require('xlsx');

// Keep this script Prisma-free so it can run without a local DATABASE_URL.
const AUDIENCE_ALIASES = {
  men: 'men',
  women: 'women',
  boys: 'boys',
  girls: 'girls',
  baby: 'baby',
  babies: 'baby',
  kids: 'boys',
  kid: 'boys',
};
const CATEGORY_ALIASES = {
  panty: 'panties',
  pantie: 'panties',
  shirt: 'shirts',
  'underwear-set': 'underwear-sets',
  'underwear set': 'underwear-sets',
};
const normalizeAudience = (value) => {
  const key = String(value || '')
    .trim()
    .toLowerCase();
  return AUDIENCE_ALIASES[key] || null;
};
const slugify = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
const normalizeCategorySlug = (value) => {
  const raw = slugify(value);
  if (!raw) return '';
  return CATEGORY_ALIASES[raw] || raw;
};
const CUSTOM_RE = /^[A-Z0-9][A-Z0-9_-]{0,31}$/;
const cleanItemCode = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const code = raw.toUpperCase().replace(/\s+/g, '-');
  if (!CUSTOM_RE.test(code)) {
    throw new Error(`Bad Item ID: ${raw}`);
  }
  return code;
};

const FILE =
  process.argv[2] ||
  path.join(process.env.USERPROFILE || '', 'Downloads', 'Future Fit - CLR (2).xlsx');
const API =
  process.argv[3] ||
  process.env.API_PUBLIC_URL ||
  'https://futurefit-production-2a44.up.railway.app';
const EMAIL = process.env.ADMIN_EMAIL || 'admin@futurefit.eg';
const PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

const stripSizeFromText = (text) =>
  String(text || '')
    .replace(/\s*[–—|-]\s*(X{0,3}-?Large|XX-Large|XXX-Large|X-Large|Medium|Small|Large)\b.*$/i, '')
    .replace(/\s*\|\s*(X{0,3}-?Large|XX-Large|XXX-Large|X-Large|Medium|Small|Large)\b.*$/i, '')
    .replace(/\s*Size:\s*[^.]*\.?/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

const parseBool = (value) => {
  const v = String(value ?? '').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'y';
};

const parseMoney = (value) => {
  if (value === '' || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};

const isParentMarker = (value) => String(value || '').trim().toLowerCase() === 'parent';

const api = async (method, urlPath, { token, body } = {}) => {
  const res = await fetch(`${API.replace(/\/$/, '')}${urlPath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }
  if (!res.ok) {
    const err = new Error(data?.message || `${res.status} ${res.statusText}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
};

const loadRows = (filePath) => {
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  return rows.filter((r) => {
    const id = String(r['Item ID'] || r.item_id || '').trim();
    if (!id || id.toUpperCase() === 'EXAMPLES') return false;
    return Boolean(String(r.name || '').trim());
  });
};

async function main() {
  console.log('API', API);
  console.log('Reading', FILE);
  const rows = loadRows(FILE);
  console.log('Data rows:', rows.length);

  const login = await api('POST', '/api/auth/login', {
    body: { email: EMAIL, password: PASSWORD },
  });
  const token = login.token || login.accessToken;
  if (!token) throw new Error('Login succeeded but no token returned');
  console.log('Logged in');

  const existingList = await api('GET', '/api/products?limit=2000&status=all', { token });
  const existing = Array.isArray(existingList)
    ? existingList
    : existingList?.products || [];
  const existingCodes = new Set(
    existing.map((p) => cleanItemCode(p.itemCode || p.item_id)).filter(Boolean)
  );
  console.log('Existing products:', existing.length, 'codes:', existingCodes.size);

  const parents = new Map();
  for (const row of rows) {
    const itemId = cleanItemCode(row['Item ID']);
    const parentSku = cleanItemCode(row['Parent SKU'] || row.parent_sku || '');
    if (!parentSku) {
      if (!parents.has(itemId)) parents.set(itemId, { parent: row, children: [] });
      else parents.get(itemId).parent = row;
      continue;
    }
    if (!parents.has(parentSku)) parents.set(parentSku, { parent: null, children: [] });
    parents.get(parentSku).children.push(row);
  }
  console.log('Parent groups:', parents.size);

  let created = 0;
  let skipped = 0;
  const errors = [];

  for (const [parentCode, group] of parents) {
    if (existingCodes.has(parentCode)) {
      skipped += 1;
      console.log('SKIP', parentCode, '(exists)');
      continue;
    }

    const parentRow = group.parent;
    let children = group.children;
    try {
      if (!parentRow) throw new Error('Missing parent row');
      if (!children.length) {
        const color = String(parentRow.colors || '').trim();
        const size = String(parentRow.sizes || '').trim();
        if (!color || !size || isParentMarker(color) || isParentMarker(size)) {
          throw new Error('Parent has no children and no sellable color/size');
        }
        children = [parentRow];
      }

      const firstChild = children[0];
      const audience =
        normalizeAudience(parentRow.audience || firstChild.audience || 'men') || 'men';
      const categorySlug = normalizeCategorySlug(
        parentRow.category || firstChild.category || ''
      );
      if (!categorySlug) throw new Error('Missing category');

      const usedChildCodes = new Set([parentCode]);
      const variants = [];
      for (const child of children) {
        const color = String(child.colors || '').trim();
        const size = String(child.sizes || '').trim();
        if (!color || !size || isParentMarker(color) || isParentMarker(size)) {
          throw new Error(`Bad child color/size on ${child['Item ID']}`);
        }
        let childCode = cleanItemCode(child['Item ID']);
        if (usedChildCodes.has(childCode)) {
          childCode = cleanItemCode(`${childCode}-${size}`) || `${childCode}-V`;
          let n = 2;
          while (usedChildCodes.has(childCode)) {
            childCode = `${parentCode}-V${n}`;
            n += 1;
          }
        }
        usedChildCodes.add(childCode);
        const folder = String(child.drive_folder || child.driveFolder || '').trim();
        variants.push({
          itemCode: childCode,
          color,
          size,
          stock: Math.max(0, Math.floor(Number(child.stocks) || 0)),
          price: parseMoney(child.price),
          cost: parseMoney(child.Cost ?? child.cost),
          photos: folder ? [folder] : [],
        });
      }

      const prices = variants.map((v) => v.price).filter((p) => p != null && p > 0);
      const parentPrice =
        parseMoney(parentRow.price) ?? (prices.length ? Math.min(...prices) : null);
      if (parentPrice == null || parentPrice <= 0) throw new Error('No price');

      const costs = variants.map((v) => v.cost).filter((c) => c != null);
      const parentCost =
        parseMoney(parentRow.Cost ?? parentRow.cost) ?? (costs.length ? costs[0] : null);

      const isSale = parseBool(parentRow.is_sale || firstChild.is_sale);
      const salePrice = parseMoney(parentRow.sale_price ?? firstChild.sale_price);
      const name = stripSizeFromText(parentRow.name) || String(parentRow.name).trim();
      const description =
        stripSizeFromText(parentRow.description) ||
        String(parentRow.description || name).trim();
      const parentFolder = String(
        parentRow.drive_folder || parentRow.driveFolder || ''
      ).trim();

      const payload = {
        itemCode: parentCode,
        name,
        description,
        price: parentPrice,
        cost: parentCost,
        audience,
        category: categorySlug,
        status: 'active',
        isSaleActive: isSale && salePrice != null,
        salePrice: isSale ? salePrice : null,
        driveFolder: parentFolder || undefined,
        variants,
      };
      try {
        await api('POST', '/api/products', { token, body: payload });
      } catch (err) {
        // Drive folders sometimes empty/private — still create the SKU without photos.
        if (!/images found|Drive/i.test(err.message)) throw err;
        console.warn('Photos skipped for', parentCode, '→', err.message);
        payload.driveFolder = undefined;
        payload.variants = variants.map((v) => ({ ...v, photos: [] }));
        await api('POST', '/api/products', { token, body: payload });
      }
      created += 1;
      existingCodes.add(parentCode);
      console.log(`OK ${parentCode} — ${variants.length} variants (${audience}/${categorySlug})`);
    } catch (err) {
      errors.push({ itemCode: parentCode, message: err.message });
      console.error('FAIL', parentCode, err.message);
    }
  }

  console.log(
    JSON.stringify(
      { created, skipped, failed: errors.length, errors: errors.slice(0, 40) },
      null,
      2
    )
  );
  if (errors.length && !created) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
