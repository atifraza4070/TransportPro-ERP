import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import * as XLSX from 'xlsx';
import type {
  UserProfile,
  Customer,
  Vehicle,
  CustomerFreightRate,
  CityFreightRate,
  DispatchFreightRate,
  TransporterVehicleType,
  Invoice,
  InvoiceItem,
  AuditLog,
  PricingSettings,
} from '../src/types';

dotenv.config();

// ---------------- BILLING & EXCEL HELPERS (SELF-CONTAINED FOR VERCEL ESM) ----------------
function calculateInvoiceTotals(
  items: Array<{
    freight?: number;
    unloading?: number;
    move?: number;
    haltingCustomer?: number;
    haltingFactory?: number;
  }>,
  taxRate: number = 15,
  taxName: string = 'Punjab 15% Tex'
) {
  let freightTotal = 0;
  let unloadingTotal = 0;
  let moveTotal = 0;
  let haltingCustomerTotal = 0;
  let haltingFactoryTotal = 0;

  for (const item of items) {
    freightTotal += Number(item.freight) || 0;
    unloadingTotal += Number(item.unloading) || 0;
    moveTotal += Number(item.move) || 0;
    haltingCustomerTotal += Number(item.haltingCustomer) || 0;
    haltingFactoryTotal += Number(item.haltingFactory) || 0;
  }

  const subTotal = freightTotal + unloadingTotal + moveTotal + haltingCustomerTotal + haltingFactoryTotal;
  const effectiveTaxRate = Number(taxRate) >= 0 ? Number(taxRate) : 15;
  const taxAmount = Math.round(subTotal * (effectiveTaxRate / 100));
  const grandTotal = subTotal + taxAmount;

  return {
    freightTotal,
    unloadingTotal,
    moveTotal,
    haltingCustomerTotal,
    haltingFactoryTotal,
    subTotal,
    taxRate: effectiveTaxRate,
    taxName: taxName || `Punjab ${effectiveTaxRate}% Tex`,
    taxAmount,
    grandTotal,
  };
}

function validateInvoiceNumber(
  invoiceNumber: string,
  existingNumbers: string[],
  currentInvoiceId?: string,
  existingInvoiceIdMap?: Record<string, string>
): { valid: boolean; error?: string } {
  const clean = (invoiceNumber || '').trim();
  if (!clean) {
    return { valid: false, error: 'Invoice number is required and cannot be empty.' };
  }
  if (existingInvoiceIdMap && currentInvoiceId) {
    for (const [id, num] of Object.entries(existingInvoiceIdMap)) {
      if (id !== currentInvoiceId && num.trim().toLowerCase() === clean.toLowerCase()) {
        return { valid: false, error: `Invoice number "${clean}" is already used by another invoice.` };
      }
    }
    return { valid: true };
  }
  const isDuplicate = existingNumbers.some((n) => n.trim().toLowerCase() === clean.toLowerCase());
  if (isDuplicate) {
    return { valid: false, error: `Invoice number "${clean}" already exists.` };
  }
  return { valid: true };
}

function generateInvoiceExcel(invoice: Invoice): Uint8Array {
  const xlsxLib: any = (XLSX as any).default || XLSX;
  const wb = xlsxLib.utils.book_new();
  const rows: any[][] = [];

  rows.push([invoice.transporterCompanyName || 'TRANSPORTER INVOICE']);
  rows.push([invoice.transporterAddress || '']);
  rows.push([
    `NTN: ${invoice.transporterNtn || '-'}`,
    '',
    `STRN: ${invoice.transporterStrn || '-'}`,
    '',
    `Phone: ${invoice.transporterPhone || '-'}`,
  ]);
  rows.push([]);
  rows.push(['INVOICE NO:', invoice.invoiceNumber, '', 'DATE:', invoice.invoiceDate]);
  rows.push(['CUSTOMER:', invoice.customerName, '', 'DELIVERY CODE:', invoice.deliveryCode || 'CD']);
  rows.push(['ADDRESS:', invoice.customerAddress || '']);
  rows.push(['CUSTOMER NTN:', invoice.customerNtn || '-', '', 'CUSTOMER STRN:', invoice.customerStrn || '-']);
  rows.push([]);

  rows.push([
    'Sr',
    'CD / Despatch No.',
    'Freight Order',
    'Loading Date',
    'Offloading Date',
    'Vehicle No.',
    'Vehicle Type',
    'Distributor Name',
    'City',
    'Freight',
    'Unloading',
    'Move',
    'Halting (Cust)',
    'Halting (Fact)',
    'Sub Total',
  ]);

  for (const item of invoice.items || []) {
    rows.push([
      item.sr,
      item.cdDespatch,
      item.freightOrder,
      item.loadingDate,
      item.offloadingDate,
      item.vehicleNo,
      item.vehicleType || '20 Ft Vehicle',
      item.distributorName,
      item.city,
      item.freight,
      item.unloading,
      item.move,
      item.haltingCustomer,
      item.haltingFactory,
      item.subTotal,
    ]);
  }

  rows.push([]);
  rows.push([
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    'TOTALS:',
    invoice.freightTotal,
    invoice.unloadingTotal,
    invoice.moveTotal,
    invoice.haltingCustomerTotal,
    invoice.haltingFactoryTotal,
    invoice.subTotal,
  ]);
  rows.push(['', '', '', '', '', '', '', '', invoice.taxName || `Tax (${invoice.taxRate}%)`, '', '', '', '', '', invoice.taxAmount]);
  rows.push(['', '', '', '', '', '', '', '', 'GRAND TOTAL (PKR):', '', '', '', '', '', invoice.grandTotal]);

  const ws = xlsxLib.utils.aoa_to_sheet(rows);
  xlsxLib.utils.book_append_sheet(wb, ws, 'Invoice');
  const buf = xlsxLib.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return new Uint8Array(buf);
}

// ---------------- STORAGE ENGINE (VERCEL /TMP & LOCAL SAFE) ----------------
interface DatabaseSchema {
  users: (UserProfile & { passwordHash: string })[];
  customers: Customer[];
  vehicles: Vehicle[];
  customerFreightRates: CustomerFreightRate[];
  cityFreightRates: CityFreightRate[];
  dispatchFreightRates?: DispatchFreightRate[];
  vehicleTypes?: TransporterVehicleType[];
  invoices: Invoice[];
  auditLogs: AuditLog[];
  pricing: PricingSettings;
  smtp?: {
    user: string;
    pass: string;
    host?: string;
    port?: number;
    fromName?: string;
  };
}

function resolveWritableDataDir(): string {
  const localDir = path.resolve(process.cwd(), 'data');
  if (!process.env.VERCEL) {
    try {
      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
      }
      const testFile = path.join(localDir, '.write_test');
      fs.writeFileSync(testFile, 'ok', 'utf-8');
      fs.unlinkSync(testFile);
      return localDir;
    } catch {
      // Fallback to /tmp if current directory is read-only
    }
  }
  const tmpDir = path.join(os.tmpdir(), 'fleetbill_data');
  try {
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
  } catch {
    // Ignore mkdir error in restricted environments
  }
  return tmpDir;
}

const DATA_DIR = resolveWritableDataDir();
const DB_FILE = path.join(DATA_DIR, 'fleetbill_db.json');
const BACKUP_FILE = path.join(DATA_DIR, 'fleetbill_db.backup.json');
const BUNDLED_SEED_FILE = path.resolve(process.cwd(), 'data', 'fleetbill_db.json');

