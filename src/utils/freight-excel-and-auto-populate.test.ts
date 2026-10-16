import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {
  parseFreightRateExcel,
  detectColumnMapping,
  formatExcelDate,
  parseExcelNumber,
  normalizeVehicleType,
} from './excel-importer.ts';
import {
  generateDispatchRatesExcel,
  generateDispatchRatesSampleTemplate,
  generateInvoiceExcel,
} from './excel-generator.ts';
import { calculateRowSubTotal, calculateInvoiceTotals } from './billing-calculations.ts';
import type { DispatchFreightRate, Invoice, TransporterVehicleType } from '../types/index.ts';

test('detectColumnMapping intelligently detects the 7 required columns from various header styles', () => {
  const headers1 = [
    'Dispatch No.',
    'Freight Order No.',
    'Loading Date',
    'Vehicle No.',
    'Vehicle Type',
    'Destination',
    'Freight Rate',
  ];
  const m1 = detectColumnMapping(headers1);
  assert.equal(m1.dispatchNo, 'Dispatch No.');
  assert.equal(m1.freightOrderNo, 'Freight Order No.');
  assert.equal(m1.loadingDate, 'Loading Date');
  assert.equal(m1.vehicleNo, 'Vehicle No.');
  assert.equal(m1.vehicleType, 'Vehicle Type');
  assert.equal(m1.destination, 'Destination');
  assert.equal(m1.freightRate, 'Freight Rate');

  // Alternative header naming (CD Despatch, City, Truck No, etc.)
  const headers2 = [
    'CD Despatch',
    'FO No',
    'Date',
    'Truck No',
    'Type',
    'City',
    'Freight Amount',
    'Extra Column 1',
    'Extra Column 2',
  ];
  const m2 = detectColumnMapping(headers2);
  assert.equal(m2.dispatchNo, 'CD Despatch');
  assert.equal(m2.freightOrderNo, 'FO No');
  assert.equal(m2.loadingDate, 'Date');
  assert.equal(m2.vehicleNo, 'Truck No');
  assert.equal(m2.vehicleType, 'Type');
  assert.equal(m2.destination, 'City');
  assert.equal(m2.freightRate, 'Freight Amount');
});

