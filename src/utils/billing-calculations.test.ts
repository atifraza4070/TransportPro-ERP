import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateRowSubTotal,
  calculateInvoiceTotals,
  matchFreightRate,
  validateInvoiceNumber,
  formatCurrencyPKR,
} from './billing-calculations.ts';
import type { CustomerFreightRate, CityFreightRate } from './billing-calculations.ts';

test('Row subtotal calculation accurately sums freight and all additional charges', () => {
  // Row 1 from Screenshot 2: Multan, Freight 43200, Halting Customer 4000
  const row1 = calculateRowSubTotal(43200, 0, 0, 4000, 0);
  assert.equal(row1, 47200);

  // Row 3: Multan, Freight 39650, Move 6000
  const row3 = calculateRowSubTotal(39650, 0, 6000, 0, 0);
  assert.equal(row3, 45650);

  // Row 5: Haroonabad, Freight 89500, Halting Factory 6000
  const row5 = calculateRowSubTotal(89500, 0, 0, 0, 6000);
  assert.equal(row5, 95500);
});

test('Grand invoice calculation matches actual Excel template figures from screenshot', () => {
  const sampleItems = [
    { freight: 43200, unloading: 0, move: 0, haltingCustomer: 4000, haltingFactory: 0 },
    { freight: 39300, unloading: 0, move: 0, haltingCustomer: 0, haltingFactory: 0 },
    { freight: 39650, unloading: 0, move: 6000, haltingCustomer: 0, haltingFactory: 0 },
    { freight: 50000, unloading: 0, move: 0, haltingCustomer: 6000, haltingFactory: 0 },
    { freight: 89500, unloading: 0, move: 0, haltingCustomer: 0, haltingFactory: 6000 },
    { freight: 42200, unloading: 0, move: 0, haltingCustomer: 4000, haltingFactory: 0 },
    { freight: 42200, unloading: 0, move: 0, haltingCustomer: 4000, haltingFactory: 0 },
    { freight: 44100, unloading: 0, move: 0, haltingCustomer: 8000, haltingFactory: 0 },
    { freight: 18900, unloading: 0, move: 0, haltingCustomer: 16000, haltingFactory: 0 },
    { freight: 42200, unloading: 0, move: 0, haltingCustomer: 12000, haltingFactory: 0 },
    { freight: 25000, unloading: 0, move: 0, haltingCustomer: 15000, haltingFactory: 0 },
    { freight: 31500, unloading: 0, move: 0, haltingCustomer: 4000, haltingFactory: 0 },
    { freight: 20000, unloading: 0, move: 0, haltingCustomer: 6000, haltingFactory: 0 },
    { freight: 25000, unloading: 0, move: 0, haltingCustomer: 0, haltingFactory: 0 },
    { freight: 19600, unloading: 0, move: 0, haltingCustomer: 0, haltingFactory: 0 },
    { freight: 23500, unloading: 0, move: 0, haltingCustomer: 0, haltingFactory: 0 },
  ];

  const totals = calculateInvoiceTotals(sampleItems, 15, 'Punjab 15% Tex');

  assert.equal(totals.moveTotal, 6000);
  assert.equal(totals.haltingCustomerTotal, 79000);
  assert.equal(totals.haltingFactoryTotal, 6000);
  assert.equal(totals.subTotal, 686850);
  assert.equal(totals.taxAmount, 103027.5);
  assert.equal(totals.grandTotal, 789877.5);
});

test('Freight rate matching correctly matches customer rates and general city tariff', () => {
  const customerRates: CustomerFreightRate[] = [
    { id: '1', customerName: 'Coca Cola Beverages', destination: 'Raiwind', rate20ft: 28200, rate40ft: 51300 },
    { id: '2', customerName: 'Philip Morris International', destination: 'Qadirabad', rate20ft: 31500, rate40ft: 50000 },
  ];

  const cityRates: CityFreightRate[] = [
    { id: 'c1', cityName: 'Haroon Abad', rate20ft: 44100, rate24ftModified: 53700, rate32ftModified: 71600, rate40ft: 89500 },
    { id: 'c2', cityName: 'BahawalPur', rate20ft: 33200, rate24ftModified: 40400, rate32ftModified: 46700, rate40ft: 52500 },
  ];

  // Customer contract priority
  const match1 = matchFreightRate('Raiwind', '40ft', 'Coca Cola Beverages', customerRates, cityRates);
  assert.equal(match1.matchedRate, 51300);
  assert.equal(match1.source, 'customer_contract');

  // General city tariff
  const match2 = matchFreightRate('Haroon Abad', '40 Ft Vehicle', undefined, customerRates, cityRates);
  assert.equal(match2.matchedRate, 89500);
  assert.equal(match2.source, 'city_tariff');

  const match3 = matchFreightRate('Haroon Abad', '20 Ft Vehicle', undefined, customerRates, cityRates);
  assert.equal(match3.matchedRate, 44100);
  assert.equal(match3.source, 'city_tariff');

  // Missing rate
  const match4 = matchFreightRate('Unknown City', '20 Ft Vehicle', undefined, customerRates, cityRates);
  assert.equal(match4.matchedRate, null);
});

test('Invoice number validation checks length and prevents collision', () => {
  const existing = ['IK-BSP-26-001', 'IK-BSP-26-002'];

  assert.equal(validateInvoiceNumber('', existing).valid, false);
  assert.equal(validateInvoiceNumber('AB', existing).valid, false);
  assert.equal(validateInvoiceNumber('ik-bsp-26-001', existing).valid, false);
  assert.equal(validateInvoiceNumber('IK-BSP-26-003', existing).valid, true);
});

test('PKR currency formatting matches financial ledger display', () => {
  assert.equal(formatCurrencyPKR(686850), '686,850');
  assert.equal(formatCurrencyPKR(789877.5), '789,878');
});