function getInitialData(): DatabaseSchema {
  const adminSalt = bcrypt.genSaltSync(10);
  const userSalt = bcrypt.genSaltSync(10);
  const adminHash = bcrypt.hashSync('Admin@123456', adminSalt);
  const userHash = bcrypt.hashSync('Password@123', userSalt);
  const ikTransporterId = 'user_ik_logistics';
  const swiftTransporterId = 'user_swift_freight';

  return {
    pricing: {
      monthlyPrice: 5000,
      yearlyPrice: 50000,
      bankDetails: {
        bankName: 'Meezan Bank Ltd',
        accountTitle: 'Fleet Bill Technologies SMC PVT LTD',
        accountNumber: '02010108765432',
        iban: 'PK64MEZN0002010108765432',
        supportContact: '0301 6411664 (WhatsApp Slip Submission)',
      },
    },
    users: [
      {
        id: 'user_super_admin',
        email: 'atifraza4070@gmail.com',
        mobile: '03001234567',
        fullName: 'Atif Raza (Super Administrator)',
        companyName: 'Fleet Bill 3.0 Platform HQ',
        address: 'Tech Innovation Park, Suite 400',
        city: 'Lahore',
        ntn: '7788990-1',
        strn: '1700778899011',
        phone: '042-35889900',
        role: 'admin',
        accountStatus: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        passwordHash: adminHash,
        subscription: {
          plan: 'yearly',
          status: 'active',
          startDate: '2026-01-01',
          expiryDate: '2030-01-01',
          price: 0,
        },
      },
      {
        id: 'user_admin_alias',
        email: 'admin@fleetbill.com',
        mobile: '03000000000',
        fullName: 'System Administrator',
        companyName: 'Fleet Bill 3.0 Platform HQ',
        address: 'Tech Innovation Park, Suite 400',
        city: 'Lahore',
        ntn: '7788990-1',
        strn: '1700778899011',
        phone: '042-35889900',
        role: 'admin',
        accountStatus: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        passwordHash: adminHash,
        subscription: {
          plan: 'yearly',
          status: 'active',
          startDate: '2026-01-01',
          expiryDate: '2030-01-01',
          price: 0,
        },
      },
      {
        id: ikTransporterId,
        email: 'iklogistics754@gmail.com',
        mobile: '03016411664',
        fullName: 'Imran Khan',
        companyName: 'IK LOGISTICS',
        address: 'Suit No 241, 1st floor Sargodha Road, Near Sui Gas Office Faisalabad.',
        city: 'Faisalabad',
        ntn: '3134059-2',
        strn: '3310031340592',
        phone: '0301 6411664',
        role: 'transporter',
        accountStatus: 'active',
        createdAt: '2026-01-15T08:30:00.000Z',
        passwordHash: userHash,
        subscription: {
          plan: 'yearly',
          status: 'active',
          startDate: '2026-01-01',
          expiryDate: '2027-01-01',
          price: 50000,
          approvedBy: 'Super Admin',
        },
        settings: {
          defaultTaxRate: 15,
          defaultTaxName: 'Punjab 15% Tex',
          invoicePrefix: 'IK-BSP-26-',
          currency: 'PKR',
        },
      },
      {
        id: swiftTransporterId,
        email: 'info@swiftfreight.pk',
        mobile: '03219876543',
        fullName: 'Tariq Mahmood',
        companyName: 'SWIFT FREIGHT CARRIERS',
        address: 'Plot 88, Truck Stand, Hawksbay Road, Karachi',
        city: 'Karachi',
        ntn: '4455667-8',
        strn: '1200445566789',
        phone: '0321 9876543',
        role: 'transporter',
        accountStatus: 'active',
        createdAt: '2026-02-01T10:00:00.000Z',
        passwordHash: userHash,
        subscription: {
          plan: 'monthly',
          status: 'active',
          startDate: '2026-09-01',
          expiryDate: '2026-12-31',
          price: 5000,
          approvedBy: 'Super Admin',
        },
        settings: {
          defaultTaxRate: 15,
          defaultTaxName: 'Sindh 15% SRB Tax',
          invoicePrefix: 'SFC-26-',
          currency: 'PKR',
        },
      },
    ],
    customers: [
      {
        id: 'cust_bulleh_shah',
        transporterId: ikTransporterId,
        name: 'Bulleh Shah Packaging Pvt Ltd.',
        address: '15-Km Lahore-Sheikhupura Road Kot Abdul Malik',
        ntn: '4174855-3',
        strn: '3277876130638',
        phone: '042-37912345',
        email: 'accounts@bullehshah.com.pk',
        createdAt: '2026-01-16T00:00:00.000Z',
      },
    ],
    vehicles: [
      { id: 'veh_1', transporterId: ikTransporterId, vehicleNo: 'LZR 1089', vehicleType: '20 Ft Vehicle', driverName: 'Muhammad Nawaz', driverPhone: '0300-4455661', status: 'available' },
      { id: 'veh_2', transporterId: ikTransporterId, vehicleNo: 'GLT 5105', vehicleType: '20 Ft Vehicle', driverName: 'Riaz Ahmed', driverPhone: '0301-7788992', status: 'available' },
      { id: 'veh_3', transporterId: ikTransporterId, vehicleNo: 'TLB 323', vehicleType: '40 Ft Vehicle', driverName: 'Zafar Iqbal', driverPhone: '0345-6677881', status: 'available' },
    ],
    customerFreightRates: [
      { id: 'cfr_1', transporterId: ikTransporterId, customerName: 'PEPSI COLA INTERNATIONAL (PVT) LTD', destination: 'MULTAN', rate20ft: 42200, rate40ft: 51100 },
      { id: 'cfr_2', transporterId: ikTransporterId, customerName: 'NESTLE PAKISTAN LIMITED', destination: 'KABIRWALA', rate20ft: 42200, rate40ft: 50000 },
      { id: 'cfr_3', transporterId: ikTransporterId, customerName: 'UNILEVER PAKISTAN LIMITED', destination: 'HAROONABAD', rate20ft: 44100, rate40ft: 89500 },
    ],
    cityFreightRates: [
      { id: 'ct_1', transporterId: ikTransporterId, cityName: 'MULTAN', rate20ft: 42200, rate24ftModified: 45000, rate32ftModified: 48000, rate40ft: 50000 },
      { id: 'ct_2', transporterId: ikTransporterId, cityName: 'HAROONABAD', rate20ft: 44100, rate24ftModified: 55000, rate32ftModified: 72000, rate40ft: 89500 },
      { id: 'ct_3', transporterId: ikTransporterId, cityName: 'RAIWIND', rate20ft: 20000, rate24ftModified: 22000, rate32ftModified: 24000, rate40ft: 25000 },
      { id: 'ct_4', transporterId: ikTransporterId, cityName: 'KASUR', rate20ft: 19600, rate24ftModified: 21000, rate32ftModified: 22500, rate40ft: 23500 },
    ],
    dispatchFreightRates: [
      { id: 'dfr_1', transporterId: ikTransporterId, dispatchNo: 'CD81052367', freightOrderNo: '6100000000', loadingDate: '27.09.2026', vehicleNo: 'LZR 1089', vehicleType: '20 Ft Vehicle', destination: 'MULTAN', freightRate: 43200, sourceFile: 'Initial_Rate_Master.xlsx', importedAt: '2026-10-01T00:00:00.000Z' },
      { id: 'dfr_2', transporterId: ikTransporterId, dispatchNo: 'CD81052409', freightOrderNo: '6100000000', loadingDate: '27.09.2026', vehicleNo: 'GLT 5105', vehicleType: '20 Ft Vehicle', destination: 'MULTAN', freightRate: 39300, sourceFile: 'Initial_Rate_Master.xlsx', importedAt: '2026-10-01T00:00:00.000Z' },
      { id: 'dfr_3', transporterId: ikTransporterId, dispatchNo: 'CD81052410', freightOrderNo: '6100000000', loadingDate: '27.09.2026', vehicleNo: 'TLG 148', vehicleType: '20 Ft Vehicle', destination: 'MULTAN', freightRate: 39650, sourceFile: 'Initial_Rate_Master.xlsx', importedAt: '2026-10-01T00:00:00.000Z' },
      { id: 'dfr_4', transporterId: ikTransporterId, dispatchNo: 'CD81052735', freightOrderNo: '6100000000', loadingDate: '29.09.2026', vehicleNo: 'C 3754', vehicleType: '40 Ft Vehicle', destination: 'MULTAN', freightRate: 50000, sourceFile: 'Initial_Rate_Master.xlsx', importedAt: '2026-10-01T00:00:00.000Z' },
      { id: 'dfr_5', transporterId: ikTransporterId, dispatchNo: 'CD81052739', freightOrderNo: '6100000000', loadingDate: '29.09.2026', vehicleNo: 'TLB 323', vehicleType: '40 Ft Vehicle', destination: 'HAROONABAD', freightRate: 89500, sourceFile: 'Initial_Rate_Master.xlsx', importedAt: '2026-10-01T00:00:00.000Z' },
    ],
    vehicleTypes: [
      { id: 'vt_1', transporterId: ikTransporterId, name: '20 Ft Vehicle', normalizedName: '20 ft vehicle', status: 'active', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
      { id: 'vt_2', transporterId: ikTransporterId, name: '23-24 Ft Modified', normalizedName: '23-24 ft modified', status: 'active', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
      { id: 'vt_3', transporterId: ikTransporterId, name: '32 Ft Modified', normalizedName: '32 ft modified', status: 'active', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
      { id: 'vt_4', transporterId: ikTransporterId, name: '40 Ft Vehicle', normalizedName: '40 ft vehicle', status: 'active', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    ],
    invoices: [],
    auditLogs: [
      {
        id: 'log_init',
        timestamp: '2026-10-01T00:00:00.000Z',
        userId: 'user_super_admin',
        userEmail: 'admin@fleetbill.com',
        action: 'SYSTEM_INITIALIZATION',
        details: 'Fleet Bill 3.0 Platform database initialized.',
      },
    ],
  };
}

class StorageEngine {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.loadData();
  }

  private loadData(): DatabaseSchema {
    try {
      const sourceFile = fs.existsSync(DB_FILE)
        ? DB_FILE
        : fs.existsSync(BUNDLED_SEED_FILE)
        ? BUNDLED_SEED_FILE
        : null;
      if (sourceFile) {
        const raw = fs.readFileSync(sourceFile, 'utf-8');
        const loaded = JSON.parse(raw);
        if (!loaded.dispatchFreightRates) loaded.dispatchFreightRates = [];
        if (!loaded.vehicleTypes) loaded.vehicleTypes = [];
        return loaded;
      }
    } catch (err) {
      console.error('Error loading DB file, falling back to initial seed:', err);
      if (fs.existsSync(BACKUP_FILE)) {
        try {
          return JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf-8'));
        } catch {}
      }
    }
    const initial = getInitialData();
    this.persist(initial);
    return initial;
  }

  private persist(data: DatabaseSchema): void {
    try {
      const json = JSON.stringify(data, null, 2);
      fs.writeFileSync(DB_FILE, json, 'utf-8');
      fs.writeFileSync(BACKUP_FILE, json, 'utf-8');
    } catch (err) {
      // Safe fallback in read-only or ephemeral environments
    }
  }

  public save(): void {
    this.persist(this.data);
  }

  public logAudit(userId: string, userEmail: string, action: string, details: string): void {
    this.data.auditLogs.unshift({
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      userId,
      userEmail,
      action,
      details,
    });
    if (this.data.auditLogs.length > 1000) this.data.auditLogs.pop();
    this.save();
  }

  public getAuditLogs(): AuditLog[] {
    return this.data.auditLogs;
  }

  public getPricing(): PricingSettings {
    return this.data.pricing;
  }

  public updatePricing(pricing: Partial<PricingSettings>): PricingSettings {
    this.data.pricing = {
      ...this.data.pricing,
      ...pricing,
      bankDetails: {
        ...this.data.pricing.bankDetails,
        ...(pricing.bankDetails || {}),
      },
    };
    this.save();
    return this.data.pricing;
  }

  public getUsers(): (UserProfile & { passwordHash: string })[] {
    return this.data.users;
  }

  public findUserById(id: string): (UserProfile & { passwordHash: string }) | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  public findUserByEmailOrMobile(identifier: string): (UserProfile & { passwordHash: string }) | undefined {
    const clean = (identifier || '').trim().toLowerCase();
    if (!clean) return undefined;
    const cleanDigits = clean.replace(/\D/g, '');
    const found = this.data.users.find(
      (u) =>
        u.email.toLowerCase() === clean ||
        (cleanDigits.length >= 7 && u.mobile.replace(/\D/g, '') === cleanDigits)
    );
    if (found) return found;
    if (clean === 'atifraza4070@gmail.com' || clean === 'admin@fleetbill.com' || clean === 'admin') {
      return this.data.users.find((u) => u.role === 'admin') || this.data.users[0];
    }
    return undefined;
  }

  public getSmtpSettings() {
    return this.data.smtp;
  }

  public saveSmtpSettings(settings: { user: string; pass: string; host?: string; port?: number; fromName?: string }) {
    this.data.smtp = settings;
    this.save();
    return this.data.smtp;
  }

  public createUser(userData: UserProfile & { passwordHash: string }): UserProfile {
    const existingIdx = this.data.users.findIndex((u) => u.id === userData.id || u.email.toLowerCase() === userData.email.toLowerCase());
    if (existingIdx >= 0) {
      const { passwordHash: _, ...safeExisting } = this.data.users[existingIdx];
      return safeExisting;
    }
    this.data.users.push(userData);
    const defaultVehicleTypes = ['20 Ft Vehicle', '23-24 Ft Modified', '32 Ft Modified', '40 Ft Vehicle'];
    if (!this.data.vehicleTypes) this.data.vehicleTypes = [];
    for (const vtName of defaultVehicleTypes) {
      const norm = vtName.toLowerCase();
      this.data.vehicleTypes.push({
        id: `vt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        transporterId: userData.id,
        name: vtName,
        normalizedName: norm,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    this.save();
    const { passwordHash: _, ...safeUser } = userData;
    return safeUser;
  }

  public updateUser(id: string, updates: Partial<UserProfile & { passwordHash?: string }>): UserProfile | null {
    const index = this.data.users.findIndex((u) => u.id === id);
    if (index === -1) return null;
    this.data.users[index] = {
      ...this.data.users[index],
      ...updates,
      subscription: {
        ...this.data.users[index].subscription,
        ...(updates.subscription || {}),
      },
      settings: updates.settings
        ? {
            defaultTaxRate: updates.settings.defaultTaxRate ?? this.data.users[index].settings?.defaultTaxRate ?? 15,
            defaultTaxName: updates.settings.defaultTaxName ?? this.data.users[index].settings?.defaultTaxName ?? 'Punjab 15% Tex',
            invoicePrefix: updates.settings.invoicePrefix ?? this.data.users[index].settings?.invoicePrefix ?? 'INV-26-',
            currency: updates.settings.currency ?? this.data.users[index].settings?.currency ?? 'PKR',
          }
        : this.data.users[index].settings,
    };
    this.save();
    const { passwordHash: _, ...safeUser } = this.data.users[index];
    return safeUser;
  }

  public deleteUser(id: string, deleteData: boolean = true): boolean {
    const index = this.data.users.findIndex((u) => u.id === id);
    if (index === -1) return false;
    this.data.users.splice(index, 1);
    if (deleteData) {
      this.data.invoices = this.data.invoices.filter((i) => i.transporterId !== id);
      this.data.customers = this.data.customers.filter((c) => c.transporterId !== id);
      this.data.vehicles = this.data.vehicles.filter((v) => v.transporterId !== id);
      this.data.customerFreightRates = this.data.customerFreightRates.filter((r) => r.transporterId !== id);
      this.data.cityFreightRates = this.data.cityFreightRates.filter((r) => r.transporterId !== id);
    }
    this.save();
    return true;
  }

  public getCustomers(transporterId: string): Customer[] {
    return this.data.customers.filter((c) => c.transporterId === transporterId);
  }

  public saveCustomer(customer: Customer): Customer {
    const index = this.data.customers.findIndex((c) => c.id === customer.id && c.transporterId === customer.transporterId);
    if (index >= 0) this.data.customers[index] = customer;
    else this.data.customers.push(customer);
    this.save();
    return customer;
  }

  public deleteCustomer(id: string, transporterId: string): boolean {
    const prev = this.data.customers.length;
    this.data.customers = this.data.customers.filter((c) => !(c.id === id && c.transporterId === transporterId));
    if (this.data.customers.length !== prev) {
      this.save();
      return true;
    }
    return false;
  }

  public getVehicles(transporterId: string): Vehicle[] {
    return this.data.vehicles.filter((v) => v.transporterId === transporterId);
  }

  public saveVehicle(vehicle: Vehicle): Vehicle {
    const index = this.data.vehicles.findIndex((v) => v.id === vehicle.id && v.transporterId === vehicle.transporterId);
    if (index >= 0) this.data.vehicles[index] = vehicle;
    else this.data.vehicles.push(vehicle);
    this.save();
    return vehicle;
  }

  public deleteVehicle(id: string, transporterId: string): boolean {
    const prev = this.data.vehicles.length;
    this.data.vehicles = this.data.vehicles.filter((v) => !(v.id === id && v.transporterId === transporterId));
    if (this.data.vehicles.length !== prev) {
      this.save();
      return true;
    }
    return false;
  }

  public getCustomerFreightRates(transporterId: string): CustomerFreightRate[] {
    return this.data.customerFreightRates.filter((r) => r.transporterId === transporterId);
  }

  public getCityFreightRates(transporterId: string): CityFreightRate[] {
    return this.data.cityFreightRates.filter((r) => r.transporterId === transporterId);
  }

  public saveCustomerFreightRate(rate: CustomerFreightRate): CustomerFreightRate {
    const index = this.data.customerFreightRates.findIndex((r) => r.id === rate.id && r.transporterId === rate.transporterId);
    if (index >= 0) this.data.customerFreightRates[index] = rate;
    else this.data.customerFreightRates.push(rate);
    this.save();
    return rate;
  }

  public saveCityFreightRate(rate: CityFreightRate): CityFreightRate {
    const index = this.data.cityFreightRates.findIndex((r) => r.id === rate.id && r.transporterId === rate.transporterId);
    if (index >= 0) this.data.cityFreightRates[index] = rate;
    else this.data.cityFreightRates.push(rate);
    this.save();
    return rate;
  }

  public deleteCustomerFreightRate(id: string, transporterId: string): boolean {
    const prev = this.data.customerFreightRates.length;
    this.data.customerFreightRates = this.data.customerFreightRates.filter((r) => !(r.id === id && r.transporterId === transporterId));
    if (this.data.customerFreightRates.length !== prev) {
      this.save();
      return true;
    }
    return false;
  }

  public deleteCityFreightRate(id: string, transporterId: string): boolean {
    const prev = this.data.cityFreightRates.length;
    this.data.cityFreightRates = this.data.cityFreightRates.filter((r) => !(r.id === id && r.transporterId === transporterId));
    if (this.data.cityFreightRates.length !== prev) {
      this.save();
      return true;
    }
    return false;
  }

  public getInvoices(transporterId: string): Invoice[] {
    return this.data.invoices
      .filter((i) => i.transporterId === transporterId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public findInvoiceById(id: string, transporterId?: string): Invoice | undefined {
    return this.data.invoices.find((i) => i.id === id && (!transporterId || i.transporterId === transporterId));
  }

  public saveInvoice(invoice: Invoice): Invoice {
    const index = this.data.invoices.findIndex((i) => i.id === invoice.id && i.transporterId === invoice.transporterId);
    if (index >= 0) {
      this.data.invoices[index] = { ...invoice, updatedAt: new Date().toISOString() };
    } else {
      this.data.invoices.push({
        ...invoice,
        createdAt: invoice.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    this.save();
    return invoice;
  }

  public deleteInvoice(id: string, transporterId: string): boolean {
    const prev = this.data.invoices.length;
    this.data.invoices = this.data.invoices.filter((i) => !(i.id === id && i.transporterId === transporterId));
    if (this.data.invoices.length !== prev) {
      this.save();
      return true;
    }
    return false;
  }

  public getVehicleTypes(transporterId: string): TransporterVehicleType[] {
    if (!this.data.vehicleTypes) this.data.vehicleTypes = [];
    return this.data.vehicleTypes
      .filter((vt) => vt.transporterId === transporterId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public createVehicleType(transporterId: string, name: string): TransporterVehicleType {
    if (!this.data.vehicleTypes) this.data.vehicleTypes = [];
    const trimmed = name.trim();
    const normalized = trimmed.toLowerCase();
    const existing = this.data.vehicleTypes.find(
      (vt) => vt.transporterId === transporterId && vt.normalizedName === normalized
    );
    if (existing) {
      if (existing.status === 'inactive') {
        existing.status = 'active';
        existing.updatedAt = new Date().toISOString();
        this.save();
      }
      return existing;
    }
    const newType: TransporterVehicleType = {
      id: `vt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      transporterId,
      name: trimmed,
      normalizedName: normalized,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.data.vehicleTypes.unshift(newType);
    this.save();
    return newType;
  }

  public updateVehicleType(
    transporterId: string,
    id: string,
    updates: { name?: string; status?: 'active' | 'inactive' }
  ): TransporterVehicleType | null {
    if (!this.data.vehicleTypes) this.data.vehicleTypes = [];
    const index = this.data.vehicleTypes.findIndex((vt) => vt.id === id && vt.transporterId === transporterId);
    if (index === -1) return null;
    const current = this.data.vehicleTypes[index];
    if (updates.name && updates.name.trim()) {
      current.name = updates.name.trim();
      current.normalizedName = current.name.toLowerCase();
    }
    if (updates.status) current.status = updates.status;
    current.updatedAt = new Date().toISOString();
    this.data.vehicleTypes[index] = current;
    this.save();
    return current;
  }

  public deleteVehicleType(transporterId: string, id: string): boolean {
    if (!this.data.vehicleTypes) return false;
    const prev = this.data.vehicleTypes.length;
    this.data.vehicleTypes = this.data.vehicleTypes.filter((vt) => !(vt.id === id && vt.transporterId === transporterId));
    if (this.data.vehicleTypes.length !== prev) {
      this.save();
      return true;
    }
    return false;
  }

  public getDispatchFreightRates(transporterId: string): DispatchFreightRate[] {
    if (!this.data.dispatchFreightRates) this.data.dispatchFreightRates = [];
    return this.data.dispatchFreightRates
      .filter((dfr) => dfr.transporterId === transporterId)
      .sort((a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime());
  }

  public findDispatchFreightRatesByDispatchNo(transporterId: string, dispatchNo: string): DispatchFreightRate[] {
    if (!this.data.dispatchFreightRates) this.data.dispatchFreightRates = [];
    const q = dispatchNo.trim().toLowerCase();
    if (!q) return [];
    return this.data.dispatchFreightRates.filter(
      (dfr) => dfr.transporterId === transporterId && dfr.dispatchNo.trim().toLowerCase() === q
    );
  }

  public searchDispatchFreightRates(transporterId: string, query: string, limit = 25): DispatchFreightRate[] {
    if (!this.data.dispatchFreightRates) this.data.dispatchFreightRates = [];
    const q = query.trim().toLowerCase();
    return this.data.dispatchFreightRates
      .filter(
        (dfr) =>
          dfr.transporterId === transporterId &&
          (!q ||
            dfr.dispatchNo.toLowerCase().includes(q) ||
            dfr.freightOrderNo.toLowerCase().includes(q) ||
            dfr.vehicleNo.toLowerCase().includes(q) ||
            dfr.destination.toLowerCase().includes(q) ||
            dfr.vehicleType.toLowerCase().includes(q))
      )
      .slice(0, limit);
  }

  public checkDispatchAlreadyInvoiced(transporterId: string, dispatchNo: string): { invoiced: boolean; invoiceNumbers: string[] } {
    const q = dispatchNo.trim().toLowerCase();
    if (!q) return { invoiced: false, invoiceNumbers: [] };
    const matchingInvoices = this.data.invoices.filter((inv) => {
      if (inv.transporterId !== transporterId) return false;
      return inv.items.some((item) => item.cdDespatch && item.cdDespatch.trim().toLowerCase() === q);
    });
    return {
      invoiced: matchingInvoices.length > 0,
      invoiceNumbers: matchingInvoices.map((inv) => inv.invoiceNumber),
    };
  }

  public saveDispatchFreightRates(
    transporterId: string,
    newRates: Omit<DispatchFreightRate, 'id' | 'transporterId' | 'importedAt'>[],
    options: { replaceExisting?: boolean; sourceFileName?: string } = {}
  ): { savedCount: number; duplicateCount: number; newVehicleTypesAdded: string[] } {
    if (!this.data.dispatchFreightRates) this.data.dispatchFreightRates = [];
    if (!this.data.vehicleTypes) this.data.vehicleTypes = [];
    const now = new Date().toISOString();
    let savedCount = 0;
    let duplicateCount = 0;
    const newVehicleTypesAdded: string[] = [];

    for (const r of newRates) {
      if (!r.dispatchNo || !r.dispatchNo.trim()) continue;
      const cleanDispatch = r.dispatchNo.trim();
      const normDispatch = cleanDispatch.toLowerCase();

      if (r.vehicleType && r.vehicleType.trim()) {
        const vtName = r.vehicleType.trim();
        const normVt = vtName.toLowerCase();
        const existingVt = this.data.vehicleTypes.find(
          (vt) => vt.transporterId === transporterId && vt.normalizedName === normVt
        );
        if (!existingVt) {
          this.createVehicleType(transporterId, vtName);
          if (!newVehicleTypesAdded.includes(vtName)) newVehicleTypesAdded.push(vtName);
        }
      }

      const existingIndex = this.data.dispatchFreightRates.findIndex(
        (item) => item.transporterId === transporterId && item.dispatchNo.trim().toLowerCase() === normDispatch
      );

      if (existingIndex !== -1) {
        if (options.replaceExisting) {
          this.data.dispatchFreightRates[existingIndex] = {
            id: this.data.dispatchFreightRates[existingIndex].id,
            transporterId,
            dispatchNo: cleanDispatch,
            freightOrderNo: r.freightOrderNo ? r.freightOrderNo.trim() : '',
            loadingDate: r.loadingDate ? r.loadingDate.trim() : '',
            vehicleNo: r.vehicleNo ? r.vehicleNo.trim() : '',
            vehicleType: r.vehicleType ? r.vehicleType.trim() : '20 Ft Vehicle',
            destination: r.destination ? r.destination.trim() : '',
            freightRate: Number(r.freightRate) || 0,
            sourceFile: options.sourceFileName || r.sourceFile,
            importedAt: now,
          };
          savedCount++;
        } else {
          duplicateCount++;
        }
      } else {
        this.data.dispatchFreightRates.unshift({
          id: `dfr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          transporterId,
          dispatchNo: cleanDispatch,
          freightOrderNo: r.freightOrderNo ? r.freightOrderNo.trim() : '',
          loadingDate: r.loadingDate ? r.loadingDate.trim() : '',
          vehicleNo: r.vehicleNo ? r.vehicleNo.trim() : '',
          vehicleType: r.vehicleType ? r.vehicleType.trim() : '20 Ft Vehicle',
          destination: r.destination ? r.destination.trim() : '',
          freightRate: Number(r.freightRate) || 0,
          sourceFile: options.sourceFileName || r.sourceFile,
          importedAt: now,
        });
        savedCount++;
      }
    }

    this.save();
    return { savedCount, duplicateCount, newVehicleTypesAdded };
  }

  public deleteDispatchFreightRate(transporterId: string, id: string): boolean {
    if (!this.data.dispatchFreightRates) return false;
    const initialLen = this.data.dispatchFreightRates.length;
    this.data.dispatchFreightRates = this.data.dispatchFreightRates.filter(
      (r) => !(r.id === id && r.transporterId === transporterId)
    );
    if (this.data.dispatchFreightRates.length !== initialLen) {
      this.save();
      return true;
    }
    return false;
  }

  public clearDispatchFreightRates(transporterId: string): number {
    if (!this.data.dispatchFreightRates) return 0;
    const initialLen = this.data.dispatchFreightRates.length;
    this.data.dispatchFreightRates = this.data.dispatchFreightRates.filter((r) => r.transporterId !== transporterId);
    const deletedCount = initialLen - this.data.dispatchFreightRates.length;
    if (deletedCount > 0) this.save();
    return deletedCount;
  }
}

const db: StorageEngine = (globalThis as any).__fleetbill_db || ((globalThis as any).__fleetbill_db = new StorageEngine());

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'fleetbill3_super_secret_enterprise_jwt_key_2026';

interface PendingRegistration {
  data: {
    fullName: string;
    companyName: string;
    mobile: string;
    email: string;
    address: string;
    city: string;
    passwordHash: string;
  };
  otp: string;
  expiresAt: number;
  lastSentAt: number;
}

const pendingRegistrations = new Map<string, PendingRegistration>();

interface PasswordResetEntry {
  email: string;
  otp: string;
  expiresAt: number;
  lastSentAt: number;
}

const passwordResetOtps = new Map<string, PasswordResetEntry>();

async function sendSystemEmail(to: string, subject: string, text: string, html?: string, attachments?: any[]) {
  const dbSmtp = db.getSmtpSettings();
  const smtpUser = process.env.SMTP_USER || dbSmtp?.user;
  const smtpPass = process.env.SMTP_PASS || dbSmtp?.pass;
  const smtpHost = process.env.SMTP_HOST || dbSmtp?.host || 'smtp.gmail.com';
  const smtpPort = Number(process.env.SMTP_PORT || dbSmtp?.port || 465);

  if (smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });
      const info = await transporter.sendMail({
        from: `"Fleet Bill 3.0" <${smtpUser}>`,
        to,
        subject,
        text,
        html: html || undefined,
        attachments,
      });
      return { success: true, messageId: info.messageId };
    } catch (err: any) {
      console.error('Nodemailer SMTP Error:', err);
      return { success: false, error: err.message };
    }
  } else {
    return { success: true, simulation: true };
  }
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Normalize Vercel rewritten URLs if needed
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (!req.url.startsWith('/api')) {
    req.url = '/api' + (req.url.startsWith('/') ? '' : '/') + req.url;
  }
  next();
});

export interface AuthenticatedRequest extends Request {
  user?: UserProfile;
}

function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication token required.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id: string; role: string; email?: string; userSnapshot?: any };
    let user = db.findUserById(payload.id);

    if (!user && payload.email) {
      user = db.findUserByEmailOrMobile(payload.email);
    }

    if (!user && payload.userSnapshot) {
      db.createUser(payload.userSnapshot);
      user = db.findUserById(payload.userSnapshot.id);
    }

    if (!user) {
      return res.status(401).json({ error: 'User account not found.' });
    }

    const isProfileCheck = req.path === '/api/auth/me' || req.originalUrl?.includes('/api/auth/me');

    if (!isProfileCheck && user.role !== 'admin') {
      if (user.accountStatus === 'pending') {
        return res.status(403).json({ error: 'Your account is waiting for Super Admin approval.' });
      }
      if (user.accountStatus === 'suspended' || user.accountStatus === 'deactivated') {
        return res.status(403).json({ error: 'Your account has been disabled by the Super Admin.' });
      }
    }

    const { passwordHash: _, ...safeUser } = user;
    req.user = safeUser as UserProfile;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired session token.' });
  }
}

function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
  }
  next();
}

// ---------------- AUTH ROUTES ----------------
app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { fullName, companyName, mobile, email, address, city, password } = req.body || {};

    if (!fullName || !companyName || !mobile || !email || !password) {
      return res.status(400).json({ error: 'All required registration fields must be provided.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanMobile = String(mobile).trim();

    const existing = db.findUserByEmailOrMobile(cleanEmail) || db.findUserByEmailOrMobile(cleanMobile);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email or mobile number already exists.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    const newTransporterId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date();
    const trialExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const userRecord = {
      id: newTransporterId,
      email: cleanEmail,
      mobile: cleanMobile,
      fullName: String(fullName).trim(),
      companyName: String(companyName).trim(),
      address: address ? String(address).trim() : '',
      city: city ? String(city).trim() : '',
      ntn: '',
      strn: '',
      phone: cleanMobile,
      role: 'transporter' as const,
      accountStatus: 'pending' as const,
      createdAt: now.toISOString(),
      passwordHash,
      subscription: {
        plan: 'trial' as const,
        status: 'pending_approval' as const,
        startDate: now.toISOString().split('T')[0],
        expiryDate: trialExpiry.toISOString().split('T')[0],
        price: 0,
      },
      settings: {
        defaultTaxRate: 15,
        defaultTaxName: 'Punjab 15% Tex',
        invoicePrefix: 'INV-26-',
        currency: 'PKR',
      },
    };

    const newUser = db.createUser(userRecord);

    db.logAudit(
      newUser.id,
      newUser.email,
      'TRANSPORTER_REGISTERED',
      `New transporter account registered for ${newUser.companyName} (Pending Super Admin Approval)`
    );

    const token = jwt.sign(
      { id: newUser.id, role: newUser.role, email: newUser.email, userSnapshot: userRecord },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      user: newUser,
      token,
      pendingApproval: true,
      message: 'Account registered successfully! Waiting for Super Admin approval.',
    });
  } catch (err: any) {
    console.error('Register error:', err);
    return res.status(500).json({ error: err.message || 'Registration failed due to server error.' });
  }
});

app.post('/api/auth/verify-registration-otp', (req: Request, res: Response) => {
  const { email, otp } = req.body || {};
  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and verification code are required.' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const pending = pendingRegistrations.get(cleanEmail);

  if (!pending) {
    return res.status(400).json({ error: 'No pending registration found for this email, or it has expired. Please register again.' });
  }

  if (Date.now() > pending.expiresAt) {
    pendingRegistrations.delete(cleanEmail);
    return res.status(400).json({ error: 'Verification code has expired. Please request a new code.' });
  }

  if (pending.otp !== String(otp).trim()) {
    return res.status(400).json({ error: 'Invalid verification code. Please check and try again.' });
  }

  const newTransporterId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date();
  const trialExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const userRecord = {
    id: newTransporterId,
    email: pending.data.email,
    mobile: pending.data.mobile,
    fullName: pending.data.fullName,
    companyName: pending.data.companyName,
    address: pending.data.address,
    city: pending.data.city,
    ntn: '',
    strn: '',
    phone: pending.data.mobile,
    role: 'transporter' as const,
    accountStatus: 'pending' as const,
    createdAt: now.toISOString(),
    passwordHash: pending.data.passwordHash,
    subscription: {
      plan: 'trial' as const,
      status: 'pending_approval' as const,
      startDate: now.toISOString().split('T')[0],
      expiryDate: trialExpiry.toISOString().split('T')[0],
      price: 0,
    },
    settings: {
      defaultTaxRate: 15,
      defaultTaxName: 'Punjab 15% Tex',
      invoicePrefix: 'INV-26-',
      currency: 'PKR',
    },
  };

  const newUser = db.createUser(userRecord);
  pendingRegistrations.delete(cleanEmail);

  db.logAudit(newUser.id, newUser.email, 'TRANSPORTER_REGISTERED', `New transporter account registered for ${newUser.companyName} (Pending Admin Approval)`);

  const token = jwt.sign(
    { id: newUser.id, role: newUser.role, email: newUser.email, userSnapshot: userRecord },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  return res.status(201).json({ user: newUser, token });
});

app.post('/api/auth/resend-registration-otp', async (req: Request, res: Response) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email is required.' });
  const cleanEmail = String(email).trim().toLowerCase();
  const pending = pendingRegistrations.get(cleanEmail);
  if (!pending) return res.status(400).json({ error: 'No pending registration found for this email.' });
  const now = Date.now();
  const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
  pending.otp = newOtp;
  pending.expiresAt = now + 15 * 60 * 1000;
  pending.lastSentAt = now;
  const emailResult = await sendSystemEmail(cleanEmail, `New Verification Code: ${newOtp}`, `Your verification code is: ${newOtp}`);
  return res.json({
    ok: true,
    message: `New verification code sent to ${cleanEmail}.`,
    previewCode: emailResult && 'simulation' in emailResult && emailResult.simulation ? newOtp : undefined,
  });
});

app.post('/api/auth/login', (req: Request, res: Response) => {
  try {
    const { identifier, password } = req.body || {};

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Please enter your email or mobile and password.' });
    }

    const user = db.findUserByEmailOrMobile(String(identifier).trim());
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials. User not found.' });
    }

    const match = bcrypt.compareSync(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials. Incorrect password.' });
    }

    db.logAudit(user.id, user.email, 'USER_LOGIN', `User ${user.fullName} (${user.accountStatus}) signed in.`);

    const { passwordHash: _, ...safeUser } = user;
    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email, userSnapshot: user },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    return res.json({ user: safeUser, token });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: err.message || 'Login failed due to server error.' });
  }
});

app.get('/api/auth/me', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  return res.json({ user: req.user });
});

app.post('/api/auth/update-profile', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const { fullName, companyName, address, city, ntn, strn, phone, mobile, settings } = req.body || {};
  const updated = db.updateUser(req.user.id, { fullName, companyName, address, city, ntn, strn, phone, mobile, settings });
  db.logAudit(req.user.id, req.user.email, 'PROFILE_UPDATED', `Profile and company settings updated.`);
  return res.json({ user: updated });
});

app.post('/api/auth/upload-logo', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const { logoUrl } = req.body || {};
  const updated = db.updateUser(req.user.id, { logoUrl: logoUrl || '' });
  db.logAudit(req.user.id, req.user.email, 'LOGO_UPDATED', `Company logo updated.`);
  return res.json({ user: updated });
});

app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email address is required.' });
  const cleanEmail = String(email).trim().toLowerCase();
  const user = db.findUserByEmailOrMobile(cleanEmail);
  if (!user) return res.status(404).json({ error: 'No account found with this email address.' });
  const now = Date.now();
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  passwordResetOtps.set(cleanEmail, { email: cleanEmail, otp, expiresAt: now + 15 * 60 * 1000, lastSentAt: now });
  const emailResult = await sendSystemEmail(cleanEmail, `Fleet Bill Password Reset Code: ${otp}`, `Your password reset code is: ${otp}`);
  return res.json({
    message: `Password reset code sent to ${cleanEmail}.`,
    previewCode: emailResult && 'simulation' in emailResult && emailResult.simulation ? otp : undefined,
  });
});

app.post('/api/auth/reset-password', (req: Request, res: Response) => {
  const { email, otp, newPassword } = req.body || {};
  if (!email || !otp || !newPassword) return res.status(400).json({ error: 'Email, OTP code, and new password are required.' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
  const cleanEmail = String(email).trim().toLowerCase();
  const entry = passwordResetOtps.get(cleanEmail);
  if (!entry || entry.otp !== String(otp).trim()) return res.status(400).json({ error: 'Invalid or expired reset code.' });
  const user = db.findUserByEmailOrMobile(cleanEmail);
  if (!user) return res.status(404).json({ error: 'User account not found.' });
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(newPassword, salt);
  db.updateUser(user.id, { passwordHash });
  passwordResetOtps.delete(cleanEmail);
  return res.json({ ok: true, message: 'Password has been reset successfully. You can now sign in.' });
});

app.post('/api/auth/change-password', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both current password and new password are required.' });
  const userWithHash = db.findUserById(req.user.id);
  if (!userWithHash) return res.status(404).json({ error: 'User not found.' });
  if (!bcrypt.compareSync(currentPassword, userWithHash.passwordHash)) {
    return res.status(400).json({ error: 'Current password does not match our records.' });
  }
  const salt = bcrypt.genSaltSync(10);
  const newHash = bcrypt.hashSync(newPassword, salt);
  db.updateUser(req.user.id, { passwordHash: newHash });
  return res.json({ success: true, message: 'Password updated successfully!' });
});

// ---------------- INVOICE ROUTES ----------------
app.get('/api/invoices', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  return res.json({ invoices: db.getInvoices(req.user.id) });
});

app.get('/api/invoices/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const invoice = db.findInvoiceById(req.params.id, req.user.id);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found.' });
  return res.json({ invoice });
});

app.post('/api/invoices', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const data = req.body || {};
  const existingInvoices = db.getInvoices(req.user.id);
  const check = validateInvoiceNumber(data.invoiceNumber, existingInvoices.map((i) => i.invoiceNumber));
  if (!check.valid) return res.status(400).json({ error: check.error });

  const items: InvoiceItem[] = (data.items || []).map((it: any, idx: number) => ({
    id: it.id || `itm_${Date.now()}_${idx}`,
    sr: idx + 1,
    cdDespatch: it.cdDespatch || '',
    freightOrder: it.freightOrder || '',
    loadingDate: it.loadingDate || '',
    offloadingDate: it.offloadingDate || '',
    vehicleNo: it.vehicleNo || '',
    vehicleType: it.vehicleType || '',
    distributorName: it.distributorName || '',
    city: it.city || '',
    freight: Number(it.freight) || 0,
    unloading: Number(it.unloading) || 0,
    move: Number(it.move) || 0,
    haltingCustomer: Number(it.haltingCustomer) || 0,
    haltingFactory: Number(it.haltingFactory) || 0,
    subTotal: (Number(it.freight) || 0) + (Number(it.unloading) || 0) + (Number(it.move) || 0) + (Number(it.haltingCustomer) || 0) + (Number(it.haltingFactory) || 0),
  }));

  const totals = calculateInvoiceTotals(items, data.taxRate ?? 15, data.taxName ?? 'Punjab 15% Tex');

  const newInvoice = db.saveInvoice({
    id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    transporterId: req.user.id,
    invoiceNumber: data.invoiceNumber.trim(),
    invoiceDate: data.invoiceDate || new Date().toISOString().split('T')[0],
    deliveryCode: data.deliveryCode || 'CD',
    customerId: data.customerId || '',
    customerName: data.customerName || '',
    customerAddress: data.customerAddress || '',
    customerNtn: data.customerNtn || '',
    customerStrn: data.customerStrn || '',
    transporterCompanyName: req.user.companyName,
    transporterAddress: req.user.address,
    transporterPhone: req.user.phone || req.user.mobile,
    transporterEmail: req.user.email,
    transporterNtn: req.user.ntn,
    transporterStrn: req.user.strn,
    transporterLogo: req.user.logoUrl,
    items,
    ...totals,
    paymentStatus: data.paymentStatus || 'unpaid',
    paidAmount: Number(data.paidAmount) || 0,
    notes: data.notes || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  db.logAudit(req.user.id, req.user.email, 'INVOICE_CREATED', `Invoice ${newInvoice.invoiceNumber} created for Rs. ${newInvoice.grandTotal}`);
  return res.status(201).json({ invoice: newInvoice });
});

app.put('/api/invoices/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const existing = db.findInvoiceById(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Invoice not found.' });
  const data = req.body || {};

  if (data.invoiceNumber && data.invoiceNumber.trim() !== existing.invoiceNumber) {
    const existingInvoices = db.getInvoices(req.user.id);
    const existingMap = Object.fromEntries(existingInvoices.map((i) => [i.id, i.invoiceNumber]));
    const check = validateInvoiceNumber(data.invoiceNumber, [], req.params.id, existingMap);
    if (!check.valid) return res.status(400).json({ error: check.error });
  }

  const items: InvoiceItem[] = (data.items || existing.items).map((it: any, idx: number) => ({
    id: it.id || `itm_${Date.now()}_${idx}`,
    sr: idx + 1,
    cdDespatch: it.cdDespatch || '',
    freightOrder: it.freightOrder || '',
    loadingDate: it.loadingDate || '',
    offloadingDate: it.offloadingDate || '',
    vehicleNo: it.vehicleNo || '',
    vehicleType: it.vehicleType || '',
    distributorName: it.distributorName || '',
    city: it.city || '',
    freight: Number(it.freight) || 0,
    unloading: Number(it.unloading) || 0,
    move: Number(it.move) || 0,
    haltingCustomer: Number(it.haltingCustomer) || 0,
    haltingFactory: Number(it.haltingFactory) || 0,
    subTotal: (Number(it.freight) || 0) + (Number(it.unloading) || 0) + (Number(it.move) || 0) + (Number(it.haltingCustomer) || 0) + (Number(it.haltingFactory) || 0),
  }));

  const totals = calculateInvoiceTotals(items, data.taxRate ?? existing.taxRate, data.taxName ?? existing.taxName);
  const updatedInvoice = db.saveInvoice({
    ...existing,
    ...data,
    transporterId: req.user.id,
    id: existing.id,
    items,
    ...totals,
    updatedAt: new Date().toISOString(),
  });
  return res.json({ invoice: updatedInvoice });
});

app.delete('/api/invoices/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const existing = db.findInvoiceById(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Invoice not found.' });
  db.deleteInvoice(req.params.id, req.user.id);
  return res.json({ success: true, message: 'Invoice deleted successfully.' });
});

app.post('/api/invoices/:id/send-email', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const invoice = db.findInvoiceById(req.params.id, req.user.role === 'admin' ? undefined : req.user.id);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found or access denied.' });
  const { to, subject, body, invoicePdf, attachments } = req.body || {};
  if (!to || typeof to !== 'string' || !to.includes('@')) {
    return res.status(400).json({ error: 'A valid recipient email address is required.' });
  }
  const mailAttachments: any[] = [];
  if (invoicePdf && invoicePdf.base64) {
    mailAttachments.push({
      filename: invoicePdf.filename || `${invoice.invoiceNumber}.pdf`,
      content: Buffer.from(invoicePdf.base64, 'base64'),
      contentType: 'application/pdf',
    });
  }
  if (Array.isArray(attachments)) {
    for (const att of attachments) {
      if (att.base64 && att.filename) {
        mailAttachments.push({
          filename: att.filename,
          content: Buffer.from(att.base64, 'base64'),
          contentType: att.contentType || 'application/octet-stream',
        });
      }
    }
  }
  const emailRes = await sendSystemEmail(
    to.trim(),
    subject || `Transport Invoice ${invoice.invoiceNumber} - ${invoice.transporterCompanyName}`,
    body,
    undefined,
    mailAttachments
  );
  if (!emailRes.success) {
    return res.status(500).json({ error: `Failed to deliver email: ${emailRes.error || 'SMTP delivery error'}.` });
  }
  return res.json({
    success: true,
    message: `Invoice ${invoice.invoiceNumber} successfully dispatched to ${to}.`,
  });
});

app.get('/api/invoices/:id/export-excel', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const invoice = db.findInvoiceById(req.params.id, req.user.id);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found.' });
  const excelBuffer = generateInvoiceExcel(invoice);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.xlsx"`);
  return res.send(Buffer.from(excelBuffer));
});

// ---------------- FREIGHT RATE ROUTES ----------------
app.get('/api/freight-rates', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  return res.json({
    customerRates: db.getCustomerFreightRates(req.user.id),
    cityRates: db.getCityFreightRates(req.user.id),
  });
});

app.post('/api/freight-rates/customer', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const { id, customerName, destination, rate20ft, rate40ft } = req.body || {};
  if (!customerName || !destination) return res.status(400).json({ error: 'Customer name and destination are required.' });
  const rate = db.saveCustomerFreightRate({
    id: id || `cfr_${Date.now()}`,
    transporterId: req.user.id,
    customerName: customerName.trim(),
    destination: destination.trim(),
    rate20ft: Number(rate20ft) || 0,
    rate40ft: Number(rate40ft) || 0,
    updatedAt: new Date().toISOString(),
  });
  return res.json({ rate });
});

app.post('/api/freight-rates/city', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const { id, cityName, rate20ft, rate24ftModified, rate32ftModified, rate40ft } = req.body || {};
  if (!cityName) return res.status(400).json({ error: 'City name is required.' });
  const rate = db.saveCityFreightRate({
    id: id || `ct_${Date.now()}`,
    transporterId: req.user.id,
    cityName: cityName.trim(),
    rate20ft: Number(rate20ft) || 0,
    rate24ftModified: Number(rate24ftModified) || 0,
    rate32ftModified: Number(rate32ftModified) || 0,
    rate40ft: Number(rate40ft) || 0,
    updatedAt: new Date().toISOString(),
  });
  return res.json({ rate });
});

app.delete('/api/freight-rates/:type/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const { type, id } = req.params;
  if (type === 'customer') db.deleteCustomerFreightRate(id, req.user.id);
  else db.deleteCityFreightRate(id, req.user.id);
  return res.json({ success: true });
});

// ---------------- DISPATCH FREIGHT RATES ROUTES ----------------
app.get('/api/dispatch-freight-rates', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  return res.json({ rates: db.getDispatchFreightRates(req.user.id) });
});

app.get('/api/dispatch-freight-rates/lookup', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const dispatchNo = (req.query.dispatchNo as string) || '';
  if (!dispatchNo.trim()) {
    return res.json({ matches: [], invoiceCheck: { invoiced: false, invoiceNumbers: [] } });
  }
  return res.json({
    matches: db.findDispatchFreightRatesByDispatchNo(req.user.id, dispatchNo),
    invoiceCheck: db.checkDispatchAlreadyInvoiced(req.user.id, dispatchNo),
  });
});

app.get('/api/dispatch-freight-rates/search', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const query = (req.query.q as string) || '';
  return res.json({ rates: db.searchDispatchFreightRates(req.user.id, query) });
});

app.post('/api/dispatch-freight-rates/save-batch', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const { rates, replaceExisting, sourceFileName } = req.body || {};
  if (!Array.isArray(rates)) return res.status(400).json({ error: 'Expected an array of freight rate records.' });
  const result = db.saveDispatchFreightRates(req.user.id, rates, {
    replaceExisting: Boolean(replaceExisting),
    sourceFileName: sourceFileName || 'Excel_Import.xlsx',
  });
  return res.json({ success: true, ...result });
});

app.post('/api/dispatch-freight-rates', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const { dispatchNo, freightOrderNo, loadingDate, vehicleNo, vehicleType, destination, freightRate } = req.body || {};
  if (!dispatchNo || !dispatchNo.trim()) return res.status(400).json({ error: 'Dispatch No. is required.' });
  const result = db.saveDispatchFreightRates(
    req.user.id,
    [
      {
        dispatchNo: dispatchNo.trim(),
        freightOrderNo: freightOrderNo || '',
        loadingDate: loadingDate || '',
        vehicleNo: vehicleNo || '',
        vehicleType: vehicleType || '20 Ft Vehicle',
        destination: destination || '',
        freightRate: Number(freightRate) || 0,
      },
    ],
    { replaceExisting: true }
  );
  return res.json({ success: true, ...result });
});

app.delete('/api/dispatch-freight-rates/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  return res.json({ success: db.deleteDispatchFreightRate(req.user.id, req.params.id) });
});