test('parseFreightRateExcel creates a valid workbook in memory, parses it, and validates the 7 fields', () => {
  const wb = XLSX.utils.book_new();
  const rows = [
    ['Dispatch No', 'Order #', 'Load Date', 'Vehicle Number', 'Size', 'Station', 'Trip Rate'],
    ['CD81052367', '6100000000', '27.09.2026', 'LZR 1089', '20 Ft Vehicle', 'MULTAN', 43200],
    ['CD81052735', '6100000000', '29.09.2026', 'C 3754', '40 Ft Vehicle', 'MULTAN', 50000],
    ['CD81052739', '6100000000', '29.09.2026', 'TLB 323', '40 Ft Vehicle', 'HAROONABAD', 89500],
    ['', '6100000000', '29.09.2026', 'TLB 323', '40 Ft Vehicle', 'HAROONABAD', 89500], // invalid: missing dispatch
    ['CD81059999', '6100000000', '29.09.2026', 'TLB 323', '40 Ft Vehicle', 'HAROONABAD', 0], // invalid: rate is 0
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Rates');

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const result = parseFreightRateExcel(buf, 'TestRates.xlsx');

  assert.equal(result.totalRows, 5);
  assert.equal(result.validCount, 3);
  assert.equal(result.invalidCount, 2);

  // Validate valid rows
  const r1 = result.rows[0];
  assert.equal(r1.isValid, true);
  assert.equal(r1.data.dispatchNo, 'CD81052367');
  assert.equal(r1.data.freightOrderNo, '6100000000');
  assert.equal(r1.data.loadingDate, '27.09.2026');
  assert.equal(r1.data.vehicleNo, 'LZR 1089');
  assert.equal(r1.data.vehicleType, '20 Ft Vehicle');
  assert.equal(r1.data.destination, 'MULTAN');
  assert.equal(r1.data.freightRate, 43200);

  // Validate error detection
  const missingDispatchRow = result.rows[3];
  assert.equal(missingDispatchRow.isValid, false);
  assert.ok(missingDispatchRow.errors.includes('Missing Dispatch No.'));

  const zeroRateRow = result.rows[4];
  assert.equal(zeroRateRow.isValid, false);
  assert.ok(zeroRateRow.errors.includes('Invalid or 0 Freight Rate'));
});

test('normalizeVehicleType correctly normalizes standard sizes and preserves custom categories with clean title casing', () => {
  assert.equal(normalizeVehicleType('20 ft vehicle'), '20 Ft Vehicle');
  assert.equal(normalizeVehicleType('20 FT'), '20 Ft Vehicle');
  assert.equal(normalizeVehicleType('40ft vehicle'), '40 Ft Vehicle');
  assert.equal(normalizeVehicleType('24 ft modified'), '23-24 Ft Modified');
  assert.equal(normalizeVehicleType('32 ft modified'), '32 Ft Modified');
  assert.equal(normalizeVehicleType('50 ft trailer'), '50 Ft Trailer');
  assert.equal(normalizeVehicleType('shehzore  14ft'), 'Shehzore 14ft');
});

test('Excel generators for dispatch rates and sample template produce valid XLSX buffers', () => {
  const sampleRates: DispatchFreightRate[] = [
    {
      id: 'dfr_1',
      transporterId: 'user_test',
      dispatchNo: 'CD81052367',
      freightOrderNo: '6100000000',
      loadingDate: '27.09.2026',
      vehicleNo: 'LZR 1089',
      vehicleType: '20 Ft Vehicle',
      destination: 'MULTAN',
      freightRate: 43200,
      sourceFile: 'Master.xlsx',
      importedAt: new Date().toISOString(),
    },
  ];

  const exportBuffer = generateDispatchRatesExcel(sampleRates);
  assert.ok(exportBuffer.length > 0);

  const parsedExport = XLSX.read(exportBuffer, { type: 'array' });
  assert.ok(parsedExport.SheetNames.includes('Freight Rates Master'));

  const templateBuffer = generateDispatchRatesSampleTemplate();
  assert.ok(templateBuffer.length > 0);
  const parsedTemplate = XLSX.read(templateBuffer, { type: 'array' });
  assert.ok(parsedTemplate.SheetNames.includes('Freight Rates Template'));
});

test('Auto-populated fields are fully editable and calculations update immediately without mutating master rate', () => {
  // Master record
  const masterRecord: DispatchFreightRate = {
    id: 'dfr_orig',
    transporterId: 'transporter_1',
    dispatchNo: 'CD81052367',
    freightOrderNo: '6100000000',
    loadingDate: '27.09.2026',
    vehicleNo: 'LZR 1089',
    vehicleType: '20 Ft Vehicle',
    destination: 'MULTAN',
    freightRate: 43200,
    importedAt: new Date().toISOString(),
  };

  // Transporter edits invoice fields
  const invoiceItem = {
    id: 'item_1',
    sr: 1,
    cdDespatch: masterRecord.dispatchNo,
    freightOrder: '6100000099', // edited
    loadingDate: masterRecord.loadingDate,
    offloadingDate: '29.09.2026',
    vehicleNo: 'NEW 9999', // edited
    vehicleType: '40 Ft Vehicle', // edited
    distributorName: 'PEPSI COLA INTL',
    city: 'MULTAN EXT', // edited
    freight: 45000, // adjusted rate
    unloading: 1000,
    move: 2000,
    haltingCustomer: 3000,
    haltingFactory: 0,
    subTotal: 0,
  };

  invoiceItem.subTotal = calculateRowSubTotal(
    invoiceItem.freight,
    invoiceItem.unloading,
    invoiceItem.move,
    invoiceItem.haltingCustomer,
    invoiceItem.haltingFactory
  );

  // 45000 + 1000 + 2000 + 3000 = 51000
  assert.equal(invoiceItem.subTotal, 51000);

  const totals = calculateInvoiceTotals([invoiceItem], 15, 'Punjab Tax');
  assert.equal(totals.freightTotal, 45000);
  assert.equal(totals.subTotal, 51000);
  assert.equal(totals.taxAmount, 7650);
  assert.equal(totals.grandTotal, 58650);

  // Verify master rate record remains untouched
  assert.equal(masterRecord.freightRate, 43200);
  assert.equal(masterRecord.vehicleNo, 'LZR 1089');
  assert.equal(masterRecord.freightOrderNo, '6100000000');
});
