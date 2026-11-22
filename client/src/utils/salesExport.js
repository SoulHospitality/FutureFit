/** Excel workbook of the sales report (Staff → Analytics → Export). */

const INK = 'FF18181B';
const HEAD_BG = 'FF18181B';
const LINE = 'FFE4E4E7';
const TOTAL_BG = 'FFF4F4F5';
const MONEY = '#,##0.00';
const COUNT = '#,##0';
const PCT = '0.0%';

const n = (v) => Number(v) || 0;

/**
 * Add a sheet from column specs: { header, key, width, fmt, total }.
 * `total: true` adds a bold SUM row under the data.
 */
function addTable(workbook, name, columns, rows) {
  const ws = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = columns.map((c) => ({ key: c.key, width: c.width || 14 }));
  const head = ws.getRow(1);
  head.values = columns.map((c) => c.header);
  head.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEAD_BG } };
    cell.alignment = { vertical: 'middle' };
  });
  head.height = 20;

  rows.forEach((r) => {
    const row = ws.addRow(columns.map((c) => r[c.key] ?? ''));
    row.eachCell({ includeEmpty: true }, (cell, i) => {
      const fmt = columns[i - 1]?.fmt;
      if (fmt) cell.numFmt = fmt;
      cell.font = { color: { argb: INK } };
      cell.border = { bottom: { style: 'thin', color: { argb: LINE } } };
    });
  });

  if (rows.length && columns.some((c) => c.total)) {
    const first = 2;
    const last = rows.length + 1;
    const total = ws.addRow(
      columns.map((c, i) => {
        if (i === 0) return 'Total';
        if (!c.total) return '';
        const col = ws.getColumn(i + 1).letter;
        // SUBTOTAL(109) ignores rows hidden by a filter, so totals follow what's shown
        return { formula: `SUBTOTAL(109,${col}${first}:${col}${last})` };
      })
    );
    total.eachCell({ includeEmpty: true }, (cell, i) => {
      const fmt = columns[i - 1]?.fmt;
      if (fmt) cell.numFmt = fmt;
      cell.font = { bold: true, color: { argb: INK } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_BG } };
    });
  }
  if (rows.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  return ws;
}

const shareOf = (value, total) => (total > 0 ? value / total : 0);

