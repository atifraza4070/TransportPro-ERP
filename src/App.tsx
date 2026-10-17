import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { InvoiceList } from './components/invoices/InvoiceList';
import { InvoiceForm } from './components/invoices/InvoiceForm';
import { InvoicePrintView } from './components/invoices/InvoicePrintView';
import { FreightRateManager } from './components/freight-rates/FreightRateManager';
import { CustomerManager } from './components/customers/CustomerManager';
import { VehicleManager } from './components/vehicles/VehicleManager';
import { AnalyticsDashboard } from './components/analytics/AnalyticsDashboard';
import { CompanyProfile } from './components/profile/CompanyProfile';
import { SubscriptionPage } from './components/subscription/SubscriptionPage';
import { SuperAdminPanel } from './components/admin/SuperAdminPanel';
import { AuthPages } from './components/auth/AuthPages';
import type { Invoice } from './types';
import { AlertTriangle, Clock, ShieldAlert, RefreshCw, LogOut, Building2, Mail, Phone } from 'lucide-react';

const MainAppContent: React.FC = () => {
  const { user, loading, isSuperAdmin, refreshUser, logout } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('invoices');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);

  useEffect(() => {
    if (isSuperAdmin && currentTab === 'invoices') {
      setCurrentTab('admin');
    }
  }, [isSuperAdmin]);

  // Auto-poll status when transporter is waiting for approval or disabled
  useEffect(() => {
    if (!user || user.role === 'admin' || user.accountStatus === 'active') return;
    const interval = setInterval(() => {
      refreshUser();
    }, 8000);
    return () => clearInterval(interval);
  }, [user, refreshUser]);

  // Invoices sub-navigation
  const [invoiceView, setInvoiceView] = useState<'list' | 'create' | 'edit' | 'print'>('list');
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-slate-300">Loading Fleet Bill 3.0...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPages />;
  }

  // Gate 1: Transporter Waiting for Super Admin Approval
  if (user.role !== 'admin' && user.accountStatus === 'pending') {
    const handleCheckNow = async () => {
      setCheckingStatus(true);
      await refreshUser();
      setTimeout(() => setCheckingStatus(false), 600);
    };

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4">
        <div className="max-w-lg w-full bg-slate-900 border border-amber-500/30 rounded-2xl shadow-2xl p-6 sm:p-8 text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center mx-auto">
            <Clock className="w-8 h-8 text-amber-400 animate-pulse" />
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Pending Super Admin Approval
            </span>
            <h1 className="text-2xl font-black tracking-tight text-white">
              Waiting for Administrator Approval
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Your transporter account has been registered and is awaiting approval from the System Administrator. Once approved in the Super Admin Control Center, your billing dashboard will unlock automatically.
            </p>
          </div>

          <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 text-left space-y-2.5 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-400" /> Company Name
              </span>
              <span className="font-bold text-white">{user.companyName}</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-blue-400" /> Registered Email
              </span>
              <span className="font-medium text-slate-200">{user.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-blue-400" /> Mobile Number
              </span>
              <span className="font-mono text-slate-200">{user.mobile}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={handleCheckNow}
              disabled={checkingStatus}
              className="flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${checkingStatus ? 'animate-spin' : ''}`} />
              <span>{checkingStatus ? 'Checking Approval Status...' : 'Check Approval Status'}</span>
            </button>
            <button
              onClick={logout}
              className="py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Gate 2: Transporter Disabled / Suspended by Super Admin
  if (user.role !== 'admin' && (user.accountStatus === 'suspended' || user.accountStatus === 'deactivated')) {
    const handleCheckNow = async () => {
      setCheckingStatus(true);
      await refreshUser();
      setTimeout(() => setCheckingStatus(false), 600);
    };

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4">
        <div className="max-w-lg w-full bg-slate-900 border border-rose-500/30 rounded-2xl shadow-2xl p-6 sm:p-8 text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-400/30 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8 text-rose-400" />
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
              Account Access Disabled
            </span>
            <h1 className="text-2xl font-black tracking-tight text-white">
              Access Paused by Super Admin
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Your transporter portal access ({user.companyName}) is currently disabled by the System Administrator. Once the Super Admin re-enables your account, click below to continue using the system.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={handleCheckNow}
              disabled={checkingStatus}
              className="flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${checkingStatus ? 'animate-spin' : ''}`} />
              <span>{checkingStatus ? 'Checking Status...' : 'Check Status / Continue'}</span>
            </button>
            <button
              onClick={logout}
              className="py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isExpired = user.role !== 'admin' && user.subscription?.status === 'expired';

  // Navigation handlers for invoices
  const handleCreateNewInvoice = () => {
    setActiveInvoice(null);
    setInvoiceView('create');
  };

  const handleEditInvoice = (invoice: Invoice) => {
    setActiveInvoice(invoice);
    setInvoiceView('edit');
  };

  const handleViewPrintInvoice = (invoice: Invoice) => {
    setActiveInvoice(invoice);
    setInvoiceView('print');
  };

  const handleInvoiceSaveSuccess = (savedInvoice: Invoice) => {
    setActiveInvoice(savedInvoice);
    setInvoiceView('print');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={(tab) => {
          setCurrentTab(tab);
          if (tab === 'invoices') setInvoiceView('list');
        }}
        onOpenMobileMenu={() => setMobileMenuOpen(true)}
      />

      <div className="flex-1 flex">
        {/* Sidebar */}
        <Sidebar
          currentTab={currentTab}
          setCurrentTab={(tab) => {
            setCurrentTab(tab);
            if (tab === 'invoices') setInvoiceView('list');
          }}
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
        />

        {/* Main Content Area */}
        <main className="flex-1 md:pl-64 min-w-0 flex flex-col print:pl-0 print:p-0 print:m-0">
          {/* Subscription Expiry Warning Banner */}
          {isExpired && (
            <div className="print:hidden bg-rose-600 text-white px-4 py-2 text-xs sm:text-sm font-semibold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Your commercial subscription has expired. Please renew to continue dispatching invoices.</span>
              </div>
              <button
                onClick={() => setCurrentTab('subscription')}
                className="px-3 py-1 bg-white text-rose-700 rounded-md font-bold text-xs hover:bg-rose-50"
              >
                Renew Now
              </button>
            </div>
          )}

          <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto print:p-0 print:m-0 print:max-w-none print:w-full">
            {/* View Switching */}
            {currentTab === 'invoices' && (
              <>
                {invoiceView === 'list' && (
                  <InvoiceList
                    onCreateNew={handleCreateNewInvoice}
                    onViewPrint={handleViewPrintInvoice}
                    onEdit={handleEditInvoice}
                  />
                )}
                {(invoiceView === 'create' || invoiceView === 'edit') && (
                  <InvoiceForm
                    initialInvoice={activeInvoice}
                    onSaveSuccess={handleInvoiceSaveSuccess}
                    onCancel={() => setInvoiceView('list')}
                  />
                )}
                {invoiceView === 'print' && activeInvoice && (
                  <InvoicePrintView
                    invoice={activeInvoice}
                    onBack={() => setInvoiceView('list')}
                    onEdit={handleEditInvoice}
                  />
                )}
              </>
            )}

            {currentTab === 'freight-rates' && <FreightRateManager />}
            {currentTab === 'customers' && <CustomerManager />}
            {currentTab === 'vehicles' && <VehicleManager />}
            {currentTab === 'analytics' && <AnalyticsDashboard />}
            {currentTab === 'profile' && <CompanyProfile />}
            {currentTab === 'subscription' && <SubscriptionPage />}
            {currentTab === 'admin' && <SuperAdminPanel />}
          </div>
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainAppContent />
    </AuthProvider>
  );
}
