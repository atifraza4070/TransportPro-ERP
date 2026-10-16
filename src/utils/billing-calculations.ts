/**
 * Pure billing calculation and rate matching engine for Fleet Bill 3.0.
 * Follows the exact formula and column logic from the Excel Invoice & Freight Rate sheets.
 */

export interface InvoiceItem {
  id: string;
  sr: number;
  cdDespatch: string;
  freightOrder: string;
  loadingDate: string;
  offloadingDate: string;
  vehicleNo: string;
  vehicleType?: string;
  distributorName: string;
  city: string;
  freight: number;
  unloading: number;
  move: number;
  haltingCustomer: number;
  haltingFactory: number;
  subTotal: number;
}

export interface InvoiceTotals {
  freightTotal: number;
  unloadingTotal: number;
  moveTotal: number;
  haltingCustomerTotal: number;
  haltingFactoryTotal: number;
  subTotal: number;
  taxRate: number;
  taxName: string;
  taxAmount: number;
  grandTotal: number;
}

export interface CustomerFreightRate {
  id: string;
  customerName: string;
  destination: string;
  rate20ft: number;
  rate40ft: number;
}

export interface CityFreightRate {
  id: string;
  cityName: string;
  rate20ft: number;
  rate24ftModified: number;
  rate32ftModified: number;
  rate40ft: number;
}

export type VehicleCategory =
  | '20 Ft Vehicle'
  | '23-24 Ft Modified'
  | '32 Ft Modified'
  | '40 Ft Vehicle'
  | '20ft'
  | '40ft'
  | string;

/**
 * Calculates a single invoice row subtotal.
 * Formula: Freight + Unloading + Move + Halting Charges Customer + Halting Charges Factory
 */
export function calculateRowSubTotal(
  freight: number = 0,
  unloading: number = 0,
  move: number = 0,
  haltingCustomer: number = 0,
  haltingFactory: number = 0
): number {
  const f = Number(freight) || 0;
  const u = Number(unloading) || 0;
  const m = Number(move) || 0;
  const hc = Number(haltingCustomer) || 0;
  const hf = Number(haltingFactory) || 0;
  return f + u + m + hc + hf;
}

/**
 * Calculates invoice grand summary from a list of line items and tax rate.
 */
export function calculateInvoiceTotals(
  items: Array<{
    freight?: number;
    unloading?: number;
    move?: number;
    haltingCustomer?: number;
    haltingFactory?: number;
  }>,
  taxRate: number = 15,
  taxName: string = 'Punjab 15% Tex'
): InvoiceTotals {
  let freightTotal = 0;
  let unloadingTotal = 0;
  let moveTotal = 0;
  let haltingCustomerTotal = 0;
  let haltingFactoryTotal = 0;

  for (const item of items) {
    const f = Number(item.freight) || 0;
    const u = Number(item.unloading) || 0;
    const m = Number(item.move) || 0;
    const hc = Number(item.haltingCustomer) || 0;
    const hf = Number(item.haltingFactory) || 0;

    freightTotal += f;
    unloadingTotal += u;
    moveTotal += m;
    haltingCustomerTotal += hc;
    haltingFactoryTotal += hf;
  }

  const subTotal = freightTotal + unloadingTotal + moveTotal + haltingCustomerTotal + haltingFactoryTotal;
  const effectiveTaxRate = Number(taxRate) || 0;
  const taxAmount = Math.round((subTotal * (effectiveTaxRate / 100)) * 100) / 100;
  const grandTotal = Math.round((subTotal + taxAmount) * 100) / 100;

  return {
    freightTotal,
    unloadingTotal,
    moveTotal,
    haltingCustomerTotal,
    haltingFactoryTotal,
    subTotal,
    taxRate: effectiveTaxRate,
    taxName,
    taxAmount,
    grandTotal,
  };
}

/**
 * Normalizes city names for robust rate matching.
 */
