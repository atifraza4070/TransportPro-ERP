import * as XLSX from 'xlsx';
import type { Invoice, CustomerFreightRate, CityFreightRate, DispatchFreightRate } from '../types';

/**
 * Generates an Excel workbook for an invoice that reproduces the layout and structure
 * of the user's original billing sheet (as shown in Screenshot 2).
 */
export function generateInvoiceExcel(invoice: Invoice): Uint8Array {
  const wb = XLSX.utils.book_new();

  // Create an array of rows (2D array)
  const rows: (string | number | null)[][] = [];

  // Row 1: Headers
  rows.push([
    invoice.transporterCompanyName || 'IK LOGISTICS (SMC) PVT LTD',
    null, null, null, null, null, null, null,
    invoice.customerName || 'M/S BULLEH SHAH PACKAGING (PVT) LTD'
  ]);

  // Row 2: Address
  rows.push([
    invoice.transporterAddress || 'BSP GATE NO.1, 10KM KRK ROAD KASUR',
    null, null, null, null, null, null, null,
    invoice.customerAddress || 'Shahrah-e-Roomi, P.O Amer Sidhu Lahore'
  ]);

  // Row 3: Contacts
  rows.push([
    `Ph: ${invoice.transporterPhone || '0301 6411664'} / E.Mail: ${invoice.transporterEmail || 'iklogisticsofficial@gmail.com'}`,
    null, null, null, null, null, null, null,
    null
  ]);

  // Row 4: NTN numbers
  rows.push([
    `NTN # ${invoice.transporterNtn || 'J-622143'}`,
    null, null, null, null, null, null, null,
    `NTN # ${invoice.customerNtn || '3000673-2'}`
  ]);

  // Row 5: Invoice No & Customer STRN
  rows.push([
    invoice.invoiceNumber,
    null, null, null, null, null, null, null,
    `STRN # ${invoice.customerStrn || '1700300067314'}`
  ]);

  // Row 6: Invoice Date
  rows.push([
    `Date: ${invoice.invoiceDate} ${invoice.deliveryCode || 'CD'}`,
    null, null, null, null, null, null, null,
    null
  ]);

  // Row 7: Empty spacer
  rows.push([]);

  // Row 8: Table Header (with sub-header for charges & halting)
  rows.push([
    'Sr. #',
    'CD Despatch',
    'Freight Order',
    'Loading Date',
    'Offloading Date',
    'Vehicle No',
    'Distributor Name',
    'City',
    'Freight',
    'Unloading',
    'Move',
    'Halting Customer',
    'Halting Factory',
    'Sub Total Rs.'
  ]);

  // Rows 9+: Line items
  invoice.items.forEach((item, index) => {
    rows.push([
      item.sr || index + 1,
      item.cdDespatch || '',
      item.freightOrder || '',
      item.loadingDate || '',
      item.offloadingDate || '',
      item.vehicleNo || '',
      item.distributorName || '',
      item.city || '',
      Number(item.freight) || 0,
      Number(item.unloading) || 0,
      Number(item.move) || 0,
      Number(item.haltingCustomer) || 0,
      Number(item.haltingFactory) || 0,
      Number(item.subTotal) || 0,
    ]);
  });

  // Grand Total row inside items table
  rows.push([
    null,
    null,
    null,
    null,
    null,
    null,
    'GRAND TOTAL',
    null,
    invoice.freightTotal,
    invoice.unloadingTotal,
    invoice.moveTotal,
    invoice.haltingCustomerTotal,
    invoice.haltingFactoryTotal,
    invoice.subTotal,
  ]);

  // Spacer
  rows.push([]);

  // Summary box
  rows.push([
    null, null, null, null, null, null, null, null, null, null, null,
    'Sub Total Rs.',
    null,
    invoice.subTotal
  ]);
  rows.push([
    null, null, null, null, null, null, null, null, null, null, null,
    invoice.taxName || 'Total Punjab 15% Tex',
    null,
    invoice.taxAmount
  ]);
  rows.push([
    null, null, null, null, null, null, null, null, null, null, null,
    'Grand Total',
    null,
    invoice.grandTotal
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Set column widths to make it beautiful and readable
  ws['!cols'] = [
    { wch: 6 },  // Sr. #
    { wch: 14 }, // CD Despatch
    { wch: 16 }, // Freight Order
    { wch: 13 }, // Loading Date
    { wch: 14 }, // Offloading Date
    { wch: 13 }, // Vehicle No
    { wch: 28 }, // Distributor Name
    { wch: 18 }, // City
    { wch: 12 }, // Freight
    { wch: 12 }, // Unloading
    { wch: 10 }, // Move
    { wch: 15 }, // Halting Customer
    { wch: 15 }, // Halting Factory
    { wch: 14 }, // Sub Total Rs.
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Billing Sheet');
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(buffer);
}

/**
 * Generates an Excel file for freight rates matching Screenshot 3
 */
export function generateFreightRatesExcel(
  customerRates: CustomerFreightRate[],
  cityRates: CityFreightRate[]
): Uint8Array {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Customer Rates
  const custRows: (string | number | null)[][] = [
    ['Sr. No', 'Customer', 'Destination', '20ft Vehicle Rate/Trip', '40ft Vehicle Rate/Trip']
  ];
  customerRates.forEach((cr, i) => {
    custRows.push([i + 1, cr.customerName, cr.destination, cr.rate20ft, cr.rate40ft]);
  });
  const wsCust = XLSX.utils.aoa_to_sheet(custRows);
  wsCust['!cols'] = [{ wch: 8 }, { wch: 30 }, { wch: 20 }, { wch: 22 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, wsCust, 'Customer Freight Rates');

  // Sheet 2: City Rates
  const cityRows: (string | number | null)[][] = [
    ['Sr. No', 'City Name', '20 Ft Vehicle', '23-24 Ft Modified', '32 Ft Modified', '40 Ft Vehicle']
  ];
  cityRates.forEach((cr, i) => {
    cityRows.push([i + 1, cr.cityName, cr.rate20ft, cr.rate24ftModified, cr.rate32ftModified, cr.rate40ft]);
  });
  const wsCity = XLSX.utils.aoa_to_sheet(cityRows);
  wsCity['!cols'] = [{ wch: 8 }, { wch: 26 }, { wch: 18 }, { wch: 20 }, { wch: 18 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsCity, 'City Tariffs');

  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(buffer);
}

/**
 * Triggers a browser download of an ArrayBuffer as an .xlsx file.
 */
export function downloadExcelFile(data: Uint8Array, filename: string): void {
  const blob = new Blob([data as unknown as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generates an Excel workbook for Dispatch Freight Rates master list
 */
export function generateDispatchRatesExcel(rates: DispatchFreightRate[]): Uint8Array {
  const wb = XLSX.utils.book_new();

  const rows: (string | number | null)[][] = [
    ['Dispatch No.', 'Freight Order No.', 'Loading Date', 'Vehicle No.', 'Vehicle Type', 'Destination', 'Freight Rate', 'Source File', 'Imported At']
  ];

  rates.forEach((r) => {
    rows.push([
      r.dispatchNo,
      r.freightOrderNo || '',
      r.loadingDate || '',
      r.vehicleNo || '',
      r.vehicleType || '',
      r.destination || '',
      Number(r.freightRate) || 0,
      r.sourceFile || '',
      r.importedAt ? new Date(r.importedAt).toLocaleDateString() : '',
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 18 }, // Dispatch No.
    { wch: 18 }, // Freight Order No.
    { wch: 14 }, // Loading Date
    { wch: 16 }, // Vehicle No.
    { wch: 18 }, // Vehicle Type
    { wch: 22 }, // Destination
    { wch: 16 }, // Freight Rate
    { wch: 24 }, // Source File
    { wch: 16 }, // Imported At
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Freight Rates Master');
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(buffer);
}

/**
 * Generates an empty / sample template Excel workbook for uploading freight rates
 */
export function generateDispatchRatesSampleTemplate(): Uint8Array {
  const wb = XLSX.utils.book_new();

  const rows: (string | number | null)[][] = [
    ['Dispatch No.', 'Freight Order No.', 'Loading Date', 'Vehicle No.', 'Vehicle Type', 'Destination', 'Freight Rate'],
    ['CD81052367', '6100000000', '27.09.2026', 'LZR 1089', '20 Ft Vehicle', 'MULTAN', 43200],
    ['CD81052409', '6100000000', '27.09.2026', 'GLT 5105', '20 Ft Vehicle', 'MULTAN', 39300],
    ['CD81052735', '6100000000', '29.09.2026', 'C 3754', '40 Ft Vehicle', 'MULTAN', 50000],
    ['CD81052739', '6100000000', '29.09.2026', 'TLB 323', '40 Ft Vehicle', 'HAROONABAD', 89500],
    ['B.NO: 11', 'CP-511', '01.10.2026', 'TAY 590', '20 Ft Vehicle', 'KASUR', 19600],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 18 },
    { wch: 18 },
    { wch: 14 },
    { wch: 16 },
    { wch: 20 },
    { wch: 20 },
    { wch: 16 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Freight Rates Template');
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(buffer);
}

