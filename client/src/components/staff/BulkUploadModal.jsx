import { useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { Download, Loader2, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import api from '../../api/axios';
import Modal from '../ui/Modal';

/** Matches Future Fit - CLR.xlsx (parent / child). */
const HEADERS = [
  'Item ID',
  'Parent SKU',
  'name',
  'description',
  'price',
  'audience',
  'category',
  'colors',
  'sizes',
  'stocks',
  'photos',
  'drive_folder',
  'is_sale',
  'sale_price',
  'Cost',
];

const TEMPLATE_ROWS = [
  [
    'BX-SHORT',
    '',
    "Men's Classic Cotton Boxer Shorts",
    'Soft breathable boxers for everyday wear.',
    '',
    'men',
    'boxers',
    'Parent',
    'Parent',
    '',
    '',
    '',
    '',
    '',
    '',
  ],
  [
    'BX-BLK-M',
    'BX-SHORT',
    "Men's Classic Black Cotton Boxer Shorts | Medium",
    'Black cotton boxers. Size: Medium.',
    119,
    'men',
    'boxers',
    'Black',
    'M',
    10,
    '',
    'https://drive.google.com/drive/folders/YOUR_FOLDER_ID',
    '',
    '',
    88,
  ],
  [
    'BX-BLK-L',
    'BX-SHORT',
    "Men's Classic Black Cotton Boxer Shorts | Large",
    'Black cotton boxers. Size: Large.',
    119,
    'men',
    'boxers',
    'Black',
    'L',
    10,
    '',
    'https://drive.google.com/drive/folders/YOUR_FOLDER_ID',
    '',
    '',
    88,
  ],
  [
    'SK-P3STL',
    '',
    "Men's Pack of 3 Striped Long Socks",
    'Pack of 3 long socks. Size 40-45.',
    340,
    'men',
    'socks',
    'Black, Grey, White',
    '40-45',
    10,
    '',
    'https://drive.google.com/drive/folders/YOUR_FOLDER_ID',
    '',
    '',
    75,
  ],
];

function cellToString(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function normalizeRow(raw, rowNumber) {
  const row = {};
  Object.entries(raw).forEach(([key, value]) => {
    row[String(key).toLowerCase().trim()] = cellToString(value);
  });
  row.__row = rowNumber;
  return row;
}

function field(row, ...keys) {
  for (const key of keys) {
    const v = row[key];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function parseCsv(text) {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  return lines.slice(1).map((line, index) => {
    const cells = parseCsvLine(line);
    const row = {};
    headers.forEach((header, i) => {
      row[header] = cells[i] ?? '';
    });
    return normalizeRow(row, index + 2);
  });
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  values.push(current.trim());
  return values;
}

function parseExcel(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  return json
    .map((row, index) => normalizeRow(row, index + 2))
    .filter((row) => {
      const id = field(row, 'item id', 'item_id', 'itemid').toUpperCase();
      if (!id || id === 'EXAMPLES') return false;
      return Boolean(field(row, 'name'));
    });
}

function parseBool(value) {
  const v = String(value || '').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'y';
}

function parseMoney(value) {
  if (value === '' || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isParentMarker(value) {
  return String(value || '').trim().toLowerCase() === 'parent';
}

function stripSizeFromText(text) {
  return String(text || '')
    .replace(/\s*[–—|-]\s*(X{0,3}-?Large|XX-Large|XXX-Large|X-Large|Medium|Small|Large)\b.*$/i, '')
    .replace(/\s*\|\s*(X{0,3}-?Large|XX-Large|XXX-Large|X-Large|Medium|Small|Large)\b.*$/i, '')
    .replace(/\s*Size:\s*[^.]*\.?/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function splitPhotos(value) {
  const raw = String(value || '');
  let photos = raw.split('|').map((s) => s.trim()).filter(Boolean);
  if (!photos.length) photos = raw.split(';').map((s) => s.trim()).filter(Boolean);
  return photos.filter((url) => /^https?:\/\//i.test(url));
}

function rowToVariant(row) {
  const itemCode = field(row, 'item id', 'item_id', 'itemid').toUpperCase();
  const color = field(row, 'colors', 'color');
  const size = field(row, 'sizes', 'size');
  return {
    itemCode,
    color,
    size,
    stock: Math.max(0, Math.floor(Number(field(row, 'stocks', 'stock')) || 0)),
    price: parseMoney(field(row, 'price')),
    cost: parseMoney(field(row, 'cost')),
    photos: splitPhotos(field(row, 'photos')),
    driveFolder: field(row, 'drive_folder', 'drivefolder', 'drive folder'),
  };
}

/** Group CLR rows into parent products with children for upsert. */
export function sheetRowsToProducts(rows) {
  const parents = new Map();

  for (const row of rows) {
    const itemId = field(row, 'item id', 'item_id', 'itemid').toUpperCase();
    const parentSku = field(row, 'parent sku', 'parent_sku', 'parentsku').toUpperCase();
    if (!itemId) continue;

    if (!parentSku) {
      if (!parents.has(itemId)) parents.set(itemId, { parent: row, children: [] });
      else parents.get(itemId).parent = row;
      continue;
    }
    if (!parents.has(parentSku)) {
      parents.set(parentSku, { parent: null, children: [] });
    }
    parents.get(parentSku).children.push(row);
  }

  const products = [];
  for (const [parentCode, group] of parents) {
    const parentRow = group.parent;
    let children = group.children;

    if (!parentRow) {
      products.push({
        __error: `Missing parent row for ${parentCode}`,
        __row: children[0]?.__row,
        itemCode: parentCode,
      });
      continue;
    }

    // Standalone parent (no children): use its own color/size as one child
    if (!children.length) {
      const color = field(parentRow, 'colors', 'color');
      const size = field(parentRow, 'sizes', 'size');
      if (!color || !size || isParentMarker(color) || isParentMarker(size)) {
        products.push({
          __error: `${parentCode} has no children and no sellable color/size`,
          __row: parentRow.__row,
          itemCode: parentCode,
        });
        continue;
      }
      children = [parentRow];
    }

    const firstChild = children[0];
    const variants = children.map(rowToVariant).filter((v) => v.itemCode && v.color && v.size);

    const parentPrice = parseMoney(field(parentRow, 'price'));
    const childPrices = variants.map((v) => v.price).filter((p) => p != null && p > 0);

    products.push({
      itemCode: parentCode,
      name:
        stripSizeFromText(field(parentRow, 'name')) ||
        field(parentRow, 'name') ||
        parentCode,
      description:
        stripSizeFromText(field(parentRow, 'description')) ||
        field(parentRow, 'description') ||
        field(parentRow, 'name'),
      price: parentPrice ?? (childPrices.length ? Math.min(...childPrices) : null),
      cost: parseMoney(field(parentRow, 'cost')),
      audience: field(parentRow, 'audience') || field(firstChild, 'audience') || 'men',
      categorySlug: field(parentRow, 'category') || field(firstChild, 'category') || '',
      photos: splitPhotos(field(parentRow, 'photos')),
      driveFolder: field(parentRow, 'drive_folder', 'drivefolder', 'drive folder'),
      isSaleActive: parseBool(
        field(parentRow, 'is_sale', 'is sale', 'is_sale_active') ||
          field(firstChild, 'is_sale', 'is sale')
      ),
      salePrice: parseMoney(
        field(parentRow, 'sale_price', 'sale price') ||
          field(firstChild, 'sale_price', 'sale price')
      ),
      variants,
      __row: parentRow.__row,
      __childCount: variants.length,
    });
  }

  return products;
}

function downloadTemplate() {
  const sheet = XLSX.utils.aoa_to_sheet([HEADERS, ...TEMPLATE_ROWS]);
  sheet['!cols'] = [
    { wch: 18 },
    { wch: 14 },
    { wch: 36 },
    { wch: 42 },
    { wch: 8 },
    { wch: 10 },
    { wch: 12 },
    { wch: 18 },
    { wch: 10 },
    { wch: 8 },
    { wch: 16 },
    { wch: 40 },
    { wch: 8 },
    { wch: 10 },
    { wch: 8 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Website');
  XLSX.writeFile(workbook, 'futurefit-clr-template.xlsx');
}

async function readUploadFile(file) {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'csv') {
    return parseCsv(await file.text());
  }
  if (ext === 'xlsx' || ext === 'xls') {
    return parseExcel(await file.arrayBuffer());
  }
  throw new Error('unsupported');
}

export default function BulkUploadModal({ open, onClose, onComplete }) {
  const inputRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [fileLabel, setFileLabel] = useState('');

  const reset = () => {
    setRows([]);
    setResult(null);
    setFileLabel('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = async (file) => {
    if (!file) return;
    try {
      const parsed = await readUploadFile(file);
      if (!parsed.length) {
        toast.error('No product rows found in the file');
        return;
      }
      setRows(parsed);
      setFileLabel(file.name);
      setResult(null);
      toast.success(`Loaded ${parsed.length} row${parsed.length === 1 ? '' : 's'}`);
    } catch {
      toast.error('Use an Excel file (.xlsx, .xls) or CSV with the CLR template columns');
    }
  };

  const upload = async () => {
    if (!rows.length) return toast.error('Choose an Excel or CSV file first');
    const products = sheetRowsToProducts(rows);
    const parseErrors = products.filter((p) => p.__error);
    const ready = products.filter((p) => !p.__error);

    if (!ready.length) {
      return toast.error(parseErrors[0]?.__error || 'No valid parent/child groups found');
    }

    setUploading(true);
    try {
      const { data } = await api.post('/products/bulk', {
        products: ready.map(({ __row, __childCount, __error, ...product }) => product),
      });
      const mergedErrors = [
        ...parseErrors.map((p) => ({
          row: p.__row,
          name: p.itemCode,
          message: p.__error,
        })),
        ...(data.errors || []),
      ];
      setResult({ ...data, errors: mergedErrors, failed: mergedErrors.length });
      const touched = (data.created || 0) + (data.updated || 0);
      if (touched) {
        toast.success(
          `${data.created || 0} created · ${data.updated || 0} updated`
        );
        onComplete?.();
      }
      if (mergedErrors.length && !touched) {
        toast.error('Import failed — check errors below');
      } else if (mergedErrors.length) {
        toast.warn(`${mergedErrors.length} group${mergedErrors.length === 1 ? '' : 's'} failed`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk upload failed');
    } finally {
      setUploading(false);
    }
  };

  const previewGroups = rows.length ? sheetRowsToProducts(rows).filter((p) => !p.__error) : [];

  return (
    <Modal open={open} onClose={handleClose} title="Bulk upload products" wide>
      <div className="space-y-5">
        <p className="text-sm text-timber-500">
          Upload the CLR Excel sheet (Item ID + Parent SKU). Parents list on the storefront;
          children are color × size with their own Item ID, price, cost, and stock. Existing Item
          IDs are updated; new ones are created.
        </p>

        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-outline btn-sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4" />
            Download Excel template
          </button>
          <label className="btn-dark btn-sm cursor-pointer">
            <Upload className="h-4 w-4" />
            Choose file
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              className="sr-only"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </label>
        </div>

        {fileLabel ? (
          <p className="text-xs text-timber-500">
            Selected: <span className="font-medium text-timber-700">{fileLabel}</span>
            {rows.length ? ` · ${rows.length} rows · ${previewGroups.length} parents` : ''}
          </p>
        ) : null}

        {previewGroups.length > 0 && !result ? (
          <div className="rounded border border-timber-100 bg-timber-50/50 p-4">
            <p className="text-sm font-medium text-timber-800">
              {previewGroups.length} parent{previewGroups.length === 1 ? '' : 's'} ready
              (create or update)
            </p>
            <div className="mt-3 max-h-48 overflow-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-timber-200 text-timber-500">
                    <th className="py-2 pe-3">Parent ID</th>
                    <th className="py-2 pe-3">Name</th>
                    <th className="py-2 pe-3">Children</th>
                    <th className="py-2">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {previewGroups.slice(0, 10).map((row) => (
                    <tr key={row.itemCode} className="border-b border-timber-100">
                      <td className="py-2 pe-3 font-mono text-[11px] text-timber-800">
                        {row.itemCode}
                      </td>
                      <td className="py-2 pe-3 font-medium text-timber-800">{row.name}</td>
                      <td className="py-2 pe-3 tabular-nums">{row.__childCount}</td>
                      <td className="py-2 tabular-nums">{row.price ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewGroups.length > 10 ? (
                <p className="mt-2 text-[11px] text-timber-400">
                  + {previewGroups.length - 10} more
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {result ? (
          <div className="space-y-3 rounded border border-timber-100 p-4">
            <p className="text-sm text-timber-800">
              <span className="font-semibold text-green-700">{result.created || 0}</span> created
              {' · '}
              <span className="font-semibold text-timber-800">{result.updated || 0}</span> updated
              {result.failed ? (
                <>
                  {' '}
                  · <span className="font-semibold text-red-600">{result.failed}</span> failed
                </>
              ) : null}
            </p>
            {result.errors?.length ? (
              <ul className="max-h-40 space-y-1 overflow-auto text-xs text-red-600">
                {result.errors.map((err) => (
                  <li key={`${err.row}-${err.name}-${err.message}`}>
                    {err.row != null ? `Row ${err.row}` : 'Group'}
                    {err.name ? ` (${err.name})` : ''}: {err.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="flex gap-3 pt-2">
          <button type="button" className="btn-outline flex-1" onClick={handleClose}>
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result ? (
            <button
              type="button"
              className="btn-wheat flex-1"
              onClick={upload}
              disabled={uploading || !rows.length}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importing…
                </>
              ) : (
                `Import ${previewGroups.length || ''} parent${previewGroups.length === 1 ? '' : 's'}`
              )}
            </button>
          ) : (
            <button type="button" className="btn-wheat flex-1" onClick={reset}>
              Upload another file
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