/** periodLabel e.g. "1 Nov – 15 Nov 2026"; data is the /analytics/summary response with rows. */
export async function downloadSalesWorkbook(data, { periodLabel, fileStem }) {
  const excel = await import('exceljs');
  const ExcelJS = excel.default || excel;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'FutureFit';
  wb.created = new Date();

  const m = data?.metrics || {};
  const changes = m.changes || {};
  const withChange = (v) => (v == null ? '' : v / 100);

  // Summary
  const summary = wb.addWorksheet('Summary');
  summary.columns = [{ width: 30 }, { width: 18 }, { width: 22 }];
  summary.addRow(['FutureFit sales report']).font = { bold: true, size: 14 };
  summary.addRow([periodLabel]);
  summary.addRow([`Exported ${new Date().toLocaleString('en-GB')}`]).font = { color: { argb: 'FF71717A' } };
  summary.addRow([]);
  const head = summary.addRow(['Metric', 'Value', 'vs previous period']);
  head.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEAD_BG } };
  });
  [
    ['Total sales (EGP)', n(m.totalSales), MONEY, changes.totalSales],
    ['Gross sales — items (EGP)', n(m.grossSales), MONEY, changes.grossSales],
    ['Discounts (EGP)', -n(m.discounts), MONEY],
    ['Net sales (EGP)', n(m.netSales), MONEY, changes.netSales],
    ['Shipping charged (EGP)', n(m.shippingCharges), MONEY],
    ['Orders', n(m.orderCount), COUNT, changes.orderCount],
    ['Units sold', n(m.unitsSold), COUNT, changes.unitsSold],
    ['Average order value (EGP)', n(m.averageOrderValue), MONEY, changes.averageOrderValue],
    ['Collected — paid orders (EGP)', n(m.paid), MONEY],
    ['Outstanding — unpaid orders (EGP)', n(m.outstanding), MONEY],
    ['Canceled orders', n(m.canceledCount), COUNT],
    ['Canceled order value (EGP)', n(m.canceledValue), MONEY],
    ['Store sessions', n(m.sessions), COUNT],
    ['Conversion rate', m.conversionRate == null ? '' : n(m.conversionRate) / 100, PCT],
    ['Returning customer rate', m.returningCustomerRate == null ? '' : n(m.returningCustomerRate) / 100, PCT],
  ].forEach(([label, value, fmt, change]) => {
    const row = summary.addRow([label, value, withChange(change)]);
    row.getCell(2).numFmt = fmt;
    row.getCell(3).numFmt = '+0.0%;-0.0%;0.0%';
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = { bottom: { style: 'thin', color: { argb: LINE } } };
    });
  });
  summary.addRow([]);
  summary.addRow(['Canceled orders are left out of every figure except the canceled rows.']).font = {
    italic: true,
    color: { argb: 'FF71717A' },
  };

  // Sales over time
  const mode = data?.range?.mode;
  const periodHeader = mode === 'hour' ? 'Hour' : mode === 'month' ? 'Month' : 'Date';
  addTable(
    wb,
    mode === 'hour' ? 'By hour' : mode === 'month' ? 'By month' : 'By day',
    [
      { header: periodHeader, key: 'label', width: 18 },
      { header: 'Orders', key: 'count', fmt: COUNT, total: true },
      { header: 'Units', key: 'units', fmt: COUNT, total: true },
      { header: 'Gross sales', key: 'gross', fmt: MONEY, total: true },
      { header: 'Discounts', key: 'discounts', fmt: MONEY, total: true },
      { header: 'Shipping', key: 'shipping', fmt: MONEY, total: true },
      { header: 'Total sales', key: 'value', fmt: MONEY, total: true },
    ],
    (data?.salesOverTime?.current || []).map((b) => ({
      ...b,
      label: mode === 'hour' ? String(b.label).replace('T', ' ') : b.label,
      discounts: -n(b.discounts),
    }))
  );

  const itemRevenue = (data?.byProduct || []).reduce((s, p) => s + n(p.revenue), 0);

  addTable(
    wb,
    'By product',
    [
      { header: 'Product', key: 'name', width: 40 },
      { header: 'Units sold', key: 'qty', fmt: COUNT, total: true },
      { header: 'Orders', key: 'orders', fmt: COUNT },
      { header: 'Sales — paid (EGP)', key: 'revenue', fmt: MONEY, width: 18, total: true },
      { header: 'Before discounts (EGP)', key: 'listRevenue', fmt: MONEY, width: 20, total: true },
      { header: 'Share of sales', key: 'share', fmt: PCT, width: 16 },
    ],
    (data?.byProduct || []).map((p) => ({ ...p, share: shareOf(n(p.revenue), itemRevenue) }))
  );

  addTable(
    wb,
    'By category',
    [
      { header: 'Category', key: 'category', width: 34 },
      { header: 'Units sold', key: 'qty', fmt: COUNT, total: true },
      { header: 'Orders', key: 'orders', fmt: COUNT },
      { header: 'Sales — paid (EGP)', key: 'revenue', fmt: MONEY, width: 18, total: true },
      { header: 'Share of sales', key: 'share', fmt: PCT, width: 16 },
    ],
    (data?.byCategory || []).map((c) => ({ ...c, share: shareOf(n(c.revenue), itemRevenue) }))
  );

  addTable(
    wb,
    'By payment',
    [
      { header: 'Payment method', key: 'method', width: 24 },
      { header: 'Orders', key: 'orders', fmt: COUNT, total: true },
      { header: 'Total sales (EGP)', key: 'revenue', fmt: MONEY, width: 18, total: true },
      { header: 'Collected (EGP)', key: 'paid', fmt: MONEY, width: 18, total: true },
    ],
    data?.byPaymentMethod || []
  );

  addTable(
    wb,
    'By location',
    [
      { header: 'Governorate', key: 'state', width: 20 },
      { header: 'City / area', key: 'city', width: 24 },
      { header: 'Orders', key: 'orders', fmt: COUNT, total: true },
      { header: 'Total sales (EGP)', key: 'revenue', fmt: MONEY, width: 18, total: true },
    ],
    data?.byLocation || []
  );

  const allOrders = data?.rows?.orders || [];
  const allItems = data?.rows?.items || [];
  const orderColumns = [
      { header: 'Order', key: 'order', width: 11 },
      { header: 'Date', key: 'date', width: 17 },
      { header: 'Customer', key: 'customer', width: 22 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Email', key: 'email', width: 24 },
      { header: 'Governorate', key: 'governorate', width: 14 },
      { header: 'City / area', key: 'city', width: 18 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Payment', key: 'payment', width: 18 },
      { header: 'Paid', key: 'paid', width: 7 },
      { header: 'Units', key: 'units', fmt: COUNT, width: 8, total: true },
      { header: 'Subtotal', key: 'subtotal', fmt: MONEY, total: true },
      { header: 'Discount', key: 'discount', fmt: MONEY, total: true },
      { header: 'Shipping', key: 'shipping', fmt: MONEY, total: true },
      { header: 'Total', key: 'total', fmt: MONEY, total: true },
      { header: 'Coupon', key: 'coupon', width: 12 },
  ];
  // Sales sheets match the Summary (no canceled orders); canceled ones get their own sheet
  addTable(wb, 'Orders', orderColumns, allOrders.filter((o) => o.status !== 'canceled'));

  addTable(
    wb,
    'Items sold',
    [
      { header: 'Order', key: 'order', width: 11 },
      { header: 'Date', key: 'date', width: 17 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Product', key: 'product', width: 36 },
      { header: 'Color', key: 'color', width: 14 },
      { header: 'Size', key: 'size', width: 9 },
      { header: 'Qty', key: 'qty', fmt: COUNT, width: 7, total: true },
      { header: 'Unit price', key: 'price', fmt: MONEY },
      { header: 'Before discounts', key: 'lineTotal', fmt: MONEY, width: 16, total: true },
      { header: 'Discount share', key: 'discount', fmt: MONEY, width: 15, total: true },
      { header: 'Paid', key: 'paid', fmt: MONEY, total: true },
    ],
    allItems.filter((it) => it.status !== 'canceled')
  );

  const canceled = allOrders.filter((o) => o.status === 'canceled');
  if (canceled.length) addTable(wb, 'Canceled orders', orderColumns, canceled);

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileStem}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
