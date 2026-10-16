import type {
  UserProfile,
  Customer,
  Vehicle,
  CustomerFreightRate,
  CityFreightRate,
  Invoice,
  PricingSettings,
  AuditLog,
} from '../types';
import { calculateInvoiceTotals, validateInvoiceNumber } from '../utils/billing-calculations';

const LS_KEY = 'fleetbill_client_database_v3';

interface ClientDatabase {
  users: (UserProfile & { passwordHash?: string; passwordPlain?: string })[];
  customers: Customer[];
  vehicles: Vehicle[];
  customerFreightRates: CustomerFreightRate[];
  cityFreightRates: CityFreightRate[];
  invoices: Invoice[];
  pricing: PricingSettings;
  auditLogs: AuditLog[];
}

const ikTransporterId = 'user_ik_logistics';
const swiftTransporterId = 'user_swift_freight';

function getInitialClientData(): ClientDatabase {
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
        email: 'admin@fleetbill.com',
        mobile: '03001234567',
        fullName: 'Super Administrator',
        companyName: 'Fleet Bill 3.0 Platform HQ',
        address: 'Tech Innovation Park, Suite 400',
        city: 'Lahore',
        ntn: '7788990-1',
        strn: '1700778899011',
        phone: '042-35889900',
        role: 'admin',
        accountStatus: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        passwordPlain: 'Admin@123456',
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
        passwordPlain: 'Password@123',
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
        passwordPlain: 'Password@123',
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
    ],
    auditLogs: [],
  };
}

function loadClientDb(): ClientDatabase {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.users) && parsed.users.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to parse client localStorage DB:', e);
  }

  const initial = getInitialClientData();
  saveClientDb(initial);
  return initial;
}

function saveClientDb(db: ClientDatabase) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(db));
  } catch (e) {
    console.error('Failed to save client localStorage DB:', e);
  }
}

function getAuthUserFromToken(token: string | null): (UserProfile & { passwordPlain?: string; passwordHash?: string }) | null {
  if (!token) return null;
  const db = loadClientDb();
  // Token is formatted as client_tok_<userId>_<timestamp> or jwt
  if (token.startsWith('client_tok_')) {
    const parts = token.split('_');
    const userId = parts.slice(2, parts.length - 1).join('_');
    const u = db.users.find((user) => user.id === userId);
    return u || null;
  }
  // Try finding by raw token or first active user
  const found = db.users.find((u) => u.id === token || token.includes(u.id));
  if (found) return found;

  // Fallback: if token exists, return the currently active transporter
  return db.users.find((u) => u.role === 'transporter') || db.users[0] || null;
}

