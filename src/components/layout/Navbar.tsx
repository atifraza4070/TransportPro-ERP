import React from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Truck,
  ShieldCheck,
  CreditCard,
  LogOut,
  Building2,
  Calendar,
  AlertCircle,
} from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenMobileMenu: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, setCurrentTab, onOpenMobileMenu }) => {
  const { user, logout, isSuperAdmin } = useAuth();

  const getSubBadge = () => {
    if (!user || user.role === 'admin') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
          <ShieldCheck className="w-3.5 h-3.5" />
          HQ Super Administrator
        </span>
      );
    }

    const sub = user.subscription;
    if (sub.status === 'active') {
      return (
        <button
          onClick={() => setCurrentTab('subscription')}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-200 border border-blue-400/30 hover:bg-blue-500/30 transition-colors"
        >
          <CreditCard className="w-3.5 h-3.5 text-blue-400" />
          <span className="capitalize">{sub.plan} Plan Active</span>
          <span className="text-blue-300/70 font-normal">({sub.expiryDate})</span>
        </button>
      );
    }

    if (sub.status === 'pending_approval') {
      return (
        <button
          onClick={() => setCurrentTab('subscription')}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-400/30 hover:bg-amber-500/30 transition-colors"
        >
          <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
          Payment Pending Verification
        </button>
      );
    }

    return (
      <button
        onClick={() => setCurrentTab('subscription')}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-400/30 hover:bg-rose-500/30 transition-colors animate-pulse"
      >
        <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
        Subscription Expired - Renew Now
      </button>
    );
  };

  return (
    <header className="print:hidden sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Mobile hamburger & Logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenMobileMenu}
            className="md:hidden p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg focus:outline-none"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div
            onClick={() => setCurrentTab('invoices')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 via-blue-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-blue-200 bg-clip-text text-transparent">
                  Fleet Bill
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-500/30 text-blue-300 border border-blue-400/30">
                  3.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">Transport Billing & Freight Engine</p>
            </div>
          </div>
        </div>

        {/* Center: Subscription Status */}
        <div className="hidden md:flex items-center gap-2">
          {getSubBadge()}
        </div>

        {/* Right: Company Profile & Controls */}
        <div className="flex items-center gap-3">
          {user && (
            <div className="flex items-center gap-3 pl-3 border-l border-slate-800">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-semibold text-slate-200 truncate max-w-[190px]">
                  {user.companyName || user.fullName}
                </div>
                <div className="text-[11px] text-slate-400 flex items-center justify-end gap-1">
                  <span>NTN: {user.ntn || 'Not Set'}</span>
                </div>
              </div>

              {user.logoUrl ? (
                <img
                  src={user.logoUrl}
                  alt={user.companyName}
                  className="w-9 h-9 rounded-lg object-contain bg-white border border-slate-700 p-0.5"
                />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-blue-600/30 border border-blue-500/30 flex items-center justify-center text-blue-300 font-bold text-sm">
                  {user.companyName ? user.companyName.charAt(0).toUpperCase() : 'F'}
                </div>
              )}

              <button
                onClick={logout}
                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                title="Sign Out"
                aria-label="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
