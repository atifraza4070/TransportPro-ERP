import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { formatCurrencyPKR } from '../../utils/billing-calculations';
import {
  ShieldAlert,
  Users,
  DollarSign,
  History,
  CheckCircle2,
  AlertTriangle,
  Search,
  Lock,
  Trash2,
  Check,
  Ban,
  Clock,
  Building,
  RefreshCw,
  Save,
  Download,
  Mail,
  Send,
} from 'lucide-react';

export const SuperAdminPanel: React.FC = () => {
  const { token, isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'transporters' | 'pricing' | 'smtp' | 'audit'>('transporters');
  const [transporters, setTransporters] = useState<any[]>([]);
  const [pricing, setPricing] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals
  const [selectedTransporter, setSelectedTransporter] = useState<any | null>(null);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [renewPlan, setRenewPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [renewMonths, setRenewMonths] = useState(12);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteCascade, setDeleteCascade] = useState(true);

  // Pricing Form
  const [monthlyPriceInput, setMonthlyPriceInput] = useState(5000);
  const [yearlyPriceInput, setYearlyPriceInput] = useState(50000);
  const [bankNameInput, setBankNameInput] = useState('');
  const [accountTitleInput, setAccountTitleInput] = useState('');
  const [accountNumberInput, setAccountNumberInput] = useState('');
  const [ibanInput, setIbanInput] = useState('');
  const [supportContactInput, setSupportContactInput] = useState('');

  // SMTP Settings State
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState(465);
  const [smtpFromName, setSmtpFromName] = useState('Fleet Bill 3.0');
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [smtpFeedback, setSmtpFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [testEmailRecipient, setTestEmailRecipient] = useState('');

  const fetchAdminData = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [transRes, priceRes, logsRes, smtpRes] = await Promise.all([
        fetch('/api/admin/transporters', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/pricing', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/audit-logs', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/smtp', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (transRes.ok) {
        const data = await transRes.json();
        setTransporters(data.transporters || []);
      }
      if (priceRes.ok) {
        const data = await priceRes.json();
        setPricing(data.pricing);
        setMonthlyPriceInput(data.pricing.monthlyPrice);
        setYearlyPriceInput(data.pricing.yearlyPrice);
        setBankNameInput(data.pricing.bankDetails?.bankName || '');
        setAccountTitleInput(data.pricing.bankDetails?.accountTitle || '');
        setAccountNumberInput(data.pricing.bankDetails?.accountNumber || '');
        setIbanInput(data.pricing.bankDetails?.iban || '');
        setSupportContactInput(data.pricing.bankDetails?.supportContact || '');
      }
      if (logsRes.ok) {
        const data = await logsRes.json();
        setAuditLogs(data.logs || []);
      }
      if (smtpRes.ok) {
        const data = await smtpRes.json();
        if (data.smtp) {
          setSmtpUser(data.smtp.user || '');
          setSmtpHost(data.smtp.host || 'smtp.gmail.com');
          setSmtpPort(data.smtp.port || 465);
          setSmtpFromName(data.smtp.fromName || 'Fleet Bill 3.0');
          setSmtpConfigured(Boolean(data.smtp.isConfigured));
        }
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSmtpSaving(true);
    setSmtpFeedback(null);
    try {
      const res = await fetch('/api/admin/smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          user: smtpUser,
          pass: smtpPass,
          host: smtpHost,
          port: smtpPort,
          fromName: smtpFromName,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSmtpConfigured(data.smtp.isConfigured);
        setSmtpFeedback({ type: 'success', message: 'SMTP settings updated successfully!' });
      } else {
        setSmtpFeedback({ type: 'error', message: data.error || 'Failed to save SMTP settings.' });
      }
    } catch {
      setSmtpFeedback({ type: 'error', message: 'Network error saving SMTP configuration.' });
    } finally {
      setSmtpSaving(false);
    }
  };

  const handleTestSmtp = async () => {
    setSmtpTesting(true);
    setSmtpFeedback(null);
    try {
      const res = await fetch('/api/admin/smtp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ testEmail: testEmailRecipient }),
      });
      const data = await res.json();
      if (res.ok) {
        setSmtpFeedback({ type: 'success', message: data.message || 'Test email dispatched successfully!' });
      } else {
        setSmtpFeedback({ type: 'error', message: data.error || 'Failed to dispatch test email.' });
      }
    } catch {
      setSmtpFeedback({ type: 'error', message: 'Network error testing SMTP service.' });
    } finally {
      setSmtpTesting(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      fetchAdminData();
    }
  }, [token, isSuperAdmin]);

  if (!isSuperAdmin) {
    return (
      <div className="p-8 text-center text-rose-600 bg-rose-50 rounded-xl border border-rose-200">
        <ShieldAlert className="w-10 h-10 mx-auto mb-2" />
        <h2 className="text-lg font-bold">Access Denied</h2>
        <p className="text-sm">Only the privately configured Super Administrator can access this panel.</p>
      </div>
    );
  }

  // Handle Account Status (activate, suspend, deactivate)
  const handleUpdateStatus = async (transporterId: string, status: string) => {
    try {
      const res = await fetch(`/api/admin/transporters/${transporterId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        fetchAdminData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Approve / Renew Subscription
  const handleApproveSubscription = async () => {
    if (!selectedTransporter) return;
    try {
      const res = await fetch(`/api/admin/transporters/${selectedTransporter.id}/subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          plan: renewPlan,
          status: 'active',
          durationMonths: renewMonths,
        }),
      });
      if (res.ok) {
        setShowRenewModal(false);
        setSelectedTransporter(null);
        fetchAdminData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Delete Transporter
  const handleDeleteTransporter = async () => {
    if (!selectedTransporter) return;
    try {
      const res = await fetch(`/api/admin/transporters/${selectedTransporter.id}?deleteData=${deleteCascade}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setShowDeleteModal(false);
        setSelectedTransporter(null);
        fetchAdminData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Save Pricing
  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/pricing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          monthlyPrice: Number(monthlyPriceInput),
          yearlyPrice: Number(yearlyPriceInput),
          bankDetails: {
            bankName: bankNameInput,
            accountTitle: accountTitleInput,
            accountNumber: accountNumberInput,
            iban: ibanInput,
            supportContact: supportContactInput,
          },
        }),
      });
      if (res.ok) {
        alert('Subscription pricing and payment details updated successfully!');
        fetchAdminData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredTransporters = transporters.filter(
    (t) =>
      t.companyName?.toLowerCase().includes(search.toLowerCase()) ||
      t.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      t.email?.toLowerCase().includes(search.toLowerCase()) ||
      t.mobile?.includes(search)
  );

  return (
    <div className="space-y-6">
      {/* Super Admin Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-6 rounded-2xl border border-blue-900/50 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-red-600 text-white tracking-wider">
              Protected Admin Authority
            </span>
            <span className="text-xs text-blue-300 font-mono">Privately Configured</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight mt-1">Super Admin Control Center</h1>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            Commercial master administration of Fleet Bill 3.0. Manage subscribed transporters, activate or suspend access, approve manual bank payments, and configure subscription pricing.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchAdminData}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('transporters')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'transporters'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          Transporters Directory ({transporters.length})
        </button>

        <button
          onClick={() => setActiveTab('pricing')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'pricing'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          Subscription Pricing & Bank Config
        </button>

        <button
          onClick={() => setActiveTab('smtp')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'smtp'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Mail className="w-4 h-4" />
          Email & SMTP Gateway {smtpConfigured ? '(Active)' : '(Simulated)'}
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'audit'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <History className="w-4 h-4" />
          Platform Audit Logs ({auditLogs.length})
        </button>
      </div>

      {/* TAB 1: Transporters Directory */}
      {activeTab === 'transporters' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search transporter by company, name, email, or mobile..."
                className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs"
              />
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Showing {filteredTransporters.length} accounts
            </span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Company & Owner</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Account Status</th>
                    <th className="px-4 py-3">Subscription</th>
                    <th className="px-4 py-3">Expiry Date</th>
                    <th className="px-4 py-3 text-center">Invoices</th>
                    <th className="px-4 py-3 text-right">Admin Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredTransporters.map((t) => {
                    const isSuper = t.role === 'admin';
                    const sub = t.subscription;
                    return (
                      <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{t.companyName || t.fullName}</div>
                          <div className="text-[11px] text-slate-500">{t.fullName}</div>
                          {isSuper && (
                            <span className="inline-block mt-0.5 px-1.5 py-0.2 text-[9px] font-bold rounded bg-purple-100 text-purple-800 uppercase">
                              Super Admin
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          <div>{t.email}</div>
                          <div className="font-mono text-[11px] text-slate-500">{t.mobile}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold capitalize ${
                              t.accountStatus === 'active'
                                ? 'bg-emerald-100 text-emerald-800'
                                : t.accountStatus === 'suspended'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {t.accountStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900 capitalize">{sub?.plan} Plan</div>
                          <span
                            className={`text-[10px] font-semibold ${
                              sub?.status === 'active'
                                ? 'text-emerald-600'
                                : sub?.status === 'pending_approval'
                                ? 'text-amber-600 font-bold'
                                : 'text-rose-600'
                            }`}
                          >
                            {sub?.status === 'pending_approval' ? 'Pending Approval' : sub?.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono font-medium text-slate-700">
                          {sub?.expiryDate || 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-semibold text-[11px]">
                            {t.invoiceCount || 0}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {!isSuper && (
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Subscription approve / renew button */}
                              <button
                                onClick={() => {
                                  setSelectedTransporter(t);
                                  setShowRenewModal(true);
                                }}
                                className="px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                                title="Approve Payment or Extend License"
                              >
                                Renew / Approve
                              </button>

                              {/* Toggle active / suspend */}
                              {t.accountStatus === 'active' ? (
                                <button
                                  onClick={() => handleUpdateStatus(t.id, 'suspended')}
                                  className="px-2 py-1 text-[11px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-md transition-colors"
                                  title="Suspend Transporter"
                                >
                                  Suspend
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleUpdateStatus(t.id, 'active')}
                                  className="px-2 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors"
                                  title="Activate Account"
                                >
                                  Activate
                                </button>
                              )}

                              {/* Delete account */}
                              <button
                                onClick={() => {
                                  setSelectedTransporter(t);
                                  setShowDeleteModal(true);
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded"
                                title="Delete Transporter Account"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Subscription Pricing & Bank Config */}
      {activeTab === 'pricing' && (
        <form onSubmit={handleSavePricing} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm max-w-2xl space-y-6">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
            Commercial Subscription Rates for Transporters
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Monthly Subscription Fee (PKR)</label>
              <input
                type="number"
                value={monthlyPriceInput}
                onChange={(e) => setMonthlyPriceInput(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold font-mono text-slate-900 text-sm"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Yearly Subscription Fee (PKR)</label>
              <input
                type="number"
                value={yearlyPriceInput}
                onChange={(e) => setYearlyPriceInput(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold font-mono text-slate-900 text-sm"
                required
              />
            </div>
          </div>

          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 pt-2">
            Bank Account Details Shown on Transporter Payment Screens
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Bank Name</label>
              <input
                type="text"
                value={bankNameInput}
                onChange={(e) => setBankNameInput(e.target.value)}
                placeholder="Meezan Bank Ltd"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Account Title</label>
              <input
                type="text"
                value={accountTitleInput}
                onChange={(e) => setAccountTitleInput(e.target.value)}
                placeholder="Fleet Bill Technologies"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Account Number</label>
              <input
                type="text"
                value={accountNumberInput}
                onChange={(e) => setAccountNumberInput(e.target.value)}
                placeholder="02010108765432"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">IBAN Number</label>
              <input
                type="text"
                value={ibanInput}
                onChange={(e) => setIbanInput(e.target.value)}
                placeholder="PK64MEZN0002010108765432"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">WhatsApp & Support Contact for Slips</label>
              <input
                type="text"
                value={supportContactInput}
                onChange={(e) => setSupportContactInput(e.target.value)}
                placeholder="0301 6411664"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                required
              />
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-100">
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20"
            >
              <Save className="w-3.5 h-3.5" />
              Save Pricing & Bank Settings
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: Audit Logs */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">Enterprise System Audit Trail</h3>
            <span className="text-xs text-slate-500">Immutable security events</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">Timestamp</th>
                  <th className="px-4 py-2.5">User Email</th>
                  <th className="px-4 py-2.5">Action</th>
                  <th className="px-4 py-2.5">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 font-bold text-slate-800">{log.userEmail}</td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-semibold text-[10px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 font-sans">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: SMTP Gateway Settings */}
      {activeTab === 'smtp' && (
        <div className="space-y-6">
          <form onSubmit={handleSaveSmtp} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Mail className="w-5 h-5 text-blue-600" />
                  Email & SMTP Server Gateway
                </h3>
                <p className="text-slate-500 mt-0.5">
                  Connect your Gmail or corporate SMTP account to send invoice PDFs, OTP verification codes, and password resets directly to recipient mailboxes.
                </p>
              </div>

              <div>
                {smtpConfigured ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Live SMTP Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Simulation Mode (No SMTP configured)
                  </span>
                )}
              </div>
            </div>

            {/* Google / Gmail Setup Instructions Banner */}
            <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2 text-slate-700">
              <h4 className="font-bold text-blue-950 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
                How to set up Gmail / Google Workspace (Recommended):
              </h4>
              <ol className="list-decimal pl-5 space-y-1 text-slate-600">
                <li>Log in to your Google Account at <strong>myaccount.google.com</strong> and turn on <strong>2-Step Verification</strong>.</li>
                <li>Go to <strong>Security → 2-Step Verification → App passwords</strong> (or search "App Passwords").</li>
                <li>Create an App password named <strong>Fleet Bill</strong>. Google will generate a 16-character code (e.g., <code className="bg-white px-1.5 py-0.5 rounded border border-blue-200 font-mono text-blue-900">abcd efgh ijkl mnop</code>).</li>
                <li>Enter your Gmail address below, paste the 16-character password, and click <strong>Save SMTP Configuration</strong>.</li>
              </ol>
            </div>

            {smtpFeedback && (
              <div
                className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 font-medium border ${
                  smtpFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                {smtpFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{smtpFeedback.message}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Sender Email / SMTP Username <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  placeholder="e.g. atifraza4070@gmail.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  SMTP Password / Google App Password
                </label>
                <input
                  type="password"
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                  placeholder={smtpConfigured ? '•••••••••••••••• (Leave blank to keep existing)' : 'Enter 16-character App Password'}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">SMTP Host</label>
                <input
                  type="text"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  placeholder="smtp.gmail.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">SMTP Port</label>
                <input
                  type="number"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(Number(e.target.value))}
                  placeholder="465"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">From Display Name</label>
                <input
                  type="text"
                  value={smtpFromName}
                  onChange={(e) => setSmtpFromName(e.target.value)}
                  placeholder="Fleet Bill 3.0"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="submit"
                disabled={smtpSaving}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{smtpSaving ? 'Saving...' : 'Save SMTP Configuration'}</span>
              </button>
            </div>
          </form>

          {/* Test Dispatch Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-xs">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Send className="w-4 h-4 text-blue-600" />
              Dispatch Test Email
            </h4>
            <p className="text-slate-500">
              Send a test verification message to ensure your SMTP connection and recipient delivery are working before sending client invoices.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 max-w-lg">
              <input
                type="email"
                value={testEmailRecipient}
                onChange={(e) => setTestEmailRecipient(e.target.value)}
                placeholder="Recipient email (e.g. atifraza4070@gmail.com)"
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={handleTestSmtp}
                disabled={smtpTesting}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg disabled:opacity-50 transition-colors shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{smtpTesting ? 'Sending...' : 'Send Test'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Renew / Approve Subscription */}
      {showRenewModal && selectedTransporter && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4 text-xs">
            <h3 className="text-base font-bold text-slate-900">
              Approve & Extend Subscription
            </h3>
            <p className="text-slate-600">
              Company: <strong className="text-slate-900">{selectedTransporter.companyName}</strong>
            </p>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1 text-blue-900">
              <p>Submitted Payment Ref: <strong>{selectedTransporter.subscription?.paymentReference || 'None'}</strong></p>
              <p>Date: {selectedTransporter.subscription?.paymentDate || 'Today'}</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Plan Tier</label>
                <select
                  value={renewPlan}
                  onChange={(e) => {
                    const p = e.target.value as any;
                    setRenewPlan(p);
                    setRenewMonths(p === 'yearly' ? 12 : 1);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
                >
                  <option value="monthly">Monthly License</option>
                  <option value="yearly">Yearly Commercial License (12 Months)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Duration (Months to Add)</label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={renewMonths}
                  onChange={(e) => setRenewMonths(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => {
                  setShowRenewModal(false);
                  setSelectedTransporter(null);
                }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApproveSubscription}
                className="px-4 py-2 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 shadow-xs"
              >
                Verify & Activate License
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Delete Transporter with Data Cascade Warning */}
      {showDeleteModal && selectedTransporter && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-rose-200 space-y-4 text-xs">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-slate-900">
                Confirm Transporter Account Deletion
              </h3>
            </div>

            <p className="text-slate-600 leading-relaxed">
              You are about to delete the transporter account for{' '}
              <strong className="text-slate-900">{selectedTransporter.companyName}</strong> ({selectedTransporter.email}).
            </p>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-amber-900">
              <p className="font-bold flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-600" /> Safer Alternative: Deactivation
              </p>
              <p className="text-[11px] text-amber-800">
                You can suspend or deactivate the account instead of deleting it, which prevents login while preserving historical invoices and tax records for legal audits.
              </p>
            </div>

            <div className="space-y-2 pt-1">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deleteCascade}
                  onChange={(e) => setDeleteCascade(e.target.checked)}
                  className="mt-0.5 rounded text-rose-600"
                />
                <span className="text-slate-700">
                  Permanently delete all invoices ({selectedTransporter.invoiceCount || 0}), vehicles, and customer freight rates associated with this transporter.
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedTransporter(null);
                }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteTransporter}
                className="px-4 py-2 bg-rose-600 text-white font-semibold rounded-lg hover:bg-rose-700 shadow-xs"
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
