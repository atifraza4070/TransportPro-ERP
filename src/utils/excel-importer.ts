import * as XLSX from 'xlsx';
import type { DispatchFreightRate } from '../types';

export interface ColumnMapping {
  dispatchNo: string;
  freightOrderNo: string;
  loadingDate: string;
  vehicleNo: string;
  vehicleType: string;
  destination: string;
  freightRate: string;
}

export interface ParsedDispatchRow {
  rowNumber: number;
  raw: Record<string, any>;
  data: {
    dispatchNo: string;
    freightOrderNo: string;
    loadingDate: string;
    vehicleNo: string;
    vehicleType: string;
    destination: string;
    freightRate: number;
  };
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ExcelImportResult {
  fileName: string;
  sheetName: string;
  availableSheets: string[];
  totalRows: number;
  availableColumns: string[];
  mapping: ColumnMapping;
  detectedTypes: string[];
  rows: ParsedDispatchRow[];
  validCount: number;
  invalidCount: number;
  hasErrors: boolean;
}

// Synonyms dictionary for smart auto-detection
const HEADER_SYNONYMS: Record<keyof ColumnMapping, string[]> = {
  dispatchNo: [
    'dispatch no',
    'dispatch no.',
    'dispatch number',
    'cd despatch',
    'cd despatch no',
    'cd despatch no.',
    'cd despatch #',
    'despatch no',
    'despatch no.',
    'despatch',
    'dispatch',
    'cd #',
    'cd no',
    'cd',
    'b.no',
    'b.no:',
    'b. no',
    'bill no',
    'challan no',
    'challan',
    'gate pass',
    'gp no',
    'd.o. no',
    'do no',
  ],
  freightOrderNo: [
    'freight order',
    'freight order no',
    'freight order no.',
    'freight order #',
    'freight order number',
    'fo no',
    'fo no.',
    'fo #',
    'fo',
    'order no',
    'order number',
    'booking no',
    'f.o. no',
    'f.o no.',
    'f.o #',
    'po no',
    'order',
  ],
  loadingDate: [
    'loading date',
    'loading date.',
    'load date',
    'date',
    'dispatch date',
    'despatch date',
    'shipment date',
    'loading dt',
    'loading',
    'ld date',
    'date of loading',
  ],
  vehicleNo: [
    'vehicle no',
    'vehicle no.',
    'vehicle #',
    'vehicle number',
    'truck no',
    'truck no.',
    'truck #',
    'lorry no',
    'lorry no.',
    'reg no',
    'registration no',
    'veh no',
    'veh #',
  ],
  vehicleType: [
    'vehicle type',
    'vehicle type.',
    'type',
    'vehicle size',
    'size',
    'truck type',
    'category',
    'vehicle category',
    'truck size',
    'container size',
    'veh type',
  ],
  destination: [
    'destination',
    'city',
    'station',
    'dest',
    'to',
    'delivery location',
    'drop location',
    'unloading point',
    'target station',
    'distributor city',
    'location',
    'place',
  ],
  freightRate: [
    'freight rate',
    'freight rate.',
    'freight',
    'rate',
    'freight amount',
    'amount',
    'total freight',
    'agreed rate',
    'trip rate',
    'fare',
    'charges',
    'rate per trip',
    'sub total',
    'sub total rs.',
  ],
};

function normalizeHeader(h: string): string {
  return String(h || '')
    .toLowerCase()
    .replace(/[_\-\/\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Auto-detect the best matching column for a field
 */
export function detectColumnMapping(headers: string[]): ColumnMapping {
  const normHeaders = headers.map((h) => ({ original: h, normalized: normalizeHeader(h) }));

  const mapping: ColumnMapping = {
    dispatchNo: '',
    freightOrderNo: '',
    loadingDate: '',
    vehicleNo: '',
    vehicleType: '',
    destination: '',
    freightRate: '',
  };

  const fields = Object.keys(HEADER_SYNONYMS) as (keyof ColumnMapping)[];

  for (const field of fields) {
    const synonyms = HEADER_SYNONYMS[field];
    // 1. Exact match
    const exact = normHeaders.find((nh) => synonyms.includes(nh.normalized));
    if (exact) {
      mapping[field] = exact.original;
      continue;
    }

    // 2. Contains match
    const contains = normHeaders.find((nh) =>
      synonyms.some((syn) => nh.normalized === syn || nh.normalized.includes(syn) || syn.includes(nh.normalized))
    );
    if (contains) {
      mapping[field] = contains.original;
    }
  }

  return mapping;
}

/**
 * Robust date formatting: handles Excel numeric serial dates or string dates
 */
export function formatExcelDate(raw: any): string {
  if (raw === null || raw === undefined || raw === '') return '';

  // If number: likely Excel serial date
  if (typeof raw === 'number' && raw > 30000 && raw < 80000) {
    try {
      const dateObj = XLSX.SSF.parse_date_code(raw);
      if (dateObj) {
        const dd = String(dateObj.d).padStart(2, '0');
        const mm = String(dateObj.m).padStart(2, '0');
        const yyyy = dateObj.y;
        return `${dd}.${mm}.${yyyy}`;
      }
    } catch {
      // fallback to string
    }
  }

  const str = String(raw).trim();
  // Check if string contains standard format
  // If DD.MM.YYYY already
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(str)) return str;

  // If YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (isoMatch) {
    const [, yyyy, mm, dd] = isoMatch;
    return `${dd.padStart(2, '0')}.${mm.padStart(2, '0')}.${yyyy}`;
  }

  // If DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmyMatch) {
    const [, dd, mm, yyyy] = dmyMatch;
    return `${dd.padStart(2, '0')}.${mm.padStart(2, '0')}.${yyyy}`;
  }

  return str;
}

/**
 * Robust numeric parser for freight rate (removes commas, PKR, Rs., etc.)
 */
export function parseExcelNumber(raw: any): number {
  if (typeof raw === 'number') return isNaN(raw) ? 0 : raw;
  if (!raw) return 0;
  const cleaned = String(raw)
    .replace(/[^\d.-]/g, '')
    .trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Normalize vehicle type name (e.g. "20 ft vehicle" -> "20 Ft Vehicle")
 */
export function normalizeVehicleType(raw: string): string {
  const trimmed = (raw || '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return '20 Ft Vehicle';

  const lower = trimmed.toLowerCase();
  if (lower.includes('20') && lower.includes('ft')) return '20 Ft Vehicle';
  if (lower.includes('24') || lower.includes('23')) return '23-24 Ft Modified';
  if (lower.includes('32')) return '32 Ft Modified';
  if (lower.includes('40')) return '40 Ft Vehicle';

  // Capitalize words
  return trimmed
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Parse an Excel file (.xlsx, .xls, .csv) into structured DispatchFreightRate preview
 */
export function parseFreightRateExcel(
  fileData: ArrayBuffer,
  fileName: string,
  customMapping?: Partial<ColumnMapping>,
  selectedSheet?: string
): ExcelImportResult {
  const workbook = XLSX.read(fileData, { type: 'array', cellDates: false });
  const availableSheets = workbook.SheetNames;
  const sheetName = selectedSheet && availableSheets.includes(selectedSheet) ? selectedSheet : availableSheets[0];
  const worksheet = workbook.Sheets[sheetName];

  // Convert sheet to JSON rows with raw headers
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, {
    defval: '',
    raw: true,
  });

  // Extract all columns
  const availableColumns: string[] = [];
  if (rawRows.length > 0) {
    for (const key of Object.keys(rawRows[0])) {
      if (key && !key.startsWith('__EMPTY') && !availableColumns.includes(key)) {
        availableColumns.push(key);
      }
    }
  }

  // Detect mapping
  const autoMapping = detectColumnMapping(availableColumns);
  const mapping: ColumnMapping = {
    dispatchNo: customMapping?.dispatchNo || autoMapping.dispatchNo || '',
    freightOrderNo: customMapping?.freightOrderNo || autoMapping.freightOrderNo || '',
    loadingDate: customMapping?.loadingDate || autoMapping.loadingDate || '',
    vehicleNo: customMapping?.vehicleNo || autoMapping.vehicleNo || '',
    vehicleType: customMapping?.vehicleType || autoMapping.vehicleType || '',
    destination: customMapping?.destination || autoMapping.destination || '',
    freightRate: customMapping?.freightRate || autoMapping.freightRate || '',
  };

  const detectedTypesSet = new Set<string>();
  const parsedRows: ParsedDispatchRow[] = [];
  let validCount = 0;
  let invalidCount = 0;

  rawRows.forEach((raw, idx) => {
    // If all required mapped cells are empty, skip empty row
    const rowNumber = idx + 2; // Accounting for 1-based index and header row

    const rawDispatch = mapping.dispatchNo ? raw[mapping.dispatchNo] : '';
    const rawFO = mapping.freightOrderNo ? raw[mapping.freightOrderNo] : '';
    const rawDate = mapping.loadingDate ? raw[mapping.loadingDate] : '';
    const rawVeh = mapping.vehicleNo ? raw[mapping.vehicleNo] : '';
    const rawType = mapping.vehicleType ? raw[mapping.vehicleType] : '';
    const rawDest = mapping.destination ? raw[mapping.destination] : '';
    const rawRate = mapping.freightRate ? raw[mapping.freightRate] : '';

    const dispatchNo = String(rawDispatch || '').trim();
    const freightOrderNo = String(rawFO || '').trim();
    const loadingDate = formatExcelDate(rawDate);
    const vehicleNo = String(rawVeh || '').trim().toUpperCase();
    const vehicleType = normalizeVehicleType(String(rawType || ''));
    const destination = String(rawDest || '').trim().toUpperCase();
    const freightRate = parseExcelNumber(rawRate);

    // Skip entirely empty filler rows
    if (!dispatchNo && !freightOrderNo && !vehicleNo && !destination && freightRate === 0) {
      return;
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Validation 1: Dispatch No.
    if (!dispatchNo) {
      errors.push('Missing Dispatch No.');
    }

    // Validation 2: Freight Rate
    if (freightRate <= 0) {
      errors.push('Invalid or 0 Freight Rate');
    }

    // Non-blocking warnings
    if (!destination) {
      warnings.push('Destination is blank');
    }
    if (!vehicleNo) {
      warnings.push('Vehicle No. is blank');
    }
    if (!loadingDate) {
      warnings.push('Loading Date is blank');
    }

    if (vehicleType) {
      detectedTypesSet.add(vehicleType);
    }

    const isValid = errors.length === 0;
    if (isValid) {
      validCount++;
    } else {
      invalidCount++;
    }

    parsedRows.push({
      rowNumber,
      raw,
      data: {
        dispatchNo,
        freightOrderNo,
        loadingDate,
        vehicleNo,
        vehicleType,
        destination,
        freightRate,
      },
      isValid,
      errors,
      warnings,
    });
  });

  return {
    fileName,
    sheetName,
    availableSheets,
    totalRows: parsedRows.length,
    availableColumns,
    mapping,
    detectedTypes: Array.from(detectedTypesSet),
    rows: parsedRows,
    validCount,
    invalidCount,
    hasErrors: invalidCount > 0,
  };
}
