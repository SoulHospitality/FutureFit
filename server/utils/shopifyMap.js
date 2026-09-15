/**
 * Map Shopify export fields → FutureFit audience + subcategory slug.
 * Prefer Type + Product Category leaf + Title. Ignore marketing tags for subcategory.
 */

const AUDIENCES = ['men', 'women', 'kids'];

const mapAudience = (tags, title, type, productCategory) => {
  const tagsL = String(tags || '').toLowerCase();
  const titleL = String(title || '').toLowerCase();
  const typeL = String(type || '').toLowerCase();
  const catL = String(productCategory || '').toLowerCase();

  // Explicit tag signals
  if (
    /\bbaby\b/.test(tagsL) ||
    /\bbaby underwear\b/.test(tagsL) ||
    /\bgirls?\b/.test(tagsL) ||
    /\bboys?\b/.test(tagsL)
  ) {
    return 'kids';
  }
  if (/\bwomen\b/.test(tagsL) || /\bwoman\b/.test(tagsL)) return 'women';
  if (/\bmen\b/.test(tagsL) && !/\bwomen\b/.test(tagsL)) return 'men';

  // Type / category / title
  if (
    /\bbaby\b/.test(typeL) ||
    /\bbaby\b/.test(catL) ||
    /\btoddler\b/.test(catL) ||
    /\bgirls?'?\s*underwear\b/.test(catL) ||
    /\bbaby\b/.test(titleL) ||
    /\bkids?\b/.test(titleL) ||
    /\bfor boys?\b/.test(titleL) ||
    /\bfor girls?\b/.test(titleL) ||
    /unisex kid/.test(titleL)
  ) {
    return 'kids';
  }

  if (
    /\bwomen\b/.test(typeL) ||
    /\bpanty\b/.test(typeL) ||
    /lingerie/.test(catL) ||
    /women'?s undershirt/.test(catL) ||
    /\bfor women\b/.test(titleL) ||
    /\bforwomen\b/.test(titleL) ||
    /\bdress/.test(titleL) ||
    /legging/.test(titleL)
  ) {
    return 'women';
  }

  if (/\bfor men\b/.test(titleL) || /\bformen\b/.test(titleL) || /men'?s under/.test(catL)) {
    return 'men';
  }

  return 'men';
};

