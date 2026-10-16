import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { formatCurrencyPKR } from '../../utils/billing-calculations';
import {
  CreditCard,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Building,
  Clock,
  Send,
  ShieldCheck,
  Zap,
} from 'lucide-react';

export const SubscriptionPage: React.FC = () => {
  const { user, token, refreshUser } = useAuth();
  const [pricing, setPricing] = useState<any>(null);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [paymentReference, setPaymentReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    const loadPricing = async () => {
      try {
        const res = await fetch('/api/admin/pricing', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setPricing(data.pricing);
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadPricing();
  }, [token]);

  const sub = user?.subscription;

  const handleRequestRenewal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentReference.trim()) {
      alert('Please enter your Bank Deposit Slip Number or Transaction Reference.');
      return;
    }

    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/subscription/request-renewal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          plan: selectedPlan,
          paymentReference: paymentReference.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message || 'Renewal request submitted to Super Admin.');
        setPaymentReference('');
        await refreshUser();
      } else {
        alert(data.error || 'Failed to submit request.');
      }
    } catch (err: any) {
      alert(err.message || 'Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const monthlyPrice = pricing?.monthlyPrice ?? 5000;
  const yearlyPrice = pricing?.yearlyPrice ?? 50000;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Software Subscription & Licensing</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Commercial license management for Fleet Bill 3.0. Secure offline bank transfer and manual verification.
        </p>
      </div>

      {message && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Current Subscription Status Badge */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Current Account Tier</span>
            <div className="flex items-center gap-2 mt-1">
              <h2 className="text-xl font-bold text-slate-900 capitalize">
                {sub?.plan || 'Standard'} Plan
              </h2>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                  sub?.status === 'active'
                    ? 'bg-emerald-100 text-emerald-800'
                    : sub?.status === 'pending_approval'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {sub?.status === 'active'
                  ? 'Active License'
                  : sub?.status === 'pending_approval'
                  ? 'Verification Pending'
                  : 'License Expired'}
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs font-medium text-slate-400 block">License Expiry Date</span>
            <span className="text-sm font-bold font-mono text-slate-900">
              {sub?.expiryDate || 'N/A'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-600">
          <div className="p-3 bg-slate-50 rounded-lg">
            <span className="text-slate-400 block mb-0.5">Subscribed Company</span>
            <span className="font-semibold text-slate-800">{user?.companyName}</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg">
            <span className="text-slate-400 block mb-0.5">Approved By</span>
            <span className="font-semibold text-slate-800">{sub?.approvedBy || 'Super Administrator'}</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg">
            <span className="text-slate-400 block mb-0.5">Last Payment Reference</span>
            <span className="font-mono font-semibold text-slate-800">{sub?.paymentReference || 'N/A'}</span>
          </div>
        </div>
      </div>

      {/* Subscription Plans Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Monthly Plan */}
        <div
          onClick={() => setSelectedPlan('monthly')}
          className={`p-6 rounded-2xl border-2 cursor-pointer transition-all ${
            selectedPlan === 'monthly'
              ? 'border-blue-600 bg-blue-50/20 shadow-md ring-2 ring-blue-600/10'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Flexible</span>
              <h3 className="text-lg font-bold text-slate-900 mt-1">Monthly Subscription</h3>
            </div>
            <input
              type="radio"
              checked={selectedPlan === 'monthly'}
              onChange={() => setSelectedPlan('monthly')}
              className="w-4 h-4 text-blue-600"
            />
          </div>

          <div className="mt-4 mb-4">
            <span className="text-3xl font-black text-slate-900">Rs. {formatCurrencyPKR(monthlyPrice)}</span>
            <span className="text-xs text-slate-500 font-medium"> / month</span>
          </div>

          <ul className="space-y-2 text-xs text-slate-600">
            <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Unlimited trip invoices</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Freight rates matching engine</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Excel export & print sheets</li>
          </ul>
        </div>

        {/* Yearly Plan (Best Value) */}
        <div
          onClick={() => setSelectedPlan('yearly')}
          className={`p-6 rounded-2xl border-2 cursor-pointer transition-all relative overflow-hidden ${
            selectedPlan === 'yearly'
              ? 'border-blue-600 bg-blue-50/20 shadow-md ring-2 ring-blue-600/10'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="absolute top-3 right-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full shadow-xs">
            Save 17% (2 Months Free)
          </div>

          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Best Value for Transporters</span>
              <h3 className="text-lg font-bold text-slate-900 mt-1">Yearly Commercial License</h3>
            </div>
            <input
              type="radio"
              checked={selectedPlan === 'yearly'}
              onChange={() => setSelectedPlan('yearly')}
              className="w-4 h-4 text-blue-600"
            />
          </div>

          <div className="mt-4 mb-4">
            <span className="text-3xl font-black text-slate-900">Rs. {formatCurrencyPKR(yearlyPrice)}</span>
            <span className="text-xs text-slate-500 font-medium"> / year</span>
          </div>

          <ul className="space-y-2 text-xs text-slate-600">
            <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> All Monthly features included</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Priority WhatsApp & phone support</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Unlimited customer profiles & vehicles</li>
          </ul>
        </div>
      </div>

      {/* Payment & Slip Submission Form */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-2 flex items-center gap-2">
          <Building className="w-4 h-4 text-blue-600" />
          Official Bank Details for Subscription Payment
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl text-xs text-slate-700">
          <div>
            <span className="text-slate-400 block font-semibold">Bank Name:</span>
            <span className="font-bold text-slate-900">{pricing?.bankDetails?.bankName || 'Meezan Bank Ltd'}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-semibold">Account Title:</span>
            <span className="font-bold text-slate-900">{pricing?.bankDetails?.accountTitle || 'Fleet Bill Technologies'}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-semibold">Account Number:</span>
            <span className="font-mono font-bold text-slate-900">{pricing?.bankDetails?.accountNumber || '02010108765432'}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-semibold">IBAN:</span>
            <span className="font-mono font-bold text-slate-900">{pricing?.bankDetails?.iban || 'PK64MEZN0002010108765432'}</span>
          </div>
          <div className="sm:col-span-2 pt-2 border-t border-slate-200 text-slate-500 text-[11px]">
            WhatsApp Slip Submission: <span className="font-bold text-slate-800">{pricing?.bankDetails?.supportContact || '0301 6411664'}</span>
          </div>
        </div>

        <form onSubmit={handleRequestRenewal} className="pt-2 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Deposit Slip / Online Transfer Reference (e.g. MEZN-TX-99823 or HBL Deposit ID)
            </label>
            <input
              type="text"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              placeholder="Enter transfer transaction ID or slip #"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
              required
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 disabled:opacity-50 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              {submitting ? 'Submitting Reference...' : `Submit Payment for ${selectedPlan.toUpperCase()} Plan`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
