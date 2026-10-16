import React, { useState, useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';
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
import { AlertTriangle, CreditCard } from 'lucide-react';

const MainAppContent: React.FC = () => {
  const { user, loading, isSuperAdmin } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('invoices');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (isSuperAdmin && currentTab === 'invoices') {
      setCurrentTab('admin');
    }
  }, [isSuperAdmin]);

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
      <Analytics />
    </AuthProvider>
  );
}
