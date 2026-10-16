import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Building2,
  Save,
  Upload,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Phone,
  Mail,
  MapPin,
  Lock,
  Key,
  Eye,
  EyeOff,
  Shield,
} from 'lucide-react';

export const CompanyProfile: React.FC = () => {
  const { user, updateProfile, uploadLogo } = useAuth();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [companyName, setCompanyName] = useState(user?.companyName || '');
  const [address, setAddress] = useState(user?.address || '');
  const [city, setCity] = useState(user?.city || '');
  const [phone, setPhone] = useState(user?.phone || user?.mobile || '');
  const [mobile, setMobile] = useState(user?.mobile || '');
  const [ntn, setNtn] = useState(user?.ntn || '');
  const [strn, setStrn] = useState(user?.strn || '');

  // Billing settings
  const [defaultTaxRate, setDefaultTaxRate] = useState(user?.settings?.defaultTaxRate ?? 15);
  const [defaultTaxName, setDefaultTaxName] = useState(user?.settings?.defaultTaxName || 'Punjab 15% Tex');
  const [invoicePrefix, setInvoicePrefix] = useState(user?.settings?.invoicePrefix || 'IK-BSP-26-');

  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Password change states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Logo file upload handler
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Logo file size must be under 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      const success = await uploadLogo(base64);
      if (success) {
        setStatusMessage({ type: 'success', text: 'Company logo uploaded and updated successfully!' });
      } else {
        setStatusMessage({ type: 'error', text: 'Failed to update company logo.' });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = async () => {
    if (!confirm('Remove company logo?')) return;
    const success = await uploadLogo('');
    if (success) {
      setStatusMessage({ type: 'success', text: 'Company logo removed.' });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage(null);

    const success = await updateProfile({
      fullName,
      companyName,
      address,
      city,
      phone,
      mobile,
      ntn,
      strn,
      settings: {
        defaultTaxRate,
        defaultTaxName,
        invoicePrefix,
        currency: 'PKR',
      },
    });

    if (success) {
      setStatusMessage({ type: 'success', text: 'Company profile and default invoice settings saved successfully!' });
    } else {
      setStatusMessage({ type: 'error', text: 'Failed to update company profile.' });
    }
    setSaving(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordStatus(null);

    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: 'error', text: 'New password and confirm password do not match.' });
      return;
    }

    if (newPassword.length < 6) {
      setPasswordStatus({ type: 'error', text: 'New password must be at least 6 characters long.' });
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordStatus({ type: 'error', text: 'New password must be different from current password.' });
      return;
    }

    setPasswordSaving(true);
    try {
      const token = localStorage.getItem('fleetbill_token');
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setPasswordStatus({ type: 'success', text: 'Password updated successfully! Please use your new password next time you sign in.' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordStatus({ type: 'error', text: data.error || 'Failed to update password. Please check your current password.' });
      }
    } catch {
      setPasswordStatus({ type: 'error', text: 'Network error updating password. Please try again.' });
    } finally {
      setPasswordSaving(false);
    }
  };


  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Transporter Company Profile</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Configure your registered transport company credentials, tax numbers (NTN, STRN), and official document logo.
        </p>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-xl text-sm flex items-center gap-3 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Logo Manager Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-2">
          Official Company Logo
        </h3>

        <div className="flex flex-wrap items-center gap-6">
          <div className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center p-2 bg-slate-50 overflow-hidden shrink-0">
            {user?.logoUrl ? (
              <img src={user.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
            ) : (
              <Building2 className="w-8 h-8 text-slate-400" />
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs text-slate-600 font-medium">
              Logo will be printed directly at the top header of all invoices and PDF billing sheets.
            </p>
            <p className="text-[11px] text-slate-400">Accepted formats: PNG, JPG, WebP (Max 2MB)</p>

            <div className="flex items-center gap-3 pt-1">
              <label className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5" />
                Upload New Logo
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              </label>

              {user?.logoUrl && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove Logo
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Profile Form */}
      <form onSubmit={handleSave} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
        <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-2">
          Transporter Legal Identity & Contact Details
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Company Registered Name</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="IK LOGISTICS (SMC) PVT LTD"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-900 uppercase"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Authorized Contact Person</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Imran Khan"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium text-slate-900"
              required
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block font-semibold text-slate-700 mb-1">Registered Yard / Business Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="BSP GATE NO.1, 10KM KRK ROAD KASUR"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">City / Region</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Kasur / Lahore"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Dispatch Phone / Mobile</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0301 6411664"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Federal NTN Number</label>
            <input
              type="text"
              value={ntn}
              onChange={(e) => setNtn(e.target.value)}
              placeholder="J-622143"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-blue-700 uppercase"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Sales Tax STRN Number</label>
            <input
              type="text"
              value={strn}
              onChange={(e) => setStrn(e.target.value)}
              placeholder="1700300067314"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-blue-700 uppercase"
            />
          </div>
        </div>

        <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-2 pt-2">
          Default Billing & Tax Settings
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Default Sales Tax Rate (%)</label>
            <input
              type="number"
              value={defaultTaxRate}
              onChange={(e) => setDefaultTaxRate(Number(e.target.value))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Sales Tax Label</label>
            <input
              type="text"
              value={defaultTaxName}
              onChange={(e) => setDefaultTaxName(e.target.value)}
              placeholder="Total Punjab 15% Tex"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Invoice Number Prefix</label>
            <input
              type="text"
              value={invoicePrefix}
              onChange={(e) => setInvoicePrefix(e.target.value)}
              placeholder="IK-BSP-26-"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
            />
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-100">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving Changes...' : 'Save Profile Settings'}
          </button>
        </div>
      </form>

      {/* Account Security & Password Change Section */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
              <Shield className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base">Account Security & Password</h2>
              <p className="text-xs text-slate-500">Update your account login password to keep your transport records secure.</p>
            </div>
          </div>
        </div>

        {passwordStatus && (
          <div
            className={`p-4 rounded-xl text-xs flex items-center gap-3 ${
              passwordStatus.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border border-rose-200 text-rose-800'
            }`}
          >
            {passwordStatus.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{passwordStatus.text}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrentPass ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full pl-3 pr-8 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPass(!showCurrentPass)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showCurrentPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">New Password</label>
              <div className="relative">
                <input
                  type={showNewPass ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full pl-3 pr-8 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass(!showNewPass)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showNewPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showConfirmPass ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="w-full pl-3 pr-8 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPass(!showConfirmPass)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showConfirmPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={passwordSaving || !currentPassword || !newPassword}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-sm disabled:opacity-50 transition-colors"
            >
              <Key className="w-4 h-4" />
              <span>{passwordSaving ? 'Verifying & Updating...' : 'Update Account Password'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