export function normalizeLocation(str: string): string {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

/**
 * Matches freight rates according to the customer-specific rate sheet or general city fleet sheet.
 */
export function matchFreightRate(
  destination: string,
  vehicleType: string,
  customerName?: string,
  customerRates: CustomerFreightRate[] = [],
  cityRates: CityFreightRate[] = []
): { matchedRate: number | null; source: 'customer_contract' | 'city_tariff' | null; note?: string } {
  const normDest = normalizeLocation(destination);
  if (!normDest) {
    return { matchedRate: null, source: null };
  }

  // 1. Check customer contract rates if customer specified
  if (customerName) {
    const normCust = normalizeLocation(customerName);
    const custMatch = customerRates.find((cr) => {
      const matchC = normalizeLocation(cr.customerName).includes(normCust) || normCust.includes(normalizeLocation(cr.customerName));
      const matchD = normalizeLocation(cr.destination) === normDest;
      return matchC && matchD;
    });

    if (custMatch) {
      const normVeh = vehicleType.toLowerCase();
      if (normVeh.includes('40')) {
        return { matchedRate: custMatch.rate40ft, source: 'customer_contract', note: `Customer Contract (${custMatch.customerName} - 40ft)` };
      }
      if (normVeh.includes('20')) {
        return { matchedRate: custMatch.rate20ft, source: 'customer_contract', note: `Customer Contract (${custMatch.customerName} - 20ft)` };
      }
    }
  }

  // 2. Check general city tariff
  const cityMatch = cityRates.find((cr) => {
    const nc = normalizeLocation(cr.cityName);
    return nc === normDest || nc.startsWith(normDest) || normDest.startsWith(nc);
  });

  if (cityMatch) {
    const normVeh = vehicleType.toLowerCase();
    if (normVeh.includes('40')) {
      return { matchedRate: cityMatch.rate40ft, source: 'city_tariff', note: `Tariff: ${cityMatch.cityName} (40 Ft)` };
    }
    if (normVeh.includes('32')) {
      return { matchedRate: cityMatch.rate32ftModified, source: 'city_tariff', note: `Tariff: ${cityMatch.cityName} (32 Ft Modified)` };
    }
    if (normVeh.includes('23') || normVeh.includes('24')) {
      return { matchedRate: cityMatch.rate24ftModified, source: 'city_tariff', note: `Tariff: ${cityMatch.cityName} (23-24 Ft Modified)` };
    }
    if (normVeh.includes('20')) {
      return { matchedRate: cityMatch.rate20ft, source: 'city_tariff', note: `Tariff: ${cityMatch.cityName} (20 Ft)` };
    }
    // Default to 20ft if vehicle type ambiguous
    return { matchedRate: cityMatch.rate20ft, source: 'city_tariff', note: `Tariff: ${cityMatch.cityName} (Default 20 Ft)` };
  }

  return { matchedRate: null, source: null };
}

/**
 * Validates invoice number format and uniqueness within a transporter account.
 */
export function validateInvoiceNumber(
  invoiceNumber: string,
  existingNumbers: string[],
  currentInvoiceId?: string,
  invoiceMap?: Record<string, string>
): { valid: boolean; error?: string } {
  const trimmed = (invoiceNumber || '').trim();
  if (!trimmed) {
    return { valid: false, error: 'Invoice number is required.' };
  }
  if (trimmed.length < 3) {
    return { valid: false, error: 'Invoice number must be at least 3 characters.' };
  }

  // Check collision
  if (invoiceMap && currentInvoiceId) {
    for (const [id, num] of Object.entries(invoiceMap)) {
      if (id !== currentInvoiceId && num.toLowerCase() === trimmed.toLowerCase()) {
        return { valid: false, error: `Invoice number "${trimmed}" is already used in your account.` };
      }
    }
  } else if (existingNumbers.some((n) => n.toLowerCase() === trimmed.toLowerCase())) {
    return { valid: false, error: `Invoice number "${trimmed}" already exists.` };
  }

  return { valid: true };
}

/**
 * Format currency in Pakistani Rupees (PKR) representation as in the Excel sheet
 */
export function formatCurrencyPKR(amount: number): string {
  const rounded = Math.round(Number(amount) || 0);
  return rounded.toLocaleString('en-US');
}

export interface RateComparisonWarning {
  field: string;
  vehicleCategory: string;
  enteredRate: number;
  existingRate: number;
  difference: number;
  percentageDiff: number;
  isLower: boolean;
  message: string;
}

/**
 * Compares an entered rate against an existing rate for identical route & vehicle criteria.
 * Returns a warning object if the newly entered rate is lower.
 */
export function compareRateValues(
  entered: number,
  existing: number,
  fieldLabel: string
): RateComparisonWarning | null {
  const ent = Number(entered) || 0;
  const ex = Number(existing) || 0;

  if (ent > 0 && ex > 0 && ent < ex) {
    const diff = ex - ent;
    const pct = Math.round((diff / ex) * 100);
    return {
      field: fieldLabel,
      vehicleCategory: fieldLabel,
      enteredRate: ent,
      existingRate: ex,
      difference: diff,
      percentageDiff: pct,
      isLower: true,
      message: `The entered ${fieldLabel} (Rs. ${formatCurrencyPKR(ent)}) is Rs. ${formatCurrencyPKR(diff)} (${pct}%) lower than the saved rate of Rs. ${formatCurrencyPKR(ex)}.`,
    };
  }
  return null;
}

