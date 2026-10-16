import React from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  FileText,
  DollarSign,
  Users,
  Truck,
  BarChart3,
  Building,
  CreditCard,
  ShieldAlert,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, setCurrentTab, isOpen, onClose }) => {
  const { user, isSuperAdmin } = useAuth();

  const navigation = [
    { id: 'invoices', label: 'Invoices & Billing', icon: FileText, badge: null },
    { id: 'freight-rates', label: 'Freight Rates', icon: DollarSign, badge: 'Template' },
    { id: 'customers', label: 'Customers & NTN', icon: Users, badge: null },
    { id: 'vehicles', label: 'Fleet & Vehicles', icon: Truck, badge: null },
    { id: 'analytics', label: 'Analytics & Trends', icon: BarChart3, badge: null },
    { id: 'profile', label: 'Company Profile & Logo', icon: Building, badge: null },
    { id: 'subscription', label: 'Subscription & Plans', icon: CreditCard, badge: null },
  ];

  if (isSuperAdmin) {
    navigation.push({
      id: 'admin',
      label: 'Super Admin HQ',
      icon: ShieldAlert,
      badge: 'Protected',
    });
  }

  const handleSelect = (id: string) => {
    setCurrentTab(id);
    onClose();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`print:hidden fixed top-16 bottom-0 left-0 z-40 w-64 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-200 ease-in-out md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Main Management
          </div>

          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                      isActive
                        ? 'bg-blue-700 text-blue-100'
                        : 'bg-slate-800 text-blue-400 border border-blue-500/20'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Transporter Company Footer Widget */}
        {user && (
          <div className="p-4 border-t border-slate-800 bg-slate-950/40">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-900/60 border border-blue-700/50 flex items-center justify-center text-blue-300 text-xs font-bold">
                {user.companyName?.substring(0, 2).toUpperCase() || 'FB'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-200 truncate">{user.companyName}</p>
                <p className="text-[11px] text-slate-400 truncate">{user.city || 'Pakistan'}</p>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};
