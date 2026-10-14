import { audienceLabel, categoryLabel } from './helpers';

const INK = 'FF18181B';
const WHITE = 'FFFFFFFF';
const MUTED = 'FF71717A';
const LINE = 'FFE4E4E7';
const ZEBRA = 'FFFAFAFA';
const SALE = 'FF9F1239';
const DRAFT = 'FFB45309';
const OUT = 'FFB91C1C';

const money = (value) => (value == null || value === '' ? null : Number(value));

const sizeLabel = (product) => {
  const rows = product.sizeStocks?.length ? product.sizeStocks : [];
  if (!rows.length) return '';
  return rows.map((row) => `${row.size}: ${row.stock}`).join('  ·  ');
};

const totalStock = (product) => {
  if (product.sizeStocks?.length) {
    return product.sizeStocks.reduce((n, row) => n + (Number(row.stock) || 0), 0);
  }
  return Number(product.stock) || 0;
};

const paintHeader = (row) => {
  row.height = 22;
  row.eachCell((cell) => {
    cell.font = { name: 'Calibri', bold: true, size: 11, color: { argb: WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INK } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = {
      bottom: { style: 'thin', color: { argb: INK } },
    };
  });
};

const paintBody = (row, index) => {
  row.height = 20;
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { name: 'Calibri', size: 11, color: { argb: INK } };
    cell.alignment = { vertical: 'middle', wrapText: true };
    cell.border = {
      bottom: { style: 'thin', color: { argb: LINE } },
    };
    if (index % 2 === 1) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } };
    }
  });
};

const addBanner = (sheet, lastCol, title, products) => {
  sheet.mergeCells(1, 1, 1, lastCol);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { name: 'Calibri', bold: true, size: 18, color: { argb: INK } };
  titleCell.alignment = { vertical: 'middle' };
  sheet.getRow(1).height = 28;

  sheet.mergeCells(2, 1, 2, lastCol);
  const note = sheet.getCell(2, 1);
  note.value = 'Internal use only. Item IDs are not shown to customers.';
  note.font = { name: 'Calibri', size: 11, italic: true, color: { argb: MUTED } };
  sheet.getRow(2).height = 18;

  const when = new Date().toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  sheet.mergeCells(3, 1, 3, lastCol);
  const meta = sheet.getCell(3, 1);
  meta.value = `Exported ${when}  ·  ${products.length} product${products.length === 1 ? '' : 's'}`;
  meta.font = { name: 'Calibri', size: 11, color: { argb: MUTED } };
  sheet.getRow(3).height = 18;
  sheet.getRow(4).height = 10;
};

const finishSheet = (sheet, headerRow, widths) => {
  sheet.views = [{ state: 'frozen', ySplit: headerRow, showGridLines: false }];
  sheet.autoFilter = {
    from: { row: headerRow, column: 1 },
    to: { row: headerRow, column: widths.length },
  };
  sheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9,
  };
  sheet.pageSetup.printTitlesRow = `${headerRow}:${headerRow}`;
  sheet.headerFooter = {
    oddFooter: '&LFutureFit&RPage &P of &N',
  };
  widths.forEach((width, i) => {
    sheet.getColumn(i + 1).width = width;
  });
};