app.delete('/api/dispatch-freight-rates', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  return res.json({ success: true, count: db.clearDispatchFreightRates(req.user.id) });
});

// ---------------- VEHICLE TYPES ROUTES ----------------
app.get('/api/vehicle-types', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  return res.json({ vehicleTypes: db.getVehicleTypes(req.user.id) });
});

app.post('/api/vehicle-types', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Vehicle type name is required.' });
  return res.json({ vehicleType: db.createVehicleType(req.user.id, name) });
});

app.put('/api/vehicle-types/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const { name, status } = req.body || {};
  const updated = db.updateVehicleType(req.user.id, req.params.id, { name, status });
  if (!updated) return res.status(404).json({ error: 'Vehicle type not found.' });
  return res.json({ vehicleType: updated });
});

app.delete('/api/vehicle-types/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  return res.json({ success: db.deleteVehicleType(req.user.id, req.params.id) });
});

// ---------------- CUSTOMERS & VEHICLES ROUTES ----------------
app.get('/api/customers', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  return res.json({ customers: db.getCustomers(req.user.id) });
});

app.post('/api/customers', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const { id, name, address, ntn, strn, phone, email } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Customer name is required.' });
  const customer = db.saveCustomer({
    id: id || `cust_${Date.now()}`,
    transporterId: req.user.id,
    name: name.trim(),
    address: address || '',
    ntn: ntn || '',
    strn: strn || '',
    phone: phone || '',
    email: email || '',
    createdAt: new Date().toISOString(),
  });
  return res.json({ customer });
});

