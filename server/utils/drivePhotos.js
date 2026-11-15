/**
 * Turn Google Drive folder / file links into image URLs the site can show.
 *
 * Folders are read with the Drive API when GOOGLE_DRIVE_API_KEY is set, otherwise
 * from Google's public "embedded folder view" page. Either way photos come back
 * in natural file-name order (1, 2, … 10 — not 1, 10, 2) and one level of
 * sub-folders (e.g. one folder per colour) is included after the main folder.
 */

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif)$/i;
const NON_IMAGE_EXT = /\.(mp4|mov|avi|mkv|webm|pdf|docx?|xlsx?|csv|txt|zip|rar|psd|ai)$/i;
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const FETCH_TIMEOUT_MS = 15000;
const MAX_SUBFOLDER_DEPTH = 1;
const MAX_IMAGES_PER_LINK = 200;
const CACHE_MS = 2 * 60 * 1000;

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const SHARE_HINT =
  'In Google Drive, open Share → General access → “Anyone with the link” (Viewer), then try again.';

const fileViewUrl = (id) => `https://lh3.googleusercontent.com/d/${id}`;

const ID = '([a-zA-Z0-9_-]{10,})';

/** Folder links: /drive/folders/ID, /drive/u/0/folders/ID, /drive/mobile/folders/ID, folderview?id=ID. */
const extractFolderId = (url) => {
  const s = String(url || '');
  if (!/drive\.google\.com/i.test(s)) return null;
  const folder = s.match(new RegExp(`/folders/${ID}`));
  if (folder) return folder[1];
  const view = s.match(new RegExp(`/(?:embedded)?folderview\\?(?:[^#]*&)?id=${ID}`));
  return view ? view[1] : null;
};

/** File links: /file/d/ID, open?id=ID, uc?id=ID, thumbnail?id=ID, lh3 /d/ID. */
const extractFileId = (url) => {
  const s = String(url || '');
  const file = s.match(new RegExp(`drive\\.google\\.com/file/(?:u/\\d+/)?d/${ID}`));
  if (file) return file[1];
  const lh3 = s.match(new RegExp(`lh3\\.googleusercontent\\.com/d/${ID}`));
  if (lh3) return lh3[1];
  if (/drive\.google\.com|drive\.usercontent\.google\.com/i.test(s)) {
    const id = s.match(new RegExp(`[?&]id=${ID}`));
    return id ? id[1] : null;
  }
  return null;
};

const isDriveFolderUrl = (url) => Boolean(extractFolderId(url));

const naturalCompare = (a, b) =>
  String(a || '').localeCompare(String(b || ''), undefined, { numeric: true, sensitivity: 'base' });

const looksLikeImage = (name, mimeType) => {
  if (mimeType) return /^image\//i.test(mimeType) || mimeType === 'application/vnd.google-apps.photo';
  if (IMAGE_EXT.test(name || '')) return true;
  // No type and no extension: keep it unless the name says otherwise
  return !NON_IMAGE_EXT.test(name || '');
};

class DriveError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const fetchWithTimeout = async (url, options = {}) => {
  try {
    return await fetch(url, { ...options, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw new DriveError('Google Drive took too long to answer. Try again in a moment.', 504);
    }
    throw new DriveError(`Could not reach Google Drive: ${err.message}`, 502);
  }
};

/* ---------- Drive API (when GOOGLE_DRIVE_API_KEY is set) ---------- */

const listChildrenViaApi = async (folderId, key) => {
  const entries = [];
  let pageToken = '';
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id,name,mimeType)',
      pageSize: '1000',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
      key,
    });
    if (pageToken) params.set('pageToken', pageToken);
    const res = await fetchWithTimeout(`https://www.googleapis.com/drive/v3/files?${params}`);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Drive API error (${res.status}): ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    for (const f of data.files || []) {
      entries.push({
        id: f.id,
        name: f.name || '',
        folder: f.mimeType === FOLDER_MIME,
        mimeType: f.mimeType || '',
      });
    }
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return entries;
};

/* ---------- Public embedded folder view (no key needed) ---------- */

const decodeHtml = (s) =>
  String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();

