import fs from 'fs';
import os from 'os';
import path from 'path';
import bcrypt from 'bcryptjs';
import type {
  UserProfile,
  Customer,
  Vehicle,
  CustomerFreightRate,
  CityFreightRate,
  DispatchFreightRate,
  TransporterVehicleType,
  Invoice,
  AuditLog,
  PricingSettings,
} from '../types';

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
        email: 'iklogisticsofficial@gmail.com',
        mobile: '03016411664',
        fullName: 'Imran Khan',
        companyName: 'IK LOGISTICS (SMC) PVT LTD',
        address: 'BSP GATE NO.1, 10KM KRK ROAD KASUR',
        city: 'Kasur',
        ntn: 'J-622143',
        strn: '1700300067314',
        phone: '0301 6411664',
        role: 'transporter',
        accountStatus: 'active',
        createdAt: '2026-02-15T09:30:00.000Z',
        passwordHash: userHash,
        subscription: {
          plan: 'yearly',
          status: 'active',
          startDate: '2026-03-01',
          expiryDate: '2027-03-01',
          price: 50000,
          paymentReference: 'MEZN-TX-89214',
          paymentDate: '2026-03-01',
          approvedBy: 'Super Administrator',
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
        email: 'swiftfreight@gmail.com',
        mobile: '03219876543',
        fullName: 'Tariq Mehmood',
        companyName: 'SWIFT FREIGHT CARRIERS',
        address: 'Plot 45, Truck Stand Circular Road',
        city: 'Faisalabad',
        ntn: '8877665-3',
        strn: '1700887766532',
        phone: '0321 9876543',
        role: 'transporter',
        accountStatus: 'active',
        createdAt: '2026-05-10T11:00:00.000Z',
        passwordHash: userHash,
        subscription: {
          plan: 'monthly',
          status: 'active',
          startDate: '2026-10-01',
          expiryDate: '2026-11-01',
          price: 5000,
          paymentReference: 'HBL-DEP-55410',
          paymentDate: '2026-10-01',
          approvedBy: 'Super Administrator',
        },
      },
    ],
    customers: [
      {
        id: 'cust_bsp',
        transporterId: ikTransporterId,
        name: 'M/S BULLEH SHAH PACKAGING (PVT) LTD',
        address: 'Shahrah-e-Roomi, P.O Amer Sidhu Lahore',
        ntn: '3000673-2',
        strn: '1700300067314',
        phone: '042-35800000',
        email: 'billing@bullehshah.com.pk',
        createdAt: '2026-03-01T00:00:00.000Z',
      },
      {
        id: 'cust_coca_cola',
        transporterId: ikTransporterId,
        name: 'Coca Cola Beverages Pakistan Limited',
        address: 'Gulberg III, Lahore, Pakistan',
        ntn: '2233441-1',
        strn: '1700223344112',
        phone: '042-35750000',
        email: 'logistics@ccbpl.com',
        createdAt: '2026-03-10T00:00:00.000Z',
      },
      {
        id: 'cust_swift_1',
        transporterId: swiftTransporterId,
        name: 'Sitara Chemical Industries Ltd',
        address: '32-KM Sheikhupura Road, Faisalabad',
        ntn: '1422331-5',
        strn: '1700142233155',
        phone: '041-4689141',
        email: 'logistics@sitara.com',
        createdAt: '2026-05-12T00:00:00.000Z',
      },
    ],
    vehicles: [
      { id: 'veh_1', transporterId: ikTransporterId, vehicleNo: 'LZR 1089', vehicleType: '20 Ft Vehicle', driverName: 'Muhammad Akram', driverPhone: '03001122334', status: 'available' },
      { id: 'veh_2', transporterId: ikTransporterId, vehicleNo: 'GLT 5105', vehicleType: '20 Ft Vehicle', driverName: 'Abdul Ghafoor', driverPhone: '03002233445', status: 'available' },
      { id: 'veh_3', transporterId: ikTransporterId, vehicleNo: 'TLG 148', vehicleType: '20 Ft Vehicle', driverName: 'Sajid Ali', driverPhone: '03003344556', status: 'available' },
      { id: 'veh_4', transporterId: ikTransporterId, vehicleNo: 'C 3754', vehicleType: '40 Ft Vehicle', driverName: 'Rashid Khan', driverPhone: '03004455667', status: 'available' },
      { id: 'veh_5', transporterId: ikTransporterId, vehicleNo: 'TLB 323', vehicleType: '40 Ft Vehicle', driverName: 'Nadeem Akhtar', driverPhone: '03005566778', status: 'available' },
      { id: 'veh_6', transporterId: ikTransporterId, vehicleNo: 'E 3568', vehicleType: '20 Ft Vehicle', driverName: 'Bashir Ahmed', driverPhone: '03006677889', status: 'available' },
      { id: 'veh_7', transporterId: ikTransporterId, vehicleNo: 'TAW 387', vehicleType: '20 Ft Vehicle', driverName: 'Zubair Shah', driverPhone: '03007788990', status: 'available' },
      { id: 'veh_8', transporterId: ikTransporterId, vehicleNo: 'CAY 3019', vehicleType: '20 Ft Vehicle', driverName: 'Mohsin Raza', driverPhone: '03008899001', status: 'available' },
      { id: 'veh_9', transporterId: ikTransporterId, vehicleNo: 'TAU 490', vehicleType: '20 Ft Vehicle', driverName: 'Farhan Tariq', driverPhone: '03009900112', status: 'available' },
      { id: 'veh_10', transporterId: ikTransporterId, vehicleNo: 'LOT 1875', vehicleType: '20 Ft Vehicle', driverName: 'Shahid Iqbal', driverPhone: '03011122334', status: 'available' },
      { id: 'veh_11', transporterId: ikTransporterId, vehicleNo: 'JY 2999', vehicleType: '20 Ft Vehicle', driverName: 'Kamran Ali', driverPhone: '03012233445', status: 'available' },
      { id: 'veh_12', transporterId: ikTransporterId, vehicleNo: 'LXT 7369', vehicleType: '20 Ft Vehicle', driverName: 'Waqas Munir', driverPhone: '03013344556', status: 'available' },
      { id: 'veh_13', transporterId: ikTransporterId, vehicleNo: 'JT 1082', vehicleType: '20 Ft Vehicle', driverName: 'Irfan Qasim', driverPhone: '03014455667', status: 'available' },
      { id: 'veh_14', transporterId: ikTransporterId, vehicleNo: 'CBG 214', vehicleType: '20 Ft Vehicle', driverName: 'Naveed Gul', driverPhone: '03015566778', status: 'available' },
      { id: 'veh_15', transporterId: ikTransporterId, vehicleNo: 'TAY 590', vehicleType: '20 Ft Vehicle', driverName: 'Khalid Bhatti', driverPhone: '03016677889', status: 'available' },
      { id: 'veh_16', transporterId: ikTransporterId, vehicleNo: 'LES 9297', vehicleType: '20 Ft Vehicle', driverName: 'Asif Mehmood', driverPhone: '03017788990', status: 'available' },
    ],
    customerFreightRates: [
      { id: 'cfr_1', transporterId: ikTransporterId, customerName: 'Coca Cola Beverages', destination: 'Raiwind', rate20ft: 28200, rate40ft: 51300 },
      { id: 'cfr_2', transporterId: ikTransporterId, customerName: 'Coca Cola Beverages', destination: 'Gujranwala', rate20ft: 46200, rate40ft: 85400 },
      { id: 'cfr_3', transporterId: ikTransporterId, customerName: 'Coca Cola Beverages', destination: 'Faisalabad', rate20ft: 47800, rate40ft: 85400 },
      { id: 'cfr_4', transporterId: ikTransporterId, customerName: 'Coca Cola Beverages', destination: 'Multan', rate20ft: 50300, rate40ft: 88700 },
      { id: 'cfr_5', transporterId: ikTransporterId, customerName: 'Coca Cola Beverages', destination: 'Rahim Yar Khan', rate20ft: 79900, rate40ft: 109100 },
      { id: 'cfr_6', transporterId: ikTransporterId, customerName: 'Coca Cola Beverages', destination: 'Karachi', rate20ft: 94300, rate40ft: 158700 },
      { id: 'cfr_7', transporterId: ikTransporterId, customerName: 'Coca Cola Beverages', destination: 'Hattar', rate20ft: 74500, rate40ft: 132500 },
      { id: 'cfr_8', transporterId: ikTransporterId, customerName: 'Colgate Palmolive', destination: 'Raiwind', rate20ft: 20300, rate40ft: 38100 },
      { id: 'cfr_9', transporterId: ikTransporterId, customerName: 'Philip Morris International', destination: 'Qadirabad', rate20ft: 31500, rate40ft: 50000 },
    ],
    cityFreightRates: [
      { id: 'ct_1', transporterId: ikTransporterId, cityName: 'Akhora (C48)', rate20ft: 90800, rate24ftModified: 108200, rate32ftModified: 130200, rate40ft: 163700 },
      { id: 'ct_2', transporterId: ikTransporterId, cityName: 'BahawalPur', rate20ft: 33200, rate24ftModified: 40400, rate32ftModified: 46700, rate40ft: 52500 },
      { id: 'ct_3', transporterId: ikTransporterId, cityName: 'Bhai Pheru', rate20ft: 19000, rate24ftModified: 26200, rate32ftModified: 30600, rate40ft: 35400 },
      { id: 'ct_4', transporterId: ikTransporterId, cityName: 'Chiniot', rate20ft: 32600, rate24ftModified: 39700, rate32ftModified: 47100, rate40ft: 52500 },
      { id: 'ct_5', transporterId: ikTransporterId, cityName: 'Faisalabad', rate20ft: 34400, rate24ftModified: 40800, rate32ftModified: 55400, rate40ft: 68000 },
      { id: 'ct_6', transporterId: ikTransporterId, cityName: 'Faisalabad - Industrial', rate20ft: 36300, rate24ftModified: 43400, rate32ftModified: 56800, rate40ft: 71000 },
      { id: 'ct_7', transporterId: ikTransporterId, cityName: 'Feroze Watowan', rate20ft: 28100, rate24ftModified: 32700, rate32ftModified: 42900, rate40ft: 55300 },
      { id: 'ct_8', transporterId: ikTransporterId, cityName: 'Gadoon', rate20ft: 77300, rate24ftModified: 87900, rate32ftModified: 101900, rate40ft: 134000 },
      { id: 'ct_9', transporterId: ikTransporterId, cityName: 'Ghakhar', rate20ft: 31500, rate24ftModified: 33900, rate32ftModified: 45100, rate40ft: 52500 },
      { id: 'ct_10', transporterId: ikTransporterId, cityName: 'Gujrat', rate20ft: 31500, rate24ftModified: 36600, rate32ftModified: 55800, rate40ft: 69750 },
      { id: 'ct_11', transporterId: ikTransporterId, cityName: 'Gujranwala', rate20ft: 26200, rate24ftModified: 33200, rate32ftModified: 39800, rate40ft: 44600 },
      { id: 'ct_12', transporterId: ikTransporterId, cityName: 'Haroon Abad', rate20ft: 44100, rate24ftModified: 53700, rate32ftModified: 71600, rate40ft: 89500 },
      { id: 'ct_13', transporterId: ikTransporterId, cityName: 'Hattar', rate20ft: 67300, rate24ftModified: 79100, rate32ftModified: 112000, rate40ft: 135900 },
      { id: 'ct_14', transporterId: ikTransporterId, cityName: 'Multan', rate20ft: 39300, rate24ftModified: 43200, rate32ftModified: 46000, rate40ft: 50000 },
      { id: 'ct_15', transporterId: ikTransporterId, cityName: 'Kabirwala', rate20ft: 42200, rate24ftModified: 47000, rate32ftModified: 53000, rate40ft: 61000 },
      { id: 'ct_16', transporterId: ikTransporterId, cityName: 'Toba Tek Singh', rate20ft: 42200, rate24ftModified: 48000, rate32ftModified: 54000, rate40ft: 63000 },
      { id: 'ct_17', transporterId: ikTransporterId, cityName: 'Raiwind', rate20ft: 18900, rate24ftModified: 22000, rate32ftModified: 25000, rate40ft: 32000 },
      { id: 'ct_18', transporterId: ikTransporterId, cityName: 'Kasur', rate20ft: 19600, rate24ftModified: 23500, rate32ftModified: 27000, rate40ft: 34000 },
      { id: 'ct_19', transporterId: ikTransporterId, cityName: 'Q.Abad', rate20ft: 31500, rate24ftModified: 36000, rate32ftModified: 42000, rate40ft: 50000 },
    ],
    invoices: [
      {
        id: 'inv_ik_004',
        transporterId: ikTransporterId,
        invoiceNumber: 'IK-BSP-26-004-Punjab',
        invoiceDate: '08.10.2026',
        deliveryCode: 'CD',
        customerId: 'cust_bsp',
        customerName: 'M/S BULLEH SHAH PACKAGING (PVT) LTD',
        customerAddress: 'Shahrah-e-Roomi, P.O Amer Sidhu Lahore',
        customerNtn: '3000673-2',
        customerStrn: '1700300067314',
        transporterCompanyName: 'IK LOGISTICS (SMC) PVT LTD',
        transporterAddress: 'BSP GATE NO.1, 10KM KRK ROAD KASUR',
        transporterPhone: '0301 6411664',
        transporterEmail: 'iklogisticsofficial@gmail.com',
        transporterNtn: 'J-622143',
        transporterStrn: '1700300067314',
        taxRate: 15,
        taxName: 'Total Punjab 15% Tex',
        freightTotal: 595850,
        unloadingTotal: 0,
        moveTotal: 6000,
        haltingCustomerTotal: 79000,
        haltingFactoryTotal: 6000,
        subTotal: 686850,
        taxAmount: 103027.5,
        grandTotal: 789877.5,
        paymentStatus: 'paid',
        paidAmount: 789877.5,
        notes: 'Official billing cycle for October 2026 deliveries.',
        createdAt: '2026-10-08T10:00:00.000Z',
        updatedAt: '2026-10-08T10:00:00.000Z',
        items: [
          { id: 'itm_1', sr: 1, cdDespatch: 'CD81052367', freightOrder: '6100000000', loadingDate: '27.09.2026', offloadingDate: '29.09.2026', vehicleNo: 'LZR 1089', vehicleType: '20 Ft Vehicle', distributorName: 'PEPSI COLA INTERNATIONAL', city: 'MULTAN', freight: 43200, unloading: 0, move: 0, haltingCustomer: 4000, haltingFactory: 0, subTotal: 47200 },
          { id: 'itm_2', sr: 2, cdDespatch: 'CD81052409', freightOrder: '6100000000', loadingDate: '27.09.2026', offloadingDate: '29.09.2026', vehicleNo: 'GLT 5105', vehicleType: '20 Ft Vehicle', distributorName: 'PEPSI COLA INTERNATIONAL', city: 'MULTAN', freight: 39300, unloading: 0, move: 0, haltingCustomer: 0, haltingFactory: 0, subTotal: 39300 },
          { id: 'itm_3', sr: 3, cdDespatch: 'CD81052410', freightOrder: '6100000000', loadingDate: '27.09.2026', offloadingDate: '29.09.2026', vehicleNo: 'TLG 148', vehicleType: '20 Ft Vehicle', distributorName: 'PEPSI COLA INTERNATIONAL', city: 'MULTAN', freight: 39650, unloading: 0, move: 6000, haltingCustomer: 0, haltingFactory: 0, subTotal: 45650 },
          { id: 'itm_4', sr: 4, cdDespatch: 'CD81052735', freightOrder: '6100000000', loadingDate: '29.09.2026', offloadingDate: '02.10.2026', vehicleNo: 'C 3754', vehicleType: '40 Ft Vehicle', distributorName: 'PEPSI COLA INTERNATIONAL', city: 'MULTAN', freight: 50000, unloading: 0, move: 0, haltingCustomer: 6000, haltingFactory: 0, subTotal: 56000 },
          { id: 'itm_5', sr: 5, cdDespatch: 'CD81052739', freightOrder: '6100000000', loadingDate: '29.09.2026', offloadingDate: '01.10.2026', vehicleNo: 'TLB 323', vehicleType: '40 Ft Vehicle', distributorName: 'EASTERN PRODUCTS', city: 'HAROONABAD', freight: 89500, unloading: 0, move: 0, haltingCustomer: 0, haltingFactory: 6000, subTotal: 95500 },
          { id: 'itm_6', sr: 6, cdDespatch: 'CD81052758', freightOrder: '6100000000', loadingDate: '29.09.2026', offloadingDate: '01.10.2026', vehicleNo: 'E 3568', vehicleType: '20 Ft Vehicle', distributorName: 'CHOUDARY POULTARY', city: 'TOBA TEK SINGH', freight: 42200, unloading: 0, move: 0, haltingCustomer: 4000, haltingFactory: 0, subTotal: 46200 },
          { id: 'itm_7', sr: 7, cdDespatch: 'CD81052952', freightOrder: '6100000000', loadingDate: '30.09.2026', offloadingDate: '03.10.2026', vehicleNo: 'TAW 387', vehicleType: '20 Ft Vehicle', distributorName: 'NESTLE PAKISTAN LTD', city: 'KABIRWALA', freight: 42200, unloading: 0, move: 0, haltingCustomer: 4000, haltingFactory: 0, subTotal: 46200 },
          { id: 'itm_8', sr: 8, cdDespatch: 'CD81052981', freightOrder: '6100000000', loadingDate: '01.10.2026', offloadingDate: '04.10.2026', vehicleNo: 'CAY 3019', vehicleType: '20 Ft Vehicle', distributorName: 'EASTERN PRODUCTS', city: 'HAROONABAD', freight: 44100, unloading: 0, move: 0, haltingCustomer: 8000, haltingFactory: 0, subTotal: 52100 },
          { id: 'itm_9', sr: 9, cdDespatch: 'CD81052988', freightOrder: '6100000000', loadingDate: '01.10.2026', offloadingDate: '05.10.2026', vehicleNo: 'TAU 490', vehicleType: '20 Ft Vehicle', distributorName: 'SHAN FOOD', city: 'RAIWIND', freight: 18900, unloading: 0, move: 0, haltingCustomer: 16000, haltingFactory: 0, subTotal: 34900 },
          { id: 'itm_10', sr: 10, cdDespatch: 'CD81053011', freightOrder: '6100000000', loadingDate: '01.10.2026', offloadingDate: '06.10.2026', vehicleNo: 'LOT 1875', vehicleType: '20 Ft Vehicle', distributorName: 'NESTLE PAKISTAN LTD', city: 'KABIRWALA', freight: 42200, unloading: 0, move: 0, haltingCustomer: 12000, haltingFactory: 0, subTotal: 54200 },
          { id: 'itm_11', sr: 11, cdDespatch: 'CD81053028', freightOrder: '6100000000', loadingDate: '01.10.2026', offloadingDate: '05.10.2026', vehicleNo: 'JY 2999', vehicleType: '20 Ft Vehicle', distributorName: 'SHAN FOOD', city: 'RAIWIND', freight: 25000, unloading: 0, move: 0, haltingCustomer: 15000, haltingFactory: 0, subTotal: 40000 },
          { id: 'itm_12', sr: 12, cdDespatch: 'CD81053403', freightOrder: '6100000000', loadingDate: '04.10.2026', offloadingDate: '07.10.2026', vehicleNo: 'LXT 7369', vehicleType: '20 Ft Vehicle', distributorName: 'PHILIP MORRIS', city: 'Q.ABAD', freight: 31500, unloading: 0, move: 0, haltingCustomer: 4000, haltingFactory: 0, subTotal: 35500 },
          { id: 'itm_13', sr: 13, cdDespatch: 'CD81053478', freightOrder: '6100000000', loadingDate: '05.10.2026', offloadingDate: '07.10.2026', vehicleNo: 'JT 1082', vehicleType: '20 Ft Vehicle', distributorName: 'HNR COMPANY', city: 'RAIWIND', freight: 20000, unloading: 0, move: 0, haltingCustomer: 6000, haltingFactory: 0, subTotal: 26000 },
          { id: 'itm_14', sr: 14, cdDespatch: 'CD81053783', freightOrder: '6100000000', loadingDate: '08.10.2026', offloadingDate: '08.10.2026', vehicleNo: 'CBG 214', vehicleType: '20 Ft Vehicle', distributorName: 'HNR COMPANY', city: 'RAIWIND', freight: 25000, unloading: 0, move: 0, haltingCustomer: 0, haltingFactory: 0, subTotal: 25000 },
          { id: 'itm_15', sr: 15, cdDespatch: 'B.NO: 11', freightOrder: 'CP-511', loadingDate: '01.10.2026', offloadingDate: '01.10.2026', vehicleNo: 'TAY 590', vehicleType: '20 Ft Vehicle', distributorName: 'TAPAL TO BSP', city: 'KASUR', freight: 19600, unloading: 0, move: 0, haltingCustomer: 0, haltingFactory: 0, subTotal: 19600 },
          { id: 'itm_16', sr: 16, cdDespatch: 'B.NO: 70', freightOrder: 'CP-510', loadingDate: '01.10.2026', offloadingDate: '01.10.2026', vehicleNo: 'LES 9297', vehicleType: '20 Ft Vehicle', distributorName: 'Q.ABAD TO BSP', city: 'KASUR', freight: 23500, unloading: 0, move: 0, haltingCustomer: 0, haltingFactory: 0, subTotal: 23500 },
        ],
      },
      {
        id: 'inv_ik_003',
        transporterId: ikTransporterId,
        invoiceNumber: 'IK-BSP-26-003-PUNJAB',
        invoiceDate: '08.10.2026',
        deliveryCode: 'CD',
        customerId: 'cust_bsp',
        customerName: 'M/S BULLEH SHAH PACKAGING (PVT) LTD',
        customerAddress: 'Shahrah-e-Roomi, P.O Amer Sidhu Lahore',
        customerNtn: '3000673-2',
        customerStrn: '1700300067314',
        transporterCompanyName: 'IK LOGISTICS (SMC) PVT LTD',
        transporterAddress: 'BSP GATE NO.1, 10KM KRK ROAD KASUR',
        transporterPhone: '0301 6411664',
        transporterEmail: 'iklogisticsofficial@gmail.com',
        transporterNtn: 'J622143',
        taxRate: 15,
        taxName: 'Punjab 15% Tex',
        freightTotal: 595850,
        unloadingTotal: 0,
        moveTotal: 6000,
        haltingCustomerTotal: 79000,
        haltingFactoryTotal: 6000,
        subTotal: 686850,
        taxAmount: 103027.5,
        grandTotal: 789878,
        paymentStatus: 'paid',
        paidAmount: 789878,
        notes: 'Preceding billing cycle matching Screenshot 1.',
        createdAt: '2026-10-01T10:00:00.000Z',
        updatedAt: '2026-10-01T10:00:00.000Z',
        items: [
          { id: 'itm_003_1', sr: 1, cdDespatch: 'CD81051900', freightOrder: '6100000000', loadingDate: '20.09.2026', offloadingDate: '22.09.2026', vehicleNo: 'LZR 1089', vehicleType: '20 Ft Vehicle', distributorName: 'PEPSI COLA INTERNATIONAL', city: 'MULTAN', freight: 686850, unloading: 0, move: 0, haltingCustomer: 0, haltingFactory: 0, subTotal: 686850 }
        ]
      }
    ],
    auditLogs: [
      {
        id: 'log_init',
        timestamp: '2026-10-01T00:00:00.000Z',
        userId: 'user_super_admin',
        userEmail: 'admin@fleetbill.com',
        action: 'SYSTEM_INITIALIZATION',
        details: 'Fleet Bill 3.0 Platform database initialized with enterprise security defaults.',
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
        if (!loaded.users.some((u: any) => u.email === 'atifraza4070@gmail.com')) {
          const salt = bcrypt.genSaltSync(10);
          const adminHash = bcrypt.hashSync('Admin@123456', salt);
          loaded.users.push({
            id: 'user_super_admin_atif',
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
          });
          this.persist(loaded);
        }

        if (!loaded.dispatchFreightRates) {
          loaded.dispatchFreightRates = [];
        }
        if (!loaded.vehicleTypes) {
          loaded.vehicleTypes = [];
        }

        // Ensure default vehicle types exist for transporters
        const defaultVehicleTypes = ['20 Ft Vehicle', '23-24 Ft Modified', '32 Ft Modified', '40 Ft Vehicle'];
        let updatedSchema = false;
        for (const u of loaded.users) {
          if (u.role === 'transporter') {
            for (const vtName of defaultVehicleTypes) {
              const norm = vtName.trim().toLowerCase();
              if (!loaded.vehicleTypes.some((vt: any) => vt.transporterId === u.id && vt.normalizedName === norm)) {
                loaded.vehicleTypes.push({
                  id: `vt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                  transporterId: u.id,
                  name: vtName,
                  normalizedName: norm,
                  status: 'active',
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                });
                updatedSchema = true;
              }
            }
          }
        }

        // Seed initial sample dispatch rates for IK Logistics if empty
        if (loaded.dispatchFreightRates.length === 0) {
          loaded.dispatchFreightRates = [
            { id: 'dfr_1', transporterId: 'user_ik_logistics', dispatchNo: 'CD81052367', freightOrderNo: '6100000000', loadingDate: '27.09.2026', vehicleNo: 'LZR 1089', vehicleType: '20 Ft Vehicle', destination: 'MULTAN', freightRate: 43200, sourceFile: 'Initial_Rate_Master.xlsx', importedAt: '2026-10-01T00:00:00.000Z' },
            { id: 'dfr_2', transporterId: 'user_ik_logistics', dispatchNo: 'CD81052409', freightOrderNo: '6100000000', loadingDate: '27.09.2026', vehicleNo: 'GLT 5105', vehicleType: '20 Ft Vehicle', destination: 'MULTAN', freightRate: 39300, sourceFile: 'Initial_Rate_Master.xlsx', importedAt: '2026-10-01T00:00:00.000Z' },
            { id: 'dfr_3', transporterId: 'user_ik_logistics', dispatchNo: 'CD81052410', freightOrderNo: '6100000000', loadingDate: '27.09.2026', vehicleNo: 'TLG 148', vehicleType: '20 Ft Vehicle', destination: 'MULTAN', freightRate: 39650, sourceFile: 'Initial_Rate_Master.xlsx', importedAt: '2026-10-01T00:00:00.000Z' },
            { id: 'dfr_4', transporterId: 'user_ik_logistics', dispatchNo: 'CD81052735', freightOrderNo: '6100000000', loadingDate: '29.09.2026', vehicleNo: 'C 3754', vehicleType: '40 Ft Vehicle', destination: 'MULTAN', freightRate: 50000, sourceFile: 'Initial_Rate_Master.xlsx', importedAt: '2026-10-01T00:00:00.000Z' },
            { id: 'dfr_5', transporterId: 'user_ik_logistics', dispatchNo: 'CD81052739', freightOrderNo: '6100000000', loadingDate: '29.09.2026', vehicleNo: 'TLB 323', vehicleType: '40 Ft Vehicle', destination: 'HAROONABAD', freightRate: 89500, sourceFile: 'Initial_Rate_Master.xlsx', importedAt: '2026-10-01T00:00:00.000Z' },
            { id: 'dfr_6', transporterId: 'user_ik_logistics', dispatchNo: 'CD81052758', freightOrderNo: '6100000000', loadingDate: '29.09.2026', vehicleNo: 'E 3568', vehicleType: '20 Ft Vehicle', destination: 'TOBA TEK SINGH', freightRate: 42200, sourceFile: 'Initial_Rate_Master.xlsx', importedAt: '2026-10-01T00:00:00.000Z' },
            { id: 'dfr_7', transporterId: 'user_ik_logistics', dispatchNo: 'CD81052952', freightOrderNo: '6100000000', loadingDate: '30.09.2026', vehicleNo: 'TAW 387', vehicleType: '20 Ft Vehicle', destination: 'KABIRWALA', freightRate: 42200, sourceFile: 'Initial_Rate_Master.xlsx', importedAt: '2026-10-01T00:00:00.000Z' },
            { id: 'dfr_8', transporterId: 'user_ik_logistics', dispatchNo: 'CD81052981', freightOrderNo: '6100000000', loadingDate: '01.10.2026', vehicleNo: 'CAY 3019', vehicleType: '20 Ft Vehicle', destination: 'HAROONABAD', freightRate: 44100, sourceFile: 'Initial_Rate_Master.xlsx', importedAt: '2026-10-01T00:00:00.000Z' },
            { id: 'dfr_9', transporterId: 'user_ik_logistics', dispatchNo: 'CD81052988', freightOrderNo: '6100000000', loadingDate: '01.10.2026', vehicleNo: 'TAU 490', vehicleType: '20 Ft Vehicle', destination: 'RAIWIND', freightRate: 18900, sourceFile: 'Initial_Rate_Master.xlsx', importedAt: '2026-10-01T00:00:00.000Z' },
            { id: 'dfr_10', transporterId: 'user_ik_logistics', dispatchNo: 'CD81053011', freightOrderNo: '6100000000', loadingDate: '01.10.2026', vehicleNo: 'LOT 1875', vehicleType: '20 Ft Vehicle', destination: 'KABIRWALA', freightRate: 42200, sourceFile: 'Initial_Rate_Master.xlsx', importedAt: '2026-10-01T00:00:00.000Z' },
            { id: 'dfr_11', transporterId: 'user_ik_logistics', dispatchNo: 'CD81053028', freightOrderNo: '6100000000', loadingDate: '01.10.2026', vehicleNo: 'JY 2999', vehicleType: '20 Ft Vehicle', destination: 'RAIWIND', freightRate: 25000, sourceFile: 'Initial_Rate_Master.xlsx', importedAt: '2026-10-01T00:00:00.000Z' },
            { id: 'dfr_12', transporterId: 'user_ik_logistics', dispatchNo: 'CD81053403', freightOrderNo: '6100000000', loadingDate: '04.10.2026', vehicleNo: 'LXT 7369', vehicleType: '20 Ft Vehicle', destination: 'Q.ABAD', freightRate: 31500, sourceFile: 'Initial_Rate_Master.xlsx', importedAt: '2026-10-01T00:00:00.000Z' },
            { id: 'dfr_13', transporterId: 'user_ik_logistics', dispatchNo: 'CD81053478', freightOrderNo: '6100000000', loadingDate: '05.10.2026', vehicleNo: 'JT 1082', vehicleType: '20 Ft Vehicle', destination: 'RAIWIND', freightRate: 20000, sourceFile: 'Initial_Rate_Master.xlsx', importedAt: '2026-10-01T00:00:00.000Z' },
            { id: 'dfr_14', transporterId: 'user_ik_logistics', dispatchNo: 'CD81053783', freightOrderNo: '6100000000', loadingDate: '08.10.2026', vehicleNo: 'CBG 214', vehicleType: '20 Ft Vehicle', destination: 'RAIWIND', freightRate: 25000, sourceFile: 'Initial_Rate_Master.xlsx', importedAt: '2026-10-01T00:00:00.000Z' },
            { id: 'dfr_15', transporterId: 'user_ik_logistics', dispatchNo: 'B.NO: 11', freightOrderNo: 'CP-511', loadingDate: '01.10.2026', vehicleNo: 'TAY 590', vehicleType: '20 Ft Vehicle', destination: 'KASUR', freightRate: 19600, sourceFile: 'Initial_Rate_Master.xlsx', importedAt: '2026-10-01T00:00:00.000Z' },
            { id: 'dfr_16', transporterId: 'user_ik_logistics', dispatchNo: 'B.NO: 70', freightOrderNo: 'CP-510', loadingDate: '01.10.2026', vehicleNo: 'LES 9297', vehicleType: '20 Ft Vehicle', destination: 'KASUR', freightRate: 23500, sourceFile: 'Initial_Rate_Master.xlsx', importedAt: '2026-10-01T00:00:00.000Z' },
          ];
          updatedSchema = true;
        }

        if (updatedSchema) {
          this.persist(loaded);
        }
        return loaded;
      }
    } catch (err) {
      console.error('Error loading DB file, falling back to backup or initial seed:', err);
      if (fs.existsSync(BACKUP_FILE)) {
        try {
          const rawBackup = fs.readFileSync(BACKUP_FILE, 'utf-8');
          return JSON.parse(rawBackup);
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
      console.error('Failed to write database file:', err);
    }
  }

  public save(): void {
    this.persist(this.data);
  }

  // AUDIT LOGS
  public logAudit(userId: string, userEmail: string, action: string, details: string): void {
    const log: AuditLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date().toISOString(),
      userId,
      userEmail,
      action,
      details,
    };
    this.data.auditLogs.unshift(log);
    // keep latest 1000 logs
    if (this.data.auditLogs.length > 1000) {
      this.data.auditLogs.pop();
    }
    this.save();
  }

  public getAuditLogs(): AuditLog[] {
    return this.data.auditLogs;
  }

  // PRICING SETTINGS
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

  // USERS
  public getUsers(): (UserProfile & { passwordHash: string })[] {
    return this.data.users;
  }

  public findUserById(id: string): (UserProfile & { passwordHash: string }) | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  public findUserByEmailOrMobile(identifier: string): (UserProfile & { passwordHash: string }) | undefined {
    const clean = identifier.trim().toLowerCase();
    const found = this.data.users.find(
      (u) => u.email.toLowerCase() === clean || u.mobile.replace(/\D/g, '') === clean.replace(/\D/g, '')
    );
    if (found) return found;

    // Super Admin aliases: allow atifraza4070@gmail.com, admin@fleetbill.com, or admin
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
    this.data.users.push(userData);
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
            invoicePrefix: updates.settings.invoicePrefix ?? this.data.users[index].settings?.invoicePrefix ?? 'IK-BSP-26-',
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

  // CUSTOMERS (ISOLATED)
  public getCustomers(transporterId: string): Customer[] {
    return this.data.customers.filter((c) => c.transporterId === transporterId);
  }

  public findCustomerById(id: string, transporterId: string): Customer | undefined {
    return this.data.customers.find((c) => c.id === id && c.transporterId === transporterId);
  }

  public saveCustomer(customer: Customer): Customer {
    const index = this.data.customers.findIndex((c) => c.id === customer.id && c.transporterId === customer.transporterId);
    if (index >= 0) {
      this.data.customers[index] = customer;
    } else {
      this.data.customers.push(customer);
    }
    this.save();
    return customer;
  }

  public deleteCustomer(id: string, transporterId: string): boolean {
    const prevLen = this.data.customers.length;
    this.data.customers = this.data.customers.filter((c) => !(c.id === id && c.transporterId === transporterId));
    if (this.data.customers.length !== prevLen) {
      this.save();
      return true;
    }
    return false;
  }

  // VEHICLES (ISOLATED)
  public getVehicles(transporterId: string): Vehicle[] {
    return this.data.vehicles.filter((v) => v.transporterId === transporterId);
  }

  public saveVehicle(vehicle: Vehicle): Vehicle {
    const index = this.data.vehicles.findIndex((v) => v.id === vehicle.id && v.transporterId === vehicle.transporterId);
    if (index >= 0) {
      this.data.vehicles[index] = vehicle;
    } else {
      this.data.vehicles.push(vehicle);
    }
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

  // FREIGHT RATES (ISOLATED)
  public getCustomerFreightRates(transporterId: string): CustomerFreightRate[] {
    return this.data.customerFreightRates.filter((r) => r.transporterId === transporterId);
  }

  public getCityFreightRates(transporterId: string): CityFreightRate[] {
    return this.data.cityFreightRates.filter((r) => r.transporterId === transporterId);
  }

  public saveCustomerFreightRate(rate: CustomerFreightRate): CustomerFreightRate {
    const index = this.data.customerFreightRates.findIndex((r) => r.id === rate.id && r.transporterId === rate.transporterId);
    if (index >= 0) {
      this.data.customerFreightRates[index] = rate;
    } else {
      this.data.customerFreightRates.push(rate);
    }
    this.save();
    return rate;
  }

  public saveCityFreightRate(rate: CityFreightRate): CityFreightRate {
    const index = this.data.cityFreightRates.findIndex((r) => r.id === rate.id && r.transporterId === rate.transporterId);
    if (index >= 0) {
      this.data.cityFreightRates[index] = rate;
    } else {
      this.data.cityFreightRates.push(rate);
    }
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

  // INVOICES (ISOLATED)
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

  // ---------------- VEHICLE TYPES (DYNAMIC & ISOLATED) ----------------
  public getVehicleTypes(transporterId: string): TransporterVehicleType[] {
    if (!this.data.vehicleTypes) this.data.vehicleTypes = [];
    return this.data.vehicleTypes
      .filter((vt) => vt.transporterId === transporterId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getActiveVehicleTypes(transporterId: string): TransporterVehicleType[] {
    return this.getVehicleTypes(transporterId).filter((vt) => vt.status !== 'inactive');
  }

  public createVehicleType(transporterId: string, name: string): TransporterVehicleType {
    if (!this.data.vehicleTypes) this.data.vehicleTypes = [];
    const trimmed = name.trim();
    const normalized = trimmed.toLowerCase();

    // Prevent duplicates (case-insensitive & extra spaces trimmed)
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
      id: `vt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
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
    const index = this.data.vehicleTypes.findIndex(
      (vt) => vt.id === id && vt.transporterId === transporterId
    );
    if (index === -1) return null;

    const current = this.data.vehicleTypes[index];
    if (updates.name && updates.name.trim()) {
      current.name = updates.name.trim();
      current.normalizedName = current.name.toLowerCase();
    }
    if (updates.status) {
      current.status = updates.status;
    }
    current.updatedAt = new Date().toISOString();
    this.data.vehicleTypes[index] = current;
    this.save();
    return current;
  }

  public deleteVehicleType(transporterId: string, id: string): boolean {
    if (!this.data.vehicleTypes) return false;
    const prev = this.data.vehicleTypes.length;
    this.data.vehicleTypes = this.data.vehicleTypes.filter(
      (vt) => !(vt.id === id && vt.transporterId === transporterId)
    );
    if (this.data.vehicleTypes.length !== prev) {
      this.save();
      return true;
    }
    return false;
  }

  // ---------------- DISPATCH FREIGHT RATES (ISOLATED & AUTO-POPULATION) ----------------
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
    const rates = this.data.dispatchFreightRates.filter(
      (dfr) =>
        dfr.transporterId === transporterId &&
        (!q ||
          dfr.dispatchNo.toLowerCase().includes(q) ||
          dfr.freightOrderNo.toLowerCase().includes(q) ||
          dfr.vehicleNo.toLowerCase().includes(q) ||
          dfr.destination.toLowerCase().includes(q) ||
          dfr.vehicleType.toLowerCase().includes(q))
    );
    return rates.slice(0, limit);
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

      // Detect and auto-register new vehicle types
      if (r.vehicleType && r.vehicleType.trim()) {
        const vtName = r.vehicleType.trim();
        const normVt = vtName.toLowerCase();
        const existingVt = this.data.vehicleTypes.find(
          (vt) => vt.transporterId === transporterId && vt.normalizedName === normVt
        );
        if (!existingVt) {
          this.createVehicleType(transporterId, vtName);
          if (!newVehicleTypesAdded.includes(vtName)) {
            newVehicleTypesAdded.push(vtName);
          }
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
          id: `dfr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
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
    this.data.dispatchFreightRates = this.data.dispatchFreightRates.filter(
      (r) => r.transporterId !== transporterId
    );
    const deletedCount = initialLen - this.data.dispatchFreightRates.length;
    if (deletedCount > 0) {
      this.save();
    }
    return deletedCount;
  }
}

export const db = new StorageEngine();