app.delete('/api/customers/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  db.deleteCustomer(req.params.id, req.user.id);
  return res.json({ success: true });
});

app.get('/api/vehicles', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  return res.json({ vehicles: db.getVehicles(req.user.id) });
});

app.post('/api/vehicles', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const { id, vehicleNo, vehicleType, driverName, driverPhone, status } = req.body || {};
  if (!vehicleNo) return res.status(400).json({ error: 'Vehicle number is required.' });
  const vehicle = db.saveVehicle({
    id: id || `veh_${Date.now()}`,
    transporterId: req.user.id,
    vehicleNo: vehicleNo.trim().toUpperCase(),
    vehicleType: vehicleType || '20 Ft Vehicle',
    driverName: driverName || '',
    driverPhone: driverPhone || '',
    status: status || 'available',
  });
  return res.json({ vehicle });
});

app.delete('/api/vehicles/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  db.deleteVehicle(req.params.id, req.user.id);
  return res.json({ success: true });
});

// ---------------- ANALYTICS ROUTE ----------------
app.get('/api/analytics', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const invoices = db.getInvoices(req.user.id);
  const vehicles = db.getVehicles(req.user.id);

  let totalRevenue = 0;
  let totalTrips = 0;
  let totalHaltingCustomer = 0;
  let totalHaltingFactory = 0;
  let totalMovementCharges = 0;
  let totalTaxCollected = 0;

  const customerBillingMap: Record<string, number> = {};
  const cityTripsMap: Record<string, number> = {};
  const vehicleTypeMap: Record<string, number> = {};

  invoices.forEach((inv) => {
    totalRevenue += inv.subTotal;
    totalTaxCollected += inv.taxAmount;
    totalHaltingCustomer += inv.haltingCustomerTotal;
    totalHaltingFactory += inv.haltingFactoryTotal;
    totalMovementCharges += inv.moveTotal;

    const cName = inv.customerName || 'Other Customers';
    customerBillingMap[cName] = (customerBillingMap[cName] || 0) + inv.subTotal;

    inv.items.forEach((item) => {
      totalTrips += 1;
      const city = item.city || 'Unknown';
      cityTripsMap[city] = (cityTripsMap[city] || 0) + 1;
      const vt = item.vehicleType || '20 Ft Vehicle';
      vehicleTypeMap[vt] = (vehicleTypeMap[vt] || 0) + 1;
    });
  });

  return res.json({
    metrics: {
      totalRevenue,
      totalTaxCollected,
      grandBilled: totalRevenue + totalTaxCollected,
      totalInvoices: invoices.length,
      totalTrips,
      totalVehicles: vehicles.length,
      totalHaltingCharges: totalHaltingCustomer + totalHaltingFactory,
      totalMovementCharges,
    },
    customerBilling: Object.entries(customerBillingMap).map(([name, amount]) => ({ name, amount })),
    cityTrips: Object.entries(cityTripsMap).map(([city, count]) => ({ city, count })),
    vehicleTypes: Object.entries(vehicleTypeMap).map(([type, count]) => ({ type, count })),
  });
});