const mapType = (shopifyType, title, tags, productCategory) => {
  const t = String(shopifyType || '').toLowerCase();
  const hay = `${t} ${title} ${productCategory}`.toLowerCase();

  if (/sock/.test(t) || (/sock/.test(hay) && !/boxer|undershirt|hoodie|pant/.test(t))) {
    if (/sock/.test(t) || /sock/.test(String(title).toLowerCase()) || /socks$/i.test(productCategory)) {
      return 'socks';
    }
  }
  if (/^boxer/.test(t) || /\bboxer\b/.test(String(title).toLowerCase())) return 'boxers';
  if (/hoodie/.test(t) || /hoodie/.test(hay)) return 'undershirt';
  if (/t-?shirt/.test(t)) return 'undershirt';
  if (/undershirt/.test(t) || /undershirt/.test(hay)) return 'undershirt';
  if (/^pants$|sweatpant/.test(t) || /\bpants\b/.test(hay)) return 'boxers';
  if (/short/.test(t) || /denim short/.test(hay)) return 'trunks';
  if (/panty|brief/.test(t)) return 'briefs';
  if (/sleepwear|pajama|pyjama|sleep wear/.test(t) || /sleep wear|pajama/.test(hay)) {
    return 'undershirt';
  }
  if (/thermal/.test(t)) return 'briefs';
  if (/bundle|bunldle|underwear set|pack of/.test(hay)) return 'bundle';
  if (/baby underwear|girl'?s underwear/.test(t)) return 'briefs';
  if (/sock/.test(hay)) return 'socks';
  return 'boxers';
};

/** Subcategory slug under Men / Women / Kids. */
const mapCategorySlug = (productCategory, shopifyType, title, tags, audience) => {
  const type = String(shopifyType || '').toLowerCase().trim();
  const titleL = String(title || '').toLowerCase();
  const cat = String(productCategory || '');
  const leaf = cat.split('>').pop().trim().toLowerCase();

  // --- 0) Strong title signals (beat empty/wrong Type) ---
  if (/hoodie/i.test(titleL)) return 'hoodies';
  if (/\bboxers?\b/i.test(titleL) && !/sock/i.test(type)) return 'boxers';

  // --- 1) Shopify Type (highest priority) ---
  if (/^boxer/.test(type)) return 'boxers';
  if (/^socks?$/.test(type) || type === 'socks') return 'socks';
  if (/hoodie/.test(type)) return 'hoodies';
  if (/^pants$/.test(type) || /sweatpant/.test(type)) return 'pants';
  if (/t-?shirt/.test(type)) return 't-shirts';
  if (/undershirt/.test(type)) {
    if (/hoodie/.test(titleL)) return 'hoodies';
    if (/pant/.test(titleL) && /hoodie/.test(titleL)) return 'hoodies';
    return audience === 'women' ? 'womens-undershirts' : 't-shirts';
  }
  if (/panty/.test(type)) {
    return audience === 'women' ? 'womens-undershirts' : 'undershorts';
  }
  if (/pajama|pyjama/.test(type)) return 'pajamas';
  if (/sleepwear|sleep wear|babysleepwear|baby sleepwear/.test(type)) {
    return 'sleepwear-loungewear';
  }
  if (/thermal/.test(type)) return audience === 'women' ? 'leggings' : 'pants';
  if (/short/.test(type)) return 'denim-shorts';
  if (/underwear set/.test(type)) {
    // Girls sets are tops + shorts — file under T-Shirts for kids
    return audience === 'kids' ? 't-shirts' : 'womens-undershirts';
  }
  if (/baby underwear|girl'?s underwear/.test(type)) {
    if (/spaghetti|strap top|set\s*\(|sleeve|undershirt|t-?shirt/.test(titleL)) {
      return 't-shirts';
    }
    return 'undershorts';
  }
  if (/bunldle|bundle/.test(type)) {
    if (/boxer/.test(titleL)) return 'boxers';
    if (/undershirt|t-?shirt/.test(titleL)) return 't-shirts';
    if (/sock/.test(titleL)) return 'socks';
    return audience === 'kids' ? 'undershorts' : 'boxers';
  }

  // --- 2) Product Category leaf ---
  if (leaf === 'boxers' || leaf.endsWith('boxers')) return 'boxers';
  if (leaf === 'undershorts' || leaf.includes('undershort')) return 'undershorts';
  if (leaf === 'socks' || leaf.endsWith('socks')) return 'socks';
  if (leaf === 't-shirts' || leaf.includes('t-shirt')) return 't-shirts';
  if (leaf.includes("women's undershirt") || leaf.includes('womens undershirt')) {
    return 'womens-undershirts';
  }
  if (leaf === 'leggings' || leaf.endsWith('leggings')) return 'leggings';
  if (leaf === 'pants' || leaf.endsWith(' pants')) return 'pants';
  if (leaf.includes('denim short')) return 'denim-shorts';
  if (leaf === 'pajamas' || leaf.includes('pajama')) return 'pajamas';
  if (leaf.includes('sleepwear') || leaf.includes('loungewear')) {
    if (/boxer/.test(titleL)) return 'boxers';
    return 'sleepwear-loungewear';
  }
  if (leaf.includes('baby') || leaf.includes('toddler')) {
    if (/sock/.test(titleL)) return 'socks';
    if (/sleep/.test(titleL)) return 'sleepwear-loungewear';
    if (/hoodie/.test(titleL)) return 'hoodies';
    if (/boxer/.test(titleL)) return 'boxers';
    if (/pant|sweatpant/.test(titleL) && !/under/.test(titleL)) return 'pants';
    if (/undershirt|t-?shirt|spaghetti|strap top|(half|long|short)?\s*sleeve/.test(titleL)) {
      return 't-shirts';
    }
    return 'undershorts';
  }
  if (leaf.includes('girl') && leaf.includes('under')) {
    if (/spaghetti|top|set/.test(titleL)) return 't-shirts';
    return 'undershorts';
  }

  // --- 3) Title keywords (specific before generic) ---
  if (/denim short/.test(titleL)) return 'denim-shorts';
  if (/legging/.test(titleL)) return 'leggings';
  if (/\bdresses?\b/.test(titleL)) return 'dresses';
  if (/hoodie/.test(titleL) && /pant/.test(titleL)) return 'hoodies'; // pants+hoodie sets
  if (/hoodie/.test(titleL)) return 'hoodies';
  if (/\bboxers?\b/.test(titleL)) return 'boxers';
  if (/pajama|pyjama/.test(titleL)) return 'pajamas';
  if (/sleep\s*wear|sleepwear|loungewear/.test(titleL)) return 'sleepwear-loungewear';
  if (/\bpants\b|sweatpant|wide leg/.test(titleL) && !/under/.test(titleL)) return 'pants';
  if (/undershort|trunk/.test(titleL)) return 'undershorts';
  if (/t-?shirt/.test(titleL)) return 't-shirts';
  if (/undershirt|spaghetti strap|strap top/.test(titleL)) {
    return audience === 'women' ? 'womens-undershirts' : 't-shirts';
  }
  if (/sock/.test(titleL)) return 'socks';
  if (/panty|brief/.test(titleL)) {
    return audience === 'women' ? 'womens-undershirts' : 'undershorts';
  }

  // --- 4) Audience defaults ---
  if (audience === 'women') return 'womens-undershirts';
  if (audience === 'kids') return 'undershorts';
  return 'boxers';
};

module.exports = {
  AUDIENCES,
  mapAudience,
  mapType,
  mapCategorySlug,
};
