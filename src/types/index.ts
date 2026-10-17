export type UserRole = 'transporter' | 'admin';
export type AccountStatus = 'pending' | 'active' | 'suspended' | 'deactivated';
export type SubscriptionPlan = 'monthly' | 'yearly' | 'trial';
export type SubscriptionStatus = 'active' | 'pending_approval' | 'expired';

export interface SubscriptionInfo {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  startDate: string;
  expiryDate: string;
  price: number;
  paymentReference?: string;
  paymentDate?: string;
  approvedBy?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  mobile: string;
  fullName: string;
  companyName: string;
  address: string;
  city: string;
  ntn: string;
  strn: string;
  phone: string;
  logoUrl?: string;
  role: UserRole;
  accountStatus: AccountStatus;
  createdAt: string;
  subscription: SubscriptionInfo;
  settings?: {
    defaultTaxRate: number;
    defaultTaxName: string;
    invoicePrefix: string;
    currency: string;
  };
}

export interface Customer {
  id: string;
  transporterId: string;
  name: string;
  address: string;
  ntn: string;
  strn: string;
  phone: string;
  email: string;
  createdAt: string;
}

export interface Vehicle {
  id: string;
  transporterId: string;
  vehicleNo: string;
  vehicleType: '20 Ft Vehicle' | '23-24 Ft Modified' | '32 Ft Modified' | '40 Ft Vehicle' | string;
  driverName?: string;
  driverPhone?: string;
  status: 'available' | 'in_transit' | 'maintenance';
}

export interface CustomerFreightRate {
  id: string;
  transporterId: string;
  customerName: string;
  destination: string;
  rate20ft: number;
  rate40ft: number;
  updatedAt?: string;
}

export interface CityFreightRate {
  id: string;
  transporterId: string;
  cityName: string;
  rate20ft: number;
  rate24ftModified: number;
  rate32ftModified: number;
  rate40ft: number;
  updatedAt?: string;
}

export interface DispatchFreightRate {
  id: string;
  transporterId: string;
  dispatchNo: string;        // 1. Dispatch No.
  freightOrderNo: string;    // 2. Freight Order No.
  loadingDate: string;       // 3. Loading Date
  vehicleNo: string;         // 4. Vehicle No.
  vehicleType: string;       // 5. Vehicle Type
  destination: string;       // 6. Destination
  freightRate: number;       // 7. Freight Rate
  sourceFile?: string;
  importedAt: string;
}

export interface TransporterVehicleType {
  id: string;
  transporterId: string;
  name: string;
  normalizedName: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

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

export interface Invoice {
  id: string;
  transporterId: string;
  invoiceNumber: string;
  invoiceDate: string;
  deliveryCode?: string;
  customerId: string;
  customerName: string;
  customerAddress: string;
  customerNtn: string;
  customerStrn: string;
  customerEmail?: string;
  transporterCompanyName: string;
  transporterAddress: string;
  transporterPhone: string;
  transporterEmail: string;
  transporterNtn: string;
  transporterStrn?: string;
  transporterLogo?: string;
  taxRate: number;
  taxName: string;
  items: InvoiceItem[];
  freightTotal: number;
  unloadingTotal: number;
  moveTotal: number;
  haltingCustomerTotal: number;
  haltingFactoryTotal: number;
  subTotal: number;
  taxAmount: number;
  grandTotal: number;
  paymentStatus: 'unpaid' | 'paid' | 'partial';
  paidAmount: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userEmail: string;
  action: string;
  details: string;
  ip?: string;
}

export interface PricingSettings {
  monthlyPrice: number;
  yearlyPrice: number;
  bankDetails: {
    bankName: string;
    accountTitle: string;
    accountNumber: string;
    iban: string;
    supportContact: string;
  };
}