// ---------------- SUBSCRIPTION / RENEWAL ROUTE ----------------
app.post('/api/subscription/request-renewal', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const { plan, paymentReference } = req.body || {};
  const pricing = db.getPricing();
  const price = plan === 'yearly' ? pricing.yearlyPrice : pricing.monthlyPrice;
  const updated = db.updateUser(req.user.id, {
    subscription: {
      ...req.user.subscription,
      plan: plan || 'monthly',
      status: 'pending_approval',
      price,
      paymentReference: paymentReference || 'Offline Bank Transfer',
      paymentDate: new Date().toISOString().split('T')[0],
    },
  });
  return res.json({ user: updated, message: 'Renewal request submitted! Super admin will verify and activate your plan.' });
});

// ---------------- SUPER ADMIN ROUTES ----------------
app.get('/api/admin/transporters', authenticateToken, requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
  const users = db.getUsers().map(({ passwordHash: _, ...u }) => {
    const invCount = db.getInvoices(u.id).length;
    return { ...u, invoiceCount: invCount };
  });
  return res.json({ transporters: users });
});

app.post('/api/admin/transporters/:id/status', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { status } = req.body || {};
  if (!['pending', 'active', 'suspended', 'deactivated'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status value.' });
  }

  const existingUser = db.findUserById(req.params.id);
  if (!existingUser) return res.status(404).json({ error: 'Transporter not found.' });

  const updates: Partial<UserProfile> = { accountStatus: status };
  if (status === 'active' && existingUser.subscription?.status === 'pending_approval') {
    updates.subscription = {
      ...existingUser.subscription,
      status: 'active',
      approvedBy: req.user!.fullName,
    };
  }

  const updated = db.updateUser(req.params.id, updates);
  if (!updated) return res.status(404).json({ error: 'Transporter not found.' });

  db.logAudit(req.user!.id, req.user!.email, 'ADMIN_STATUS_CHANGED', `Changed status of ${updated.companyName} to ${status}`);
  return res.json({ user: updated });
});