/** Parse Google's embedded folder view into { id, name, folder, mimeType } entries. */
const parseEmbedEntries = (html) => {
  const entries = [];
  for (const chunk of html.split('class="flip-entry"').slice(1)) {
    const id = chunk.match(/id="entry-([a-zA-Z0-9_-]+)"/)?.[1];
    if (!id) continue;
    const head = chunk.slice(0, 600);
    const folder = /\/drive\/(?:u\/\d+\/)?folders\//.test(head) || /google-apps\.folder/.test(chunk);
    const mimeType = folder ? FOLDER_MIME : chunk.match(/\/type\/([a-z]+\/[^"?]+)"/i)?.[1] || '';
    const name = decodeHtml(chunk.match(/class="flip-entry-title">([^<]*)</)?.[1]);
    entries.push({ id, name, folder, mimeType });
  }
  return entries;
};

const listChildrenViaEmbed = async (folderId) => {
  const res = await fetchWithTimeout(
    `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}`,
    { headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' }, redirect: 'follow' }
  );
  if (res.status === 404) {
    throw new DriveError(`That Drive folder wasn't found, or it isn't shared publicly. ${SHARE_HINT}`, 404);
  }
  if (!res.ok) {
    throw new DriveError(`Google Drive refused to open the folder (${res.status}). ${SHARE_HINT}`, 502);
  }
  const html = await res.text();
  if (/accounts\.google\.com/.test(res.url) || (!html.includes('flip-entries') && /ServiceLogin|signin/i.test(html))) {
    throw new DriveError(`That Drive folder is private. ${SHARE_HINT}`, 403);
  }
  return parseEmbedEntries(html);
};

/* ---------- Folder walk ---------- */

const folderCache = new Map();

const listChildren = async (folderId) => {
  const hit = folderCache.get(folderId);
  if (hit && hit.expires > Date.now()) return hit.entries;

  const key = process.env.GOOGLE_DRIVE_API_KEY;
  let entries = null;
  if (key) {
    try {
      entries = await listChildrenViaApi(folderId, key);
    } catch (err) {
      console.warn('Drive API folder list failed, trying the public view:', err.message);
    }
  }
  if (!entries) entries = await listChildrenViaEmbed(folderId);

  folderCache.set(folderId, { entries, expires: Date.now() + CACHE_MS });
  if (folderCache.size > 500) folderCache.delete(folderCache.keys().next().value);
  return entries;
};

/**
 * Images in a folder (natural name order), then images from its sub-folders
 * (also in name order). Returns { photos, skipped, subfolders }.
 */
const listFolderImages = async (folderId, depth = 0, seenFolders = new Set()) => {
  seenFolders.add(folderId);
  const entries = await listChildren(folderId);
  const files = entries.filter((e) => !e.folder).sort((a, b) => naturalCompare(a.name, b.name));
  const folders = entries.filter((e) => e.folder).sort((a, b) => naturalCompare(a.name, b.name));

  const photos = [];
  let skipped = 0;
  for (const f of files) {
    if (looksLikeImage(f.name, f.mimeType)) photos.push(fileViewUrl(f.id));
    else skipped += 1;
  }

  let subfolders = 0;
  if (depth < MAX_SUBFOLDER_DEPTH) {
    const nested = await Promise.all(
      folders
        .filter((f) => !seenFolders.has(f.id))
        .map((f) =>
          listFolderImages(f.id, depth + 1, seenFolders).catch((err) => {
            console.warn(`Drive sub-folder ${f.name || f.id} skipped:`, err.message);
            return { photos: [], skipped: 0, subfolders: 0 };
          })
        )
    );
    for (const sub of nested) {
      if (sub.photos.length) subfolders += 1;
      photos.push(...sub.photos);
      skipped += sub.skipped;
    }
  }

  return { photos: photos.slice(0, MAX_IMAGES_PER_LINK), skipped, subfolders };
};

/**
 * Expand Drive folder links, Drive file links and plain image URLs into a flat,
 * de-duplicated list of image URLs. Use resolvePhotoLinksDetailed for counts.
 */
const resolvePhotoLinksDetailed = async (links = []) => {
  const input = Array.isArray(links) ? links : String(links || '').split(/[\n,]+/);
  const cleaned = input.map((s) => String(s || '').trim()).filter(Boolean);

  const resolved = await Promise.all(
    cleaned.map(async (link) => {
      const folderId = extractFolderId(link);
      if (folderId) {
        const result = await listFolderImages(folderId);
        if (!result.photos.length) {
          throw new DriveError(
            result.skipped
              ? `That Drive folder has ${result.skipped} file${result.skipped === 1 ? '' : 's'} but no photos (JPG, PNG, WebP…).`
              : `No photos found in that Drive folder. Check it has images and is shared. ${SHARE_HINT}`
          );
        }
        return { ...result, folder: true };
      }
      const fileId = extractFileId(link);
      if (/drive\.google\.com/i.test(link) && !fileId) {
        throw new DriveError(`That Google Drive link isn't a folder or a file link: ${link.slice(0, 80)}`);
      }
      return { photos: [fileId ? fileViewUrl(fileId) : link], skipped: 0, subfolders: 0, folder: false };
    })
  );

  const photos = [];
  const seen = new Set();
  let skipped = 0;
  let subfolders = 0;
  let folders = 0;
  for (const r of resolved) {
    skipped += r.skipped;
    subfolders += r.subfolders;
    if (r.folder) folders += 1;
    for (const url of r.photos) {
      if (!seen.has(url)) {
        seen.add(url);
        photos.push(url);
      }
    }
  }
  return { photos, skipped, subfolders, folders };
};

const resolvePhotoLinks = async (links = []) => (await resolvePhotoLinksDetailed(links)).photos;

module.exports = {
  resolvePhotoLinks,
  resolvePhotoLinksDetailed,
  isDriveFolderUrl,
  extractFolderId,
  extractFileId,
  fileViewUrl,
  parseEmbedEntries,
  naturalCompare,
};