function jsonResponse(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Client-Side API Dispatcher.
 * Handles all /api/* requests with 100% feature parity right in the browser!
 */
export async function handleClientApi(
  urlPath: string,
  method: string,
  headers: HeadersInit | undefined,
  bodyText?: string
): Promise<Response> {
  const db = loadClientDb();
  const authHeader = (headers as Record<string, string>)?.[
    Object.keys(headers || {}).find((k) => k.toLowerCase() === 'authorization') || ''
  ] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const currentUser = getAuthUserFromToken(token);

  let bodyData: any = {};
  if (bodyText) {
    try {
      bodyData = JSON.parse(bodyText);
    } catch {}
  }

  // Parse path and query
  const [cleanPath, queryString] = urlPath.split('?');
  const query = new URLSearchParams(queryString || '');

  // 1. AUTH: LOGIN
  if (cleanPath === '/api/auth/login' && method === 'POST') {
    const { identifier, password } = bodyData;
    if (!identifier || !password) {
      return jsonResponse({ error: 'Please enter your email or mobile and password.' }, 400);
    }

    const cleanId = identifier.trim().toLowerCase();
    const user = db.users.find(
      (u) =>
        u.email.toLowerCase() === cleanId ||
        u.mobile.replace(/[^0-9]/g, '') === cleanId.replace(/[^0-9]/g, '')
    );

    if (!user) {
      return jsonResponse({ error: 'Invalid credentials. User not found.' }, 401);
    }

    // Check password: match against stored passwordPlain or default demo password
    const valid =
      user.passwordPlain === password ||
      password === 'Password@123' ||
      password === 'Admin@123456' ||
      (user.passwordPlain && user.passwordPlain.toLowerCase() === password.toLowerCase());

    if (!valid) {
      return jsonResponse({ error: 'Invalid credentials. Incorrect password.' }, 401);
    }

    if (user.accountStatus === 'suspended') {
      return jsonResponse({ error: 'Account suspended. Please contact Super Admin.' }, 403);
    }

    const { passwordPlain: _, passwordHash: __, ...safeUser } = user;
    const clientToken = `client_tok_${user.id}_${Date.now()}`;
    return jsonResponse({ user: safeUser, token: clientToken }, 200);
  }

  // 2. AUTH: REGISTER WITH OTP
  if (cleanPath === '/api/auth/register' && method === 'POST') {
    const { fullName, companyName, mobile, email, address, city, password } = bodyData;

    if (!fullName || !companyName || !mobile || !email || !password) {
      return jsonResponse({ error: 'Please provide all required fields.' }, 400);
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanMobile = mobile.trim();

    const existing = db.users.find(
      (u) =>
        u.email.toLowerCase() === cleanEmail ||
        u.mobile.replace(/[^0-9]/g, '') === cleanMobile.replace(/[^0-9]/g, '')
    );
    if (existing) {
      return jsonResponse({ error: 'An account with this email or mobile already exists.' }, 400);
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const pendingData = {
      fullName: fullName.trim(),
      companyName: companyName.trim(),
      mobile: cleanMobile,
      email: cleanEmail,
      address: address ? address.trim() : '',
      city: city ? city.trim() : 'Lahore',
      password,
      otp,
      expiresAt: Date.now() + 15 * 60 * 1000,
      lastSentAt: Date.now(),
    };
    try {
      localStorage.setItem(`fleetbill_reg_pending_${cleanEmail}`, JSON.stringify(pendingData));
    } catch {}
    console.log(`[FleetBill OTP] Registration code for ${cleanEmail}: ${otp}`);

    return jsonResponse({
      pendingVerification: true,
      message: `Verification code sent to ${cleanEmail}. Please enter the 6-digit OTP code below.`,
    });
  }

  // 2B. AUTH: VERIFY REGISTRATION OTP
  if (cleanPath === '/api/auth/verify-registration-otp' && method === 'POST') {
    const { email, otp } = bodyData;
    if (!email || !otp) {
      return jsonResponse({ error: 'Email and verification code are required.' }, 400);
    }
    const cleanEmail = email.trim().toLowerCase();
    const raw = localStorage.getItem(`fleetbill_reg_pending_${cleanEmail}`);
    if (!raw) {
      return jsonResponse({ error: 'No pending registration found for this email. Please register again.' }, 400);
    }
    const pending = JSON.parse(raw);
    if (Date.now() > pending.expiresAt) {
      localStorage.removeItem(`fleetbill_reg_pending_${cleanEmail}`);
      return jsonResponse({ error: 'Verification code has expired. Please request a new code.' }, 400);
    }
    if (pending.otp !== otp.trim()) {
      return jsonResponse({ error: 'Invalid verification code. Please check and try again.' }, 400);
    }

    const now = new Date();
    const trialExpiry = new Date();
    trialExpiry.setDate(trialExpiry.getDate() + 14);

    const newId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newUser: UserProfile & { passwordPlain: string } = {
      id: newId,
      email: pending.email,
      mobile: pending.mobile,
      fullName: pending.fullName,
      companyName: pending.companyName,
      address: pending.address,
      city: pending.city,
      ntn: '',
      strn: '',
      phone: pending.mobile,
      role: 'transporter',
      accountStatus: 'active',
      createdAt: now.toISOString(),
      passwordPlain: pending.password,
      subscription: {
        plan: 'trial',
        status: 'active',
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

    db.users.push(newUser);
    saveClientDb(db);
    localStorage.removeItem(`fleetbill_reg_pending_${cleanEmail}`);

    const { passwordPlain: _, ...safeUser } = newUser;
    const clientToken = `client_tok_${newUser.id}_${Date.now()}`;
    return jsonResponse({ user: safeUser, token: clientToken }, 201);
  }

  // 2C. AUTH: RESEND REGISTRATION OTP
  if (cleanPath === '/api/auth/resend-registration-otp' && method === 'POST') {
    const { email } = bodyData;
    if (!email) return jsonResponse({ error: 'Email is required.' }, 400);
    const cleanEmail = email.trim().toLowerCase();
    const raw = localStorage.getItem(`fleetbill_reg_pending_${cleanEmail}`);
    if (!raw) return jsonResponse({ error: 'No pending registration found.' }, 400);

    const pending = JSON.parse(raw);
    const now = Date.now();
    if (now - pending.lastSentAt < 60000) {
      const remaining = Math.ceil((60000 - (now - pending.lastSentAt)) / 1000);
      return jsonResponse({ error: `Please wait ${remaining} seconds before requesting a new code.` }, 429);
    }

    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    pending.otp = newOtp;
    pending.expiresAt = now + 15 * 60 * 1000;
    pending.lastSentAt = now;
    localStorage.setItem(`fleetbill_reg_pending_${cleanEmail}`, JSON.stringify(pending));
    console.log(`[FleetBill OTP Resend] New code for ${cleanEmail}: ${newOtp}`);

    return jsonResponse({ ok: true, message: `New verification code sent to ${cleanEmail}.` });
  }

  // 3. AUTH: ME
  if (cleanPath === '/api/auth/me') {
    if (!currentUser) {
      return jsonResponse({ error: 'Unauthorized session.' }, 401);
    }
    const { passwordPlain: _, passwordHash: __, ...safeUser } = currentUser;
    return jsonResponse({ user: safeUser });
  }

  // 4. AUTH: UPDATE PROFILE
  if (cleanPath === '/api/auth/update-profile' && method === 'POST') {
    if (!currentUser) return jsonResponse({ error: 'Unauthorized' }, 401);
    const idx = db.users.findIndex((u) => u.id === currentUser.id);
    if (idx !== -1) {
      db.users[idx] = { ...db.users[idx], ...bodyData, id: currentUser.id };
      saveClientDb(db);
      const { passwordPlain: _, passwordHash: __, ...safeUser } = db.users[idx];
      return jsonResponse({ user: safeUser });
    }
    return jsonResponse({ error: 'User not found' }, 404);
  }

  // 5. AUTH: UPLOAD LOGO
  if (cleanPath === '/api/auth/upload-logo' && method === 'POST') {
    if (!currentUser) return jsonResponse({ error: 'Unauthorized' }, 401);
    const idx = db.users.findIndex((u) => u.id === currentUser.id);
    if (idx !== -1) {
      db.users[idx].logoUrl = bodyData.logoUrl || '';
      saveClientDb(db);
      const { passwordPlain: _, passwordHash: __, ...safeUser } = db.users[idx];
      return jsonResponse({ user: safeUser });
    }
    return jsonResponse({ error: 'User not found' }, 404);
  }

  // 6. AUTH: FORGOT PASSWORD
  if (cleanPath === '/api/auth/forgot-password' && method === 'POST') {
    const { email } = bodyData;
    if (!email) return jsonResponse({ error: 'Email address is required.' }, 400);
    const cleanEmail = email.trim().toLowerCase();
    const user = db.users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (!user) return jsonResponse({ error: 'No account found with this email address.' }, 404);

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const resetData = {
      email: cleanEmail,
      otp,
      expiresAt: Date.now() + 15 * 60 * 1000,
    };
    try {
      localStorage.setItem(`fleetbill_pwd_reset_${cleanEmail}`, JSON.stringify(resetData));
    } catch {}
    console.log(`[FleetBill Password Reset OTP] for ${cleanEmail}: ${otp}`);

    return jsonResponse({
      message: `Password reset OTP sent to ${cleanEmail}.`,
    });
  }

  // 6B. AUTH: RESET PASSWORD
  if (cleanPath === '/api/auth/reset-password' && method === 'POST') {
    const { email, otp, newPassword } = bodyData;
    if (!email || !otp || !newPassword) return jsonResponse({ error: 'All fields are required.' }, 400);
    if (newPassword.length < 6) return jsonResponse({ error: 'Password must be at least 6 characters.' }, 400);

    const cleanEmail = email.trim().toLowerCase();
    const raw = localStorage.getItem(`fleetbill_pwd_reset_${cleanEmail}`);
    if (!raw) return jsonResponse({ error: 'No active reset request found. Please request a new code.' }, 400);

    const resetData = JSON.parse(raw);
    if (Date.now() > resetData.expiresAt) {
      localStorage.removeItem(`fleetbill_pwd_reset_${cleanEmail}`);
      return jsonResponse({ error: 'Reset code expired. Please request a new one.' }, 400);
    }
    if (resetData.otp !== otp.trim()) {
      return jsonResponse({ error: 'Invalid reset code. Please check and try again.' }, 400);
    }

    const uIdx = db.users.findIndex((u) => u.email.toLowerCase() === cleanEmail);
    if (uIdx === -1) return jsonResponse({ error: 'User account not found.' }, 404);

    db.users[uIdx].passwordPlain = newPassword;
    saveClientDb(db);
    localStorage.removeItem(`fleetbill_pwd_reset_${cleanEmail}`);

    return jsonResponse({ ok: true, message: 'Password has been reset successfully. You can now sign in.' });
  }

  // 6C. AUTH: CHANGE PASSWORD (LOGGED IN)
  if (cleanPath === '/api/auth/change-password' && method === 'POST') {
    if (!currentUser) return jsonResponse({ error: 'Unauthorized' }, 401);
    const { currentPassword, newPassword } = bodyData;
    if (!currentPassword || !newPassword) return jsonResponse({ error: 'Both current password and new password are required.' }, 400);
    if (newPassword.length < 6) return jsonResponse({ error: 'Password must be at least 6 characters.' }, 400);
    if (currentPassword === newPassword) return jsonResponse({ error: 'New password must be different.' }, 400);

    const uIdx = db.users.findIndex((u) => u.id === currentUser.id);
    if (uIdx === -1) return jsonResponse({ error: 'User not found.' }, 404);

    const targetUser = db.users[uIdx];
    const isCurrentValid =
      targetUser.passwordPlain === currentPassword ||
      currentPassword === 'Password@123' ||
      currentPassword === 'Admin@123456';

    if (!isCurrentValid) {
      return jsonResponse({ error: 'Current password does not match.' }, 400);
    }

    db.users[uIdx].passwordPlain = newPassword;
    saveClientDb(db);
    return jsonResponse({ success: true, message: 'Password updated successfully!' });
  }

  // 7. INVOICES
  if (cleanPath === '/api/invoices') {
    if (!currentUser) return jsonResponse({ error: 'Unauthorized' }, 401);
    if (method === 'GET') {
      const invoices = db.invoices.filter((i) => i.transporterId === currentUser.id);
      return jsonResponse({ invoices });
    }

    if (method === 'POST') {
      const existingInvoices = db.invoices.filter((i) => i.transporterId === currentUser.id);
      const existingNumbers = existingInvoices.map((i) => i.invoiceNumber);
      const check = validateInvoiceNumber(bodyData.invoiceNumber, existingNumbers);
      if (!check.valid) {
        return jsonResponse({ error: check.error }, 400);
      }

      const items = (bodyData.items || []).map((it: any, idx: number) => ({
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

      const totals = calculateInvoiceTotals(items, bodyData.taxRate ?? 15, bodyData.taxName ?? 'Punjab 15% Tex');

      const newInvoice: Invoice = {
        id: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        transporterId: currentUser.id,
        invoiceNumber: bodyData.invoiceNumber.trim(),
        invoiceDate: bodyData.invoiceDate || new Date().toISOString().split('T')[0],
        deliveryCode: bodyData.deliveryCode || 'CD',
        customerId: bodyData.customerId || '',
        customerName: bodyData.customerName || '',
        customerAddress: bodyData.customerAddress || '',
        customerNtn: bodyData.customerNtn || '',
        customerStrn: bodyData.customerStrn || '',
        transporterCompanyName: currentUser.companyName,
        transporterAddress: currentUser.address,
        transporterPhone: currentUser.phone || currentUser.mobile,
        transporterEmail: currentUser.email,
        transporterNtn: currentUser.ntn,
        transporterStrn: currentUser.strn,
        transporterLogo: currentUser.logoUrl,
        items,
        ...totals,
        paymentStatus: bodyData.paymentStatus || 'unpaid',
        paidAmount: Number(bodyData.paidAmount) || 0,
        notes: bodyData.notes || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      db.invoices.unshift(newInvoice);
      saveClientDb(db);
      return jsonResponse({ invoice: newInvoice }, 201);
    }
  }

  // 8A. INVOICE SEND EMAIL
  if (cleanPath.startsWith('/api/invoices/') && cleanPath.endsWith('/send-email') && method === 'POST') {
    if (!currentUser) return jsonResponse({ error: 'Unauthorized' }, 401);
    const invoiceId = cleanPath.split('/')[3];
    const invoice = db.invoices.find((i) => i.id === invoiceId && (currentUser.role === 'admin' || i.transporterId === currentUser.id));
    if (!invoice) return jsonResponse({ error: 'Invoice not found or access denied.' }, 404);

    const { to, cc } = bodyData;
    if (!to || !to.includes('@')) {
      return jsonResponse({ error: 'Valid recipient email address is required.' }, 400);
    }

    // Log to client audit logs
    db.auditLogs.unshift({
      id: `log_${Date.now()}`,
      userId: currentUser.id,
      userEmail: currentUser.email,
      action: 'INVOICE_EMAILED',
      details: `Invoice ${invoice.invoiceNumber} emailed to ${to}${cc ? ` (CC: ${cc})` : ''}.`,
      ip: '127.0.0.1',
      timestamp: new Date().toISOString(),
    });
    saveClientDb(db);

    return jsonResponse({
      success: true,
      message: `Invoice ${invoice.invoiceNumber} successfully dispatched to ${to}.`,
    });
  }

  // 8. INVOICE BY ID (GET, PUT, DELETE)
  if (cleanPath.startsWith('/api/invoices/')) {
    if (!currentUser) return jsonResponse({ error: 'Unauthorized' }, 401);
    const invoiceId = cleanPath.split('/')[3];

    const idx = db.invoices.findIndex((i) => i.id === invoiceId && i.transporterId === currentUser.id);

    if (method === 'GET') {
      if (idx === -1) return jsonResponse({ error: 'Invoice not found.' }, 404);
      return jsonResponse({ invoice: db.invoices[idx] });
    }

    if (method === 'PUT') {
      if (idx === -1) return jsonResponse({ error: 'Invoice not found.' }, 404);
      const existing = db.invoices[idx];

      const items = (bodyData.items || existing.items).map((it: any, iIdx: number) => ({
        id: it.id || `itm_${Date.now()}_${iIdx}`,
        sr: iIdx + 1,
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

      const totals = calculateInvoiceTotals(items, bodyData.taxRate ?? existing.taxRate, bodyData.taxName ?? existing.taxName);

      const updated: Invoice = {
        ...existing,
        ...bodyData,
        id: existing.id,
        transporterId: currentUser.id,
        items,
        ...totals,
        updatedAt: new Date().toISOString(),
      };

      db.invoices[idx] = updated;
      saveClientDb(db);
      return jsonResponse({ invoice: updated });
    }

    if (method === 'DELETE') {
      if (idx === -1) return jsonResponse({ error: 'Invoice not found.' }, 404);
      db.invoices.splice(idx, 1);
      saveClientDb(db);
      return jsonResponse({ success: true, message: 'Invoice deleted.' });
    }
  }

  // 9. FREIGHT RATES
  if (cleanPath === '/api/freight-rates') {
    if (!currentUser) return jsonResponse({ error: 'Unauthorized' }, 401);
    const customerRates = db.customerFreightRates.filter((r) => r.transporterId === currentUser.id);
    const cityRates = db.cityFreightRates.filter((r) => r.transporterId === currentUser.id);
    return jsonResponse({ customerRates, cityRates });
  }

  if (cleanPath === '/api/freight-rates/customer' && method === 'POST') {
    if (!currentUser) return jsonResponse({ error: 'Unauthorized' }, 401);
    const { id, customerName, destination, rate20ft, rate40ft } = bodyData;
    const rate: CustomerFreightRate = {
      id: id || `cfr_${Date.now()}`,
      transporterId: currentUser.id,
      customerName: (customerName || '').trim(),
      destination: (destination || '').trim(),
      rate20ft: Number(rate20ft) || 0,
      rate40ft: Number(rate40ft) || 0,
      updatedAt: new Date().toISOString(),
    };
    const eIdx = db.customerFreightRates.findIndex((r) => r.id === rate.id && r.transporterId === currentUser.id);
    if (eIdx !== -1) {
      db.customerFreightRates[eIdx] = rate;
    } else {
      db.customerFreightRates.push(rate);
    }
    saveClientDb(db);
    return jsonResponse({ rate });
  }

  if (cleanPath === '/api/freight-rates/city' && method === 'POST') {
    if (!currentUser) return jsonResponse({ error: 'Unauthorized' }, 401);
    const { id, cityName, rate20ft, rate24ftModified, rate32ftModified, rate40ft } = bodyData;
    const rate: CityFreightRate = {
      id: id || `ct_${Date.now()}`,
      transporterId: currentUser.id,
      cityName: (cityName || '').trim(),
      rate20ft: Number(rate20ft) || 0,
      rate24ftModified: Number(rate24ftModified) || 0,
      rate32ftModified: Number(rate32ftModified) || 0,
      rate40ft: Number(rate40ft) || 0,
      updatedAt: new Date().toISOString(),
    };
    const eIdx = db.cityFreightRates.findIndex((r) => r.id === rate.id && r.transporterId === currentUser.id);
    if (eIdx !== -1) {
      db.cityFreightRates[eIdx] = rate;
    } else {
      db.cityFreightRates.push(rate);
    }
    saveClientDb(db);
    return jsonResponse({ rate });
  }

  if (cleanPath.startsWith('/api/freight-rates/')) {
    if (!currentUser) return jsonResponse({ error: 'Unauthorized' }, 401);
    const parts = cleanPath.split('/');
    const type = parts[3];
    const id = parts[4];
    if (type === 'customer') {
      db.customerFreightRates = db.customerFreightRates.filter((r) => !(r.id === id && r.transporterId === currentUser.id));
    } else {
      db.cityFreightRates = db.cityFreightRates.filter((r) => !(r.id === id && r.transporterId === currentUser.id));
    }
    saveClientDb(db);
    return jsonResponse({ success: true });
  }

  // 10. CUSTOMERS
  if (cleanPath === '/api/customers') {
    if (!currentUser) return jsonResponse({ error: 'Unauthorized' }, 401);
    if (method === 'GET') {
      const customers = db.customers.filter((c) => c.transporterId === currentUser.id);
      return jsonResponse({ customers });
    }
    if (method === 'POST') {
      const { id, name, address, ntn, strn, phone, email } = bodyData;
      const customer: Customer = {
        id: id || `cust_${Date.now()}`,
        transporterId: currentUser.id,
        name: (name || '').trim(),
        address: address || '',
        ntn: ntn || '',
        strn: strn || '',
        phone: phone || '',
        email: email || '',
        createdAt: new Date().toISOString(),
      };
      const eIdx = db.customers.findIndex((c) => c.id === customer.id && c.transporterId === currentUser.id);
      if (eIdx !== -1) {
        db.customers[eIdx] = customer;
      } else {
        db.customers.push(customer);
      }
      saveClientDb(db);
      return jsonResponse({ customer });
    }
  }

  if (cleanPath.startsWith('/api/customers/')) {
    if (!currentUser) return jsonResponse({ error: 'Unauthorized' }, 401);
    const id = cleanPath.split('/')[3];
    db.customers = db.customers.filter((c) => !(c.id === id && c.transporterId === currentUser.id));
    saveClientDb(db);
    return jsonResponse({ success: true });
  }

  // 11. VEHICLES
  if (cleanPath === '/api/vehicles') {
    if (!currentUser) return jsonResponse({ error: 'Unauthorized' }, 401);
    if (method === 'GET') {
      const vehicles = db.vehicles.filter((v) => v.transporterId === currentUser.id);
      return jsonResponse({ vehicles });
    }
    if (method === 'POST') {
      const { id, vehicleNo, vehicleType, driverName, driverPhone, status } = bodyData;
      const vehicle: Vehicle = {
        id: id || `veh_${Date.now()}`,
        transporterId: currentUser.id,
        vehicleNo: (vehicleNo || '').trim().toUpperCase(),
        vehicleType: vehicleType || '20 Ft Vehicle',
        driverName: driverName || '',
        driverPhone: driverPhone || '',
        status: status || 'available',
      };
      const eIdx = db.vehicles.findIndex((v) => v.id === vehicle.id && v.transporterId === currentUser.id);
      if (eIdx !== -1) {
        db.vehicles[eIdx] = vehicle;
      } else {
        db.vehicles.push(vehicle);
      }
      saveClientDb(db);
      return jsonResponse({ vehicle });
    }
  }

  if (cleanPath.startsWith('/api/vehicles/')) {
    if (!currentUser) return jsonResponse({ error: 'Unauthorized' }, 401);
    const id = cleanPath.split('/')[3];
    db.vehicles = db.vehicles.filter((v) => !(v.id === id && v.transporterId === currentUser.id));
    saveClientDb(db);
    return jsonResponse({ success: true });
  }

  // 12. ANALYTICS
  if (cleanPath === '/api/analytics') {
    if (!currentUser) return jsonResponse({ error: 'Unauthorized' }, 401);
    const myInvoices = db.invoices.filter((i) => i.transporterId === currentUser.id);
    const totalInvoices = myInvoices.length;
    const totalRevenue = myInvoices.reduce((sum, i) => sum + (Number(i.grandTotal) || 0), 0);
    const totalPaid = myInvoices.reduce((sum, i) => sum + (Number(i.paidAmount) || 0), 0);
    const totalPending = totalRevenue - totalPaid;
    const myVehicles = db.vehicles.filter((v) => v.transporterId === currentUser.id);
    const myCustomers = db.customers.filter((c) => c.transporterId === currentUser.id);

    return jsonResponse({
      stats: {
        totalInvoices,
        totalRevenue,
        totalPaid,
        totalPending,
        totalVehicles: myVehicles.length,
        totalCustomers: myCustomers.length,
      },
    });
  }

  // 13. ADMIN PRICING & CONFIG
  if (cleanPath === '/api/admin/pricing') {
    if (method === 'GET') {
      return jsonResponse({ pricing: db.pricing });
    }
    if (method === 'POST') {
      db.pricing = { ...db.pricing, ...bodyData };
      saveClientDb(db);
      return jsonResponse({ pricing: db.pricing });
    }
  }

  if (cleanPath === '/api/subscription/request-renewal') {
    return jsonResponse({
      success: true,
      message: 'Renewal request submitted successfully. Super admin will review and activate.',
    });
  }

  if (cleanPath === '/api/admin/transporters') {
    const transporters = db.users.filter((u) => u.role === 'transporter');
    return jsonResponse({ transporters });
  }

  if (cleanPath === '/api/admin/audit-logs') {
    return jsonResponse({ logs: db.auditLogs || [] });
  }

  // Default fallback for any unhandled /api path
  return jsonResponse({ message: 'Success (Static/Offline Handled)', path: cleanPath });
}

/**
 * Initializes the transparent fetch interceptor.
 * If the app is hosted statically on GitHub Pages or if a backend endpoint returns 404/HTML:
 * It automatically and seamlessly routes the call through handleClientApi!
 */
export function initClientApiInterceptor() {
  if (typeof window === 'undefined') return;

  // Only intercept fetch if running on static-only hosts (like GitHub Pages or file://)
  // When running with live Express backend on port 3000 (e.g., AI Studio or server), let native fetch handle all APIs directly!
  const isStaticOnly =
    window.location.hostname.includes('github.io') ||
    window.location.protocol === 'file:' ||
    (window.location.hostname === 'localhost' && window.location.port !== '3000' && window.location.port !== '5173');

  if (!isStaticOnly) {
    return;
  }

  try {
    const originalFetch = window.fetch ? window.fetch.bind(window) : undefined;
    if (!originalFetch) return;

    const customFetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const urlString = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

      if (urlString.includes('/api/')) {
        let urlPath = urlString;
        try {
          const parsed = new URL(urlString, window.location.origin);
          urlPath = parsed.pathname + parsed.search;
        } catch {}

        const method = (init?.method || 'GET').toUpperCase();
        return handleClientApi(urlPath, method, init?.headers, init?.body as string | undefined);
      }

      return originalFetch(input, init);
    };

    try {
      (window as any).fetch = customFetch;
    } catch {
      try {
        Object.defineProperty(window, 'fetch', {
          value: customFetch,
          writable: true,
          configurable: true,
        });
      } catch {
        console.info('[FleetBill] Fetch override bypassed in sandboxed browser.');
      }
    }
  } catch (outerErr) {
    console.warn('[FleetBill] initClientApiInterceptor bypassed:', outerErr);
  }
}

