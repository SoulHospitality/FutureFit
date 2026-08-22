import { useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { Download, Loader2, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import api from '../../api/axios';
import Modal from '../ui/Modal';

const HEADERS = [
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
];

const TEMPLATE_ROWS = [
  [
    'Relaxed Cotton Boxers',
    'Classic woven boxers with a soft waistband',
    349,
    'men',
    'boxers',
    'White,Navy',
    'S,M,L,XL',
    '10,10,10,10',
    '',
    '',
    false,
    '',
  ],
  [
    'Starter Essentials Pack',
    'Boxers, briefs, and undershirt bundle',
    849,
    'men',
    'bundles',
    'Black,White',
    'S,M,L,XL',
    '5,5,5,5',
    '',
    'https://drive.google.com/drive/folders/YOUR_FOLDER_ID',
    true,
    799,
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
    .filter((row) => row.name || row.description || row.price);
}

function splitList(value, separator = ',') {
  return String(value || '')
    .split(separator)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseBool(value) {
  const v = String(value || '').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

export function csvRowsToProducts(rows) {
  return rows.map((row) => {
    const sizes = splitList(row.sizes);
    const stocks = splitList(row.stocks);
    const sizeStocks = sizes.map((size, i) => ({
      size,
      stock: Math.max(0, Number(stocks[i]) || 0),
    }));

    const photoRaw = row.photos || '';
    let photos = splitList(photoRaw, '|');
    if (!photos.length) photos = splitList(photoRaw, ';');
    photos = photos.filter((url) => /^https?:\/\//i.test(url));

    return {
      name: row.name,
      description: row.description,
      price: Number(row.price),
      audience: row.audience || 'men',
      categorySlug: row.category || row.category_slug || '',
      colors: splitList(row.colors),
      sizeStocks,
      photos,
      driveFolder: row.drive_folder || row.drivefolder || '',
      isSaleActive: parseBool(row.is_sale || row.is_sale_active),
      salePrice: row.sale_price === '' || row.sale_price == null ? null : Number(row.sale_price),
      __row: row.__row,
    };
  });
}

function downloadTemplate() {
  const sheet = XLSX.utils.aoa_to_sheet([HEADERS, ...TEMPLATE_ROWS]);
  sheet['!cols'] = [
    { wch: 28 },
    { wch: 42 },
    { wch: 8 },
    { wch: 10 },
    { wch: 12 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    { wch: 24 },
    { wch: 36 },
    { wch: 8 },
    { wch: 10 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Products');
  XLSX.writeFile(workbook, 'futurefit-products-template.xlsx');
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
      toast.error('Use an Excel file (.xlsx, .xls) or CSV with the template columns');
    }
  };

  const upload = async () => {
    if (!rows.length) return toast.error('Choose an Excel or CSV file first');
    const products = csvRowsToProducts(rows);
    const invalid = products.filter(
      (p) => !p.name || !p.description || !Number.isFinite(p.price) || !p.sizeStocks.length
    );
    if (invalid.length) {
      return toast.error(
        `${invalid.length} row${invalid.length === 1 ? '' : 's'} missing name, description, price, or sizes`
      );
    }

    setUploading(true);
    try {
      const { data } = await api.post('/products/bulk', {
        products: products.map(({ __row, ...product }) => product),
      });
      setResult(data);
      if (data.created) {
        toast.success(`Imported ${data.created} product${data.created === 1 ? '' : 's'}`);
        onComplete?.();
      }
      if (data.failed && !data.created) {
        toast.error('Import failed — check errors below');
      } else if (data.failed) {
        toast.warn(`${data.failed} row${data.failed === 1 ? '' : 's'} failed`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Bulk upload products" wide>
      <div className="space-y-5">
        <p className="text-sm text-timber-500">
          Upload an Excel sheet (.xlsx) or CSV to create many products at once. Download the
          template, fill in the &quot;Products&quot; sheet, then upload it here. Photo URLs can be
          pipe-separated; each row can also include a Google Drive folder link.
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
          </p>
        ) : null}

        {rows.length > 0 && !result ? (
          <div className="rounded border border-timber-100 bg-timber-50/50 p-4">
            <p className="text-sm font-medium text-timber-800">
              {rows.length} product{rows.length === 1 ? '' : 's'} ready to import
            </p>
            <div className="mt-3 max-h-48 overflow-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-timber-200 text-timber-500">
                    <th className="py-2 pe-3">Name</th>
                    <th className="py-2 pe-3">Price</th>
                    <th className="py-2 pe-3">Dept</th>
                    <th className="py-2">Sizes</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 8).map((row) => (
                    <tr key={row.__row} className="border-b border-timber-100">
                      <td className="py-2 pe-3 font-medium text-timber-800">{row.name}</td>
                      <td className="py-2 pe-3 tabular-nums">{row.price}</td>
                      <td className="py-2 pe-3">{row.audience || 'men'}</td>
                      <td className="py-2">{row.sizes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 8 ? (
                <p className="mt-2 text-[11px] text-timber-400">+ {rows.length - 8} more</p>
              ) : null}
            </div>
          </div>
        ) : null}

        {result ? (
          <div className="space-y-3 rounded border border-timber-100 p-4">
            <p className="text-sm text-timber-800">
              <span className="font-semibold text-green-700">{result.created}</span> created
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
                  <li key={`${err.row}-${err.name}`}>
                    Row {err.row}
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
                `Import ${rows.length || ''} product${rows.length === 1 ? '' : 's'}`
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