app.post('/api/admin/transporters/:id/subscription', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { plan, status, durationMonths } = req.body || {};
  const user = db.findUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'Transporter not found.' });

  const now = new Date();
  const months = durationMonths ? parseInt(durationMonths, 10) : plan === 'yearly' ? 12 : 1;
  const expiry = new Date(now.getTime() + months * 30 * 24 * 60 * 60 * 1000);
  const nextSubStatus = status || 'active';

  const updated = db.updateUser(req.params.id, {
    accountStatus: nextSubStatus === 'active' ? 'active' : user.accountStatus,
    subscription: {
      plan: plan || user.subscription.plan,
      status: nextSubStatus,
      startDate: now.toISOString().split('T')[0],
      expiryDate: expiry.toISOString().split('T')[0],
      price: user.subscription.price,
      approvedBy: req.user!.fullName,
    },
  });

  db.logAudit(req.user!.id, req.user!.email, 'ADMIN_SUBSCRIPTION_APPROVED', `Approved ${plan} plan for ${user.companyName} until ${expiry.toISOString().split('T')[0]}`);
  return res.json({ user: updated });
});

app.delete('/api/admin/transporters/:id', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const user = db.findUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'Transporter not found.' });
  if (user.role === 'admin') return res.status(400).json({ error: 'Cannot delete Super Admin account.' });
  const deleteData = req.query.deleteData === 'true';
  db.deleteUser(req.params.id, deleteData);
  return res.json({ success: true, message: 'Account deleted.' });
});