/** Download a styled workbook of the full catalog. Item IDs are the staff-only codes. */
export async function downloadProductWorkbook(products) {
  const excel = await import('exceljs');
  const ExcelJS = excel.default || excel;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'FutureFit';
  workbook.created = new Date();

  const catalog = workbook.addWorksheet('Catalog', {
    properties: { defaultRowHeight: 20 },
  });
  const catalogHeaders = [
    'Item ID',
    'Product',
    'Status',
    'Department',
    'Category',
    'Price (EGP)',
    'Cost (EGP)',
    'Sale price (EGP)',
    'Colors',
    'Stock by size',
    'Total stock',
  ];
  addBanner(catalog, catalogHeaders.length, 'FutureFit  ·  Product catalog', products);
  const header = catalog.getRow(5);
  header.values = catalogHeaders;
  paintHeader(header);

  const sorted = [...products].sort((a, b) =>
    String(a.itemCode || '').localeCompare(String(b.itemCode || ''))
  );

  sorted.forEach((product, index) => {
    const onSale = product.isSaleActive && product.salePrice != null;
    const stock = totalStock(product);
    const row = catalog.getRow(6 + index);
    row.values = [
      product.itemCode || '',
      product.name || '',
      product.status === 'draft' ? 'Draft' : 'Active',
      audienceLabel(product.audience),
      categoryLabel(product) || '',
      money(product.price),
      money(product.cost),
      onSale ? money(product.salePrice) : null,
      (product.colors || []).join(', '),
      sizeLabel(product),
      stock,
    ];
    paintBody(row, index);
    row.getCell(1).font = { name: 'Consolas', bold: true, size: 11, color: { argb: INK } };
    row.getCell(6).numFmt = '#,##0.00';
    row.getCell(7).numFmt = '#,##0.00';
    row.getCell(8).numFmt = '#,##0.00';
    if (onSale) row.getCell(8).font = { name: 'Calibri', bold: true, size: 11, color: { argb: SALE } };
    if (product.status === 'draft') {
      row.getCell(3).font = { name: 'Calibri', bold: true, size: 11, color: { argb: DRAFT } };
    }
    if (stock === 0) {
      row.getCell(11).font = { name: 'Calibri', bold: true, size: 11, color: { argb: OUT } };
    }
  });

  finishSheet(catalog, 5, [16, 36, 12, 14, 22, 14, 14, 16, 28, 36, 14]);
  catalog.getColumn(6).alignment = { vertical: 'middle', horizontal: 'right' };
  catalog.getColumn(7).alignment = { vertical: 'middle', horizontal: 'right' };
  catalog.getColumn(8).alignment = { vertical: 'middle', horizontal: 'right' };
  catalog.getColumn(11).alignment = { vertical: 'middle', horizontal: 'right' };

  const sizes = workbook.addWorksheet('Stock by size');
  const sizeHeaders = ['Item ID', 'Product', 'Department', 'Category', 'Size', 'Stock', 'Price (EGP)', 'Cost (EGP)', 'Status'];
  addBanner(sizes, sizeHeaders.length, 'FutureFit  ·  Stock by size', products);
  const sizeHeader = sizes.getRow(5);
  sizeHeader.values = sizeHeaders;
  paintHeader(sizeHeader);

  let line = 0;
  sorted.forEach((product) => {
    const rows = product.sizeStocks?.length
      ? product.sizeStocks
      : [{ size: '—', stock: Number(product.stock) || 0 }];
    rows.forEach((sizeRow) => {
      const row = sizes.getRow(6 + line);
      const stock = Number(sizeRow.stock) || 0;
      row.values = [
        product.itemCode || '',
        product.name || '',
        audienceLabel(product.audience),
        categoryLabel(product) || '',
        sizeRow.size || '—',
        stock,
        money(product.price),
        money(product.cost),
        product.status === 'draft' ? 'Draft' : 'Active',
      ];
      paintBody(row, line);
      row.getCell(1).font = { name: 'Consolas', bold: true, size: 11, color: { argb: INK } };
      row.getCell(7).numFmt = '#,##0.00';
      row.getCell(8).numFmt = '#,##0.00';
      if (stock === 0) {
        row.getCell(6).font = { name: 'Calibri', bold: true, size: 11, color: { argb: OUT } };
      }
      line += 1;
    });
  });

  finishSheet(sizes, 5, [16, 36, 14, 22, 12, 12, 14, 14, 12]);
  sizes.getColumn(6).alignment = { vertical: 'middle', horizontal: 'right' };
  sizes.getColumn(7).alignment = { vertical: 'middle', horizontal: 'right' };
  sizes.getColumn(8).alignment = { vertical: 'middle', horizontal: 'right' };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const stamp = new Date().toISOString().slice(0, 10);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `futurefit-products-${stamp}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}