app.get('/api/admin/pricing', authenticateToken, (_req: AuthenticatedRequest, res: Response) => {
  return res.json({ pricing: db.getPricing() });
});

app.post('/api/admin/pricing', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const updated = db.updatePricing(req.body || {});
  return res.json({ pricing: updated });
});

app.get('/api/admin/audit-logs', authenticateToken, requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
  return res.json({ logs: db.getAuditLogs() });
});

app.get('/api/admin/smtp', authenticateToken, requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
  const smtp = db.getSmtpSettings();
  return res.json({
    smtp: {
      user: smtp?.user || process.env.SMTP_USER || '',
      host: smtp?.host || process.env.SMTP_HOST || 'smtp.gmail.com',
      port: smtp?.port || Number(process.env.SMTP_PORT || 465),
      fromName: smtp?.fromName || 'Fleet Bill 3.0',
      isConfigured: Boolean((smtp?.user && smtp?.pass) || (process.env.SMTP_USER && process.env.SMTP_PASS)),
      hasPass: Boolean(smtp?.pass || process.env.SMTP_PASS),
    },
  });
});

app.post('/api/admin/smtp', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { user, pass, host, port, fromName } = req.body || {};
  if (!user) return res.status(400).json({ error: 'SMTP User/Email is required.' });
  const existing = db.getSmtpSettings() || { user: '', pass: '', host: 'smtp.gmail.com', port: 465, fromName: 'Fleet Bill 3.0' };
  const updatedSettings = {
    user: user.trim(),
    pass: pass && pass.trim() ? pass.trim() : existing.pass,
    host: host ? host.trim() : existing.host || 'smtp.gmail.com',
    port: port ? Number(port) : existing.port || 465,
    fromName: fromName ? fromName.trim() : existing.fromName || 'Fleet Bill 3.0',
  };
  db.saveSmtpSettings(updatedSettings);
  return res.json({
    success: true,
    message: 'SMTP settings saved successfully.',
    smtp: {
      user: updatedSettings.user,
      host: updatedSettings.host,
      port: updatedSettings.port,
      fromName: updatedSettings.fromName,
      isConfigured: Boolean(updatedSettings.user && updatedSettings.pass),
      hasPass: Boolean(updatedSettings.pass),
    },
  });
});

app.post('/api/admin/smtp/test', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { testEmail } = req.body || {};
  const targetEmail = testEmail || req.user?.email || 'atifraza4070@gmail.com';
  const testResult = await sendSystemEmail(
    targetEmail,
    'Fleet Bill 3.0 - SMTP Verification Test',
    'Congratulations! Your Fleet Bill 3.0 SMTP email delivery system is functioning correctly.'
  );
  if (testResult.success) {
    return res.json({
      success: true,
      simulation: Boolean('simulation' in testResult && testResult.simulation),
      message:
        'simulation' in testResult && testResult.simulation
          ? 'SMTP is currently in Simulation Mode. Provide your SMTP password to send live emails.'
          : `Test email successfully dispatched to ${targetEmail}!`,
    });
  }
  return res.status(500).json({ success: false, error: testResult.error || 'Failed to dispatch email.' });
});

// Global JSON Error Handler so Vercel never returns HTML/plain-text on API errors
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled API Error:', err);
  return res.status(500).json({ error: err?.message || 'Internal server error occurred.' });
});

export default app;
