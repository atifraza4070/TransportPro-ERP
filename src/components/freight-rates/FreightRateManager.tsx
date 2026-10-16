import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { CustomerFreightRate, CityFreightRate, DispatchFreightRate } from '../../types';
import { formatCurrencyPKR } from '../../utils/billing-calculations';
import {
  generateFreightRatesExcel,
  generateDispatchRatesExcel,
  generateDispatchRatesSampleTemplate,
  downloadExcelFile,
} from '../../utils/excel-generator';
import {
  parseFreightRateExcel,
  ExcelImportResult,
  ColumnMapping,
} from '../../utils/excel-importer';
import {
  DollarSign,
  Plus,
  Search,
  Building,
  MapPin,
  Trash2,
  Edit2,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  SlidersHorizontal,
  X,
  Upload,
  Download,
  FileText,
  Truck,
  Calendar,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';

export const FreightRateManager: React.FC = () => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<'dispatch' | 'customer' | 'city'>('dispatch');
  const [customerRates, setCustomerRates] = useState<CustomerFreightRate[]>([]);
  const [cityRates, setCityRates] = useState<CityFreightRate[]>([]);
  const [dispatchRates, setDispatchRates] = useState<DispatchFreightRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Optional Minimum Rate Threshold (Rs.)
  const [minRateThreshold, setMinRateThreshold] = useState<number>(() => {
    const saved = localStorage.getItem('fleetbill_min_freight_rate');
    return saved ? Number(saved) : 0;
  });
  const [showMinRateSettings, setShowMinRateSettings] = useState(false);
  const [tempMinRate, setTempMinRate] = useState(minRateThreshold > 0 ? String(minRateThreshold) : '');

  // ---------------- EXCEL IMPORT STATE ----------------
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [excelFileBuffer, setExcelFileBuffer] = useState<ArrayBuffer | null>(null);
  const [excelFileName, setExcelFileName] = useState('');
  const [excelResult, setExcelResult] = useState<ExcelImportResult | null>(null);
  const [customMapping, setCustomMapping] = useState<Partial<ColumnMapping>>({});
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importNotification, setImportNotification] = useState<{
    type: 'success' | 'error';
    message: string;
    details?: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ---------------- SINGLE DISPATCH RATE MODAL ----------------
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [dispatchForm, setDispatchForm] = useState({
    id: '',
    dispatchNo: '',
    freightOrderNo: '',
    loadingDate: '',
    vehicleNo: '',
    vehicleType: '20 Ft Vehicle',
    destination: '',
    freightRate: '',
  });

  // ---------------- CUSTOMER & CITY MODALS ----------------
  const [showCustModal, setShowCustModal] = useState(false);
  const [custConfirmLower, setCustConfirmLower] = useState(false);
  const [custForm, setCustForm] = useState({
    id: '',
    customerName: '',
    destination: '',
    rate20ft: '',
    rate40ft: '',
  });

  const [showCityModal, setShowCityModal] = useState(false);
  const [cityConfirmLower, setCityConfirmLower] = useState(false);
  const [cityForm, setCityForm] = useState({
    id: '',
    cityName: '',
    rate20ft: '',
    rate24ftModified: '',
    rate32ftModified: '',
    rate40ft: '',
  });

  const fetchRates = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [tariffRes, dispatchRes] = await Promise.all([
        fetch('/api/freight-rates', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/dispatch-freight-rates', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (tariffRes.ok) {
        const data = await tariffRes.json();
        setCustomerRates(data.customerRates || []);
        setCityRates(data.cityRates || []);
      }
      if (dispatchRes.ok) {
        const dData = await dispatchRes.json();
        setDispatchRates(dData.rates || []);
      }
    } catch (err) {
      console.error('Error fetching rates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRates();
  }, [token]);

  // ---------------- EXCEL FILE HANDLING ----------------
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelFileName(file.name);
    try {
      const buffer = await file.arrayBuffer();
      setExcelFileBuffer(buffer);
      const parsed = parseFreightRateExcel(buffer, file.name);
      setExcelResult(parsed);
      setCustomMapping(parsed.mapping);
    } catch (err: any) {
      console.error('Failed to parse excel file:', err);
      alert('Could not read Excel file. Please ensure it is a valid .xlsx, .xls, or .csv document.');
    }
  };

  const handleMappingFieldChange = (field: keyof ColumnMapping, selectedHeader: string) => {
    if (!excelFileBuffer) return;
    const newMapping = { ...customMapping, [field]: selectedHeader };
    setCustomMapping(newMapping);
    const reParsed = parseFreightRateExcel(excelFileBuffer, excelFileName, newMapping, excelResult?.sheetName);
    setExcelResult(reParsed);
  };

  const handleSaveImportedRates = async () => {
    if (!token || !excelResult) return;
    const validRows = excelResult.rows.filter((r) => r.isValid).map((r) => r.data);

    if (validRows.length === 0) {
      alert('No valid rows found to import. Please check your column mappings.');
      return;
    }

    try {
      setIsImporting(true);
      const res = await fetch('/api/dispatch-freight-rates/save-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          rates: validRows,
          replaceExisting,
          sourceFileName: excelFileName,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        setImportNotification({
          type: 'success',
          message: `Successfully imported ${result.savedCount} freight rate records!`,
          details: `${result.duplicateCount} duplicate records skipped. ${
            result.newVehicleTypesAdded?.length > 0
              ? `${result.newVehicleTypesAdded.length} new vehicle types registered.`
              : ''
          }`,
        });
        setShowExcelModal(false);
        setExcelFileBuffer(null);
        setExcelResult(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        fetchRates();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to save imported rates.');
      }
    } catch (err) {
      console.error('Import save error:', err);
      alert('An unexpected error occurred during import.');
    } finally {
      setIsImporting(false);
    }
  };

  // ---------------- SINGLE DISPATCH RATE SAVE ----------------
  const handleSaveDispatchRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchForm.dispatchNo || !dispatchForm.freightRate) {
      alert('Dispatch No. and Freight Rate are required.');
      return;
    }

    try {
      const res = await fetch('/api/dispatch-freight-rates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(dispatchForm),
      });

      if (res.ok) {
        setShowDispatchModal(false);
        setDispatchForm({
          id: '',
          dispatchNo: '',
          freightOrderNo: '',
          loadingDate: '',
          vehicleNo: '',
          vehicleType: '20 Ft Vehicle',
          destination: '',
          freightRate: '',
        });
        fetchRates();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to save freight rate.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteDispatchRate = async (id: string, dispatchNo: string) => {
    if (!confirm(`Are you sure you want to delete freight rate for Dispatch ${dispatchNo}?`)) return;
    try {
      const res = await fetch(`/api/dispatch-freight-rates/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setDispatchRates((prev) => prev.filter((r) => r.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearAllDispatchRates = async () => {
    if (!confirm('Are you sure you want to delete ALL dispatch freight rates for your account? Existing saved invoices will NOT be deleted.')) {
      return;
    }
    try {
      const res = await fetch('/api/dispatch-freight-rates', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setDispatchRates([]);
        alert('All dispatch freight rates have been cleared.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ---------------- EXPORT FUNCTIONS ----------------
  const handleExportDispatchRates = () => {
    const data = generateDispatchRatesExcel(dispatchRates);
    downloadExcelFile(data, 'Freight_Rates_Master_List.xlsx');
  };

  const handleDownloadSampleTemplate = () => {
    const data = generateDispatchRatesSampleTemplate();
    downloadExcelFile(data, 'Freight_Rates_Upload_Template.xlsx');
  };

  const handleExportTariffs = () => {
    const data = generateFreightRatesExcel(customerRates, cityRates);
    downloadExcelFile(data, 'Customer_City_Tariffs.xlsx');
  };

  // ---------------- LOW RATE WARNING CALCULATIONS (PRESERVED) ----------------
  const getCustRateWarnings = () => {
    if (!custForm.customerName || !custForm.destination) return [];
    const normCust = custForm.customerName.trim().toLowerCase();
    const normDest = custForm.destination.trim().toLowerCase();

    const existing = customerRates.find(
      (r) =>
        r.id !== custForm.id &&
        r.customerName.trim().toLowerCase() === normCust &&
        r.destination.trim().toLowerCase() === normDest
    );

    const warnings: { label: string; entered: number; existing: number; diff: number; pct: number; isMinimum?: boolean }[] = [];

    if (existing) {
      const e20 = Number(custForm.rate20ft) || 0;
      if (e20 > 0 && existing.rate20ft > 0 && e20 < existing.rate20ft) {
        const diff = existing.rate20ft - e20;
        const pct = Math.round((diff / existing.rate20ft) * 100);
        warnings.push({ label: '20 Ft Vehicle', entered: e20, existing: existing.rate20ft, diff, pct });
      }

      const e40 = Number(custForm.rate40ft) || 0;
      if (e40 > 0 && existing.rate40ft > 0 && e40 < existing.rate40ft) {
        const diff = existing.rate40ft - e40;
        const pct = Math.round((diff / existing.rate40ft) * 100);
        warnings.push({ label: '40 Ft Vehicle', entered: e40, existing: existing.rate40ft, diff, pct });
      }
    }

    if (minRateThreshold > 0) {
      const e20 = Number(custForm.rate20ft) || 0;
      if (e20 > 0 && e20 < minRateThreshold) {
        warnings.push({
          label: '20 Ft (Below Minimum Limit)',
          entered: e20,
          existing: minRateThreshold,
          diff: minRateThreshold - e20,
          pct: Math.round(((minRateThreshold - e20) / minRateThreshold) * 100),
          isMinimum: true,
        });
      }
      const e40 = Number(custForm.rate40ft) || 0;
      if (e40 > 0 && e40 < minRateThreshold) {
        warnings.push({
          label: '40 Ft (Below Minimum Limit)',
          entered: e40,
          existing: minRateThreshold,
          diff: minRateThreshold - e40,
          pct: Math.round(((minRateThreshold - e40) / minRateThreshold) * 100),
          isMinimum: true,
        });
      }
    }

    return warnings;
  };

  const getCityRateWarnings = () => {
    if (!cityForm.cityName) return [];
    const normCity = cityForm.cityName.trim().toLowerCase();

    const existing = cityRates.find(
      (r) => r.id !== cityForm.id && r.cityName.trim().toLowerCase() === normCity
    );

    const warnings: { label: string; entered: number; existing: number; diff: number; pct: number; isMinimum?: boolean }[] = [];

    if (existing) {
      const e20 = Number(cityForm.rate20ft) || 0;
      if (e20 > 0 && existing.rate20ft > 0 && e20 < existing.rate20ft) {
        const diff = existing.rate20ft - e20;
        const pct = Math.round((diff / existing.rate20ft) * 100);
        warnings.push({ label: '20 Ft Rate', entered: e20, existing: existing.rate20ft, diff, pct });
      }
      const e40 = Number(cityForm.rate40ft) || 0;
      if (e40 > 0 && existing.rate40ft > 0 && e40 < existing.rate40ft) {
        const diff = existing.rate40ft - e40;
        const pct = Math.round((diff / existing.rate40ft) * 100);
        warnings.push({ label: '40 Ft Rate', entered: e40, existing: existing.rate40ft, diff, pct });
      }
    }

    return warnings;
  };

  const custWarnings = getCustRateWarnings();
  const cityWarnings = getCityRateWarnings();

  // ---------------- SAVING CUSTOMER & CITY RATES (PRESERVED) ----------------
  const handleSaveCust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (custWarnings.length > 0 && !custConfirmLower) return;

    try {
      const res = await fetch('/api/freight-rates/customer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(custForm),
      });

      if (res.ok) {
        setShowCustModal(false);
        setCustForm({ id: '', customerName: '', destination: '', rate20ft: '', rate40ft: '' });
        fetchRates();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveCity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cityWarnings.length > 0 && !cityConfirmLower) return;

    try {
      const res = await fetch('/api/freight-rates/city', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(cityForm),
      });

      if (res.ok) {
        setShowCityModal(false);
        setCityForm({
          id: '',
          cityName: '',
          rate20ft: '',
          rate24ftModified: '',
          rate32ftModified: '',
          rate40ft: '',
        });
        fetchRates();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteRate = async (type: 'customer' | 'city', id: string) => {
    if (!confirm('Are you sure you want to delete this freight rate entry?')) return;
    try {
      const res = await fetch(`/api/freight-rates/${type}/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        if (type === 'customer') {
          setCustomerRates(customerRates.filter((r) => r.id !== id));
        } else {
          setCityRates(cityRates.filter((r) => r.id !== id));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveMinRate = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(tempMinRate) || 0;
    setMinRateThreshold(val);
    localStorage.setItem('fleetbill_min_freight_rate', String(val));
    setShowMinRateSettings(false);
  };

  // Filters
  const filteredDispatchRates = dispatchRates.filter((r) => {
    const q = searchTerm.toLowerCase();
    return (
      !q ||
      r.dispatchNo.toLowerCase().includes(q) ||
      (r.freightOrderNo && r.freightOrderNo.toLowerCase().includes(q)) ||
      (r.vehicleNo && r.vehicleNo.toLowerCase().includes(q)) ||
      (r.destination && r.destination.toLowerCase().includes(q)) ||
      (r.vehicleType && r.vehicleType.toLowerCase().includes(q))
    );
  });

  const filteredCustomerRates = customerRates.filter(
    (r) =>
      r.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.destination.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCityRates = cityRates.filter((r) =>
    r.cityName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Freight Rates & Dispatch Master</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Import Excel freight rate files for automated invoice field population, or manage customer/city tariffs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'dispatch' ? (
            <>
              <button
                type="button"
                onClick={handleDownloadSampleTemplate}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
                title="Download template with required 7 columns"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Sample Template</span>
              </button>

              <button
                type="button"
                onClick={handleExportDispatchRates}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-xl transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Export Excel</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDispatchForm({
                    id: '',
                    dispatchNo: '',
                    freightOrderNo: '',
                    loadingDate: '',
                    vehicleNo: '',
                    vehicleType: '20 Ft Vehicle',
                    destination: '',
                    freightRate: '',
                  });
                  setShowDispatchModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-slate-600" />
                <span>Add Single Rate</span>
              </button>

              <button
                type="button"
                onClick={() => setShowExcelModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Upload Excel File</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setShowMinRateSettings(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                <span>Min Protection: {minRateThreshold > 0 ? `Rs. ${formatCurrencyPKR(minRateThreshold)}` : 'Off'}</span>
              </button>

              <button
                onClick={handleExportTariffs}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-xl transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Export Rates</span>
              </button>

              <button
                onClick={() => {
                  if (activeTab === 'customer') {
                    setCustForm({ id: '', customerName: '', destination: '', rate20ft: '', rate40ft: '' });
                    setCustConfirmLower(false);
                    setShowCustModal(true);
                  } else {
                    setCityForm({ id: '', cityName: '', rate20ft: '', rate24ftModified: '', rate32ftModified: '', rate40ft: '' });
                    setCityConfirmLower(false);
                    setShowCityModal(true);
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{activeTab === 'customer' ? 'Add Customer Rate' : 'Add City Tariff'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Notification Banner */}
      {importNotification && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start justify-between gap-3 text-xs text-emerald-900">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-emerald-950 text-sm">{importNotification.message}</p>
              {importNotification.details && (
                <p className="text-emerald-800 mt-0.5">{importNotification.details}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => setImportNotification(null)}
            className="text-emerald-700 hover:text-emerald-900 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex gap-1.5 p-1 bg-slate-100 rounded-xl max-w-fit">
          <button
            onClick={() => setActiveTab('dispatch')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'dispatch'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Truck className="w-4 h-4 text-blue-600" />
            <span>Dispatch Rates (Excel Master)</span>
            <span className="text-[11px] font-mono px-1.5 py-0.2 bg-blue-50 text-blue-700 rounded">
              {dispatchRates.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('customer')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'customer'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building className="w-4 h-4" />
            <span>Customer Rates ({customerRates.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('city')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'city'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>City Tariffs ({cityRates.length})</span>
          </button>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={
              activeTab === 'dispatch'
                ? 'Search dispatch no, vehicle, city, order...'
                : activeTab === 'customer'
                ? 'Search customers or cities...'
                : 'Search cities...'
            }
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-2xs"
          />
        </div>
      </div>

      {/* ---------------- TAB 1: DISPATCH FREIGHT RATES MASTER ---------------- */}
      {activeTab === 'dispatch' && (
        <div className="space-y-4">
          <div className="bg-blue-50/60 border border-blue-200/80 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-blue-900">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                <strong>Invoice Auto-Population Engine:</strong> When you enter any of these <strong>Dispatch Nos.</strong> in Create Invoice, the 7 trip fields (Dispatch No, Freight Order No, Loading Date, Vehicle No, Vehicle Type, Destination, Freight Rate) will populate automatically.
              </span>
            </div>
            {dispatchRates.length > 0 && (
              <button
                type="button"
                onClick={handleClearAllDispatchRates}
                className="text-rose-600 hover:text-rose-800 font-semibold underline text-xs cursor-pointer ml-auto"
              >
                Clear Master List
              </button>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                    <th className="py-3 px-4">DISPATCH NO.</th>
                    <th className="py-3 px-3">FREIGHT ORDER</th>
                    <th className="py-3 px-3">LOADING DATE</th>
                    <th className="py-3 px-3">VEHICLE NO.</th>
                    <th className="py-3 px-3">VEHICLE TYPE</th>
                    <th className="py-3 px-3">DESTINATION</th>
                    <th className="py-3 px-4 text-right">FREIGHT RATE (RS.)</th>
                    <th className="py-3 px-3 text-slate-500 font-medium">SOURCE FILE</th>
                    <th className="py-3 px-4 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDispatchRates.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-500">
                        <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                        <p className="font-semibold text-slate-700 text-sm">No freight rate records found</p>
                        <p className="text-xs text-slate-400 mt-1">
                          Click "Upload Excel File" above to import your rate spreadsheet directly.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredDispatchRates.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-blue-700">
                          {r.dispatchNo}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-800">
                          {r.freightOrderNo || '—'}
                        </td>
                        <td className="py-3 px-3 text-slate-700 font-mono">
                          {r.loadingDate || '—'}
                        </td>
                        <td className="py-3 px-3 font-mono font-semibold text-slate-900">
                          {r.vehicleNo || '—'}
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-medium text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                            {r.vehicleType || '20 Ft Vehicle'}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-900">
                          {r.destination || '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-black text-slate-900">
                          Rs. {formatCurrencyPKR(r.freightRate)}
                        </td>
                        <td className="py-3 px-3 text-slate-500 text-[11px] truncate max-w-[140px]" title={r.sourceFile}>
                          {r.sourceFile || 'Manual'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setDispatchForm({
                                  id: r.id,
                                  dispatchNo: r.dispatchNo,
                                  freightOrderNo: r.freightOrderNo || '',
                                  loadingDate: r.loadingDate || '',
                                  vehicleNo: r.vehicleNo || '',
                                  vehicleType: r.vehicleType || '20 Ft Vehicle',
                                  destination: r.destination || '',
                                  freightRate: String(r.freightRate || ''),
                                });
                                setShowDispatchModal(true);
                              }}
                              className="text-slate-400 hover:text-blue-600 p-1 rounded hover:bg-slate-100"
                              title="Edit rate"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteDispatchRate(r.id, r.dispatchNo)}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-slate-100"
                              title="Delete rate"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
              <span>Showing {filteredDispatchRates.length} of {dispatchRates.length} total records</span>
              <span>Primary lookup key: <strong>Dispatch No.</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- TAB 2: CUSTOMER CONTRACT RATES ---------------- */}
      {activeTab === 'customer' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                  <th className="py-3 px-4">CUSTOMER NAME</th>
                  <th className="py-3 px-4">DESTINATION</th>
                  <th className="py-3 px-4 text-right">20 FT VEHICLE</th>
                  <th className="py-3 px-4 text-right">40 FT VEHICLE</th>
                  <th className="py-3 px-4 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomerRates.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No customer contract rates registered.
                    </td>
                  </tr>
                ) : (
                  filteredCustomerRates.map((rate) => (
                    <tr key={rate.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">{rate.customerName}</td>
                      <td className="py-3 px-4 font-medium text-slate-700">{rate.destination}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        Rs. {formatCurrencyPKR(rate.rate20ft)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        Rs. {formatCurrencyPKR(rate.rate40ft)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setCustForm({
                              id: rate.id,
                              customerName: rate.customerName,
                              destination: rate.destination,
                              rate20ft: String(rate.rate20ft),
                              rate40ft: String(rate.rate40ft),
                            });
                            setCustConfirmLower(false);
                            setShowCustModal(true);
                          }}
                          className="text-slate-400 hover:text-blue-600 p-1 mr-1"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteRate('customer', rate.id)}
                          className="text-slate-400 hover:text-rose-600 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------- TAB 3: GENERAL CITY TARIFFS ---------------- */}
      {activeTab === 'city' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                  <th className="py-3 px-4">CITY / STATION</th>
                  <th className="py-3 px-4 text-right">20 FT VEHICLE</th>
                  <th className="py-3 px-4 text-right">23-24 FT MODIFIED</th>
                  <th className="py-3 px-4 text-right">32 FT MODIFIED</th>
                  <th className="py-3 px-4 text-right">40 FT VEHICLE</th>
                  <th className="py-3 px-4 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCityRates.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No general city tariffs registered.
                    </td>
                  </tr>
                ) : (
                  filteredCityRates.map((rate) => (
                    <tr key={rate.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">{rate.cityName}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        Rs. {formatCurrencyPKR(rate.rate20ft)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-700">
                        {rate.rate24ftModified ? `Rs. ${formatCurrencyPKR(rate.rate24ftModified)}` : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-700">
                        {rate.rate32ftModified ? `Rs. ${formatCurrencyPKR(rate.rate32ftModified)}` : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        Rs. {formatCurrencyPKR(rate.rate40ft)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setCityForm({
                              id: rate.id,
                              cityName: rate.cityName,
                              rate20ft: String(rate.rate20ft),
                              rate24ftModified: String(rate.rate24ftModified || ''),
                              rate32ftModified: String(rate.rate32ftModified || ''),
                              rate40ft: String(rate.rate40ft),
                            });
                            setCityConfirmLower(false);
                            setShowCityModal(true);
                          }}
                          className="text-slate-400 hover:text-blue-600 p-1 mr-1"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteRate('city', rate.id)}
                          className="text-slate-400 hover:text-rose-600 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------- MODAL: EXCEL IMPORT & REVIEW ---------------- */}
      {showExcelModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 my-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                  <span>Upload Freight Rates Directly from Excel</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Reads your Excel sheet, maps the 7 required fields, validates rates, and enables automatic invoice creation.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowExcelModal(false);
                  setExcelResult(null);
                  setExcelFileBuffer(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step 1: File Picker */}
            {!excelResult ? (
              <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-8 text-center transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="hidden"
                  id="excel-file-upload-input"
                />
                <label
                  htmlFor="excel-file-upload-input"
                  className="cursor-pointer flex flex-col items-center justify-center space-y-3"
                >
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-xs">
                    <Upload className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-900 hover:text-blue-600">
                      Click to choose your Freight Rate Excel file
                    </span>
                    <p className="text-xs text-slate-500 mt-1">
                      Supports .xlsx, .xls, and .csv formats
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-3 py-1 bg-slate-100 text-slate-600 rounded-full">
                    Auto-maps: Dispatch No, Freight Order, Loading Date, Vehicle No, Vehicle Type, Destination, Freight Rate
                  </span>
                </label>
              </div>
            ) : (
              <div className="space-y-4">
                {/* File & Validation Summary */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold text-slate-900">{excelResult.fileName}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-600">{excelResult.totalRows} records found</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded font-bold text-emerald-800 bg-emerald-100">
                      {excelResult.validCount} Valid
                    </span>
                    {excelResult.invalidCount > 0 && (
                      <span className="px-2 py-0.5 rounded font-bold text-rose-800 bg-rose-100">
                        {excelResult.invalidCount} Invalid (Will Skip)
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setExcelResult(null);
                        setExcelFileBuffer(null);
                      }}
                      className="text-blue-600 hover:underline font-semibold ml-2 cursor-pointer"
                    >
                      Change File
                    </button>
                  </div>
                </div>

                {/* Detected New Vehicle Types Banner */}
                {excelResult.detectedTypes.length > 0 && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs flex items-start gap-2.5">
                    <Truck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-blue-950">
                        Detected Vehicle Types in File ({excelResult.detectedTypes.length})
                      </p>
                      <p className="text-blue-800 mt-0.5">
                        {excelResult.detectedTypes.join(', ')}. Any new vehicle types will be automatically registered in your dynamic vehicle catalog without duplicates.
                      </p>
                    </div>
                  </div>
                )}

                {/* Column Mapping Reviewer */}
                <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-blue-600" />
                      <span>Review Column Mappings (7 Required Fields)</span>
                    </h4>
                    <span className="text-[11px] text-slate-500">
                      Auto-detected from your file headers. Adjust if needed.
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        1. Dispatch No. *
                      </label>
                      <select
                        value={customMapping.dispatchNo || ''}
                        onChange={(e) => handleMappingFieldChange('dispatchNo', e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium"
                      >
                        <option value="">(Select column...)</option>
                        {excelResult.availableColumns.map((col) => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        2. Freight Order No.
                      </label>
                      <select
                        value={customMapping.freightOrderNo || ''}
                        onChange={(e) => handleMappingFieldChange('freightOrderNo', e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium"
                      >
                        <option value="">(None / Blank)</option>
                        {excelResult.availableColumns.map((col) => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        3. Loading Date
                      </label>
                      <select
                        value={customMapping.loadingDate || ''}
                        onChange={(e) => handleMappingFieldChange('loadingDate', e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium"
                      >
                        <option value="">(None / Blank)</option>
                        {excelResult.availableColumns.map((col) => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        4. Vehicle No.
                      </label>
                      <select
                        value={customMapping.vehicleNo || ''}
                        onChange={(e) => handleMappingFieldChange('vehicleNo', e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium"
                      >
                        <option value="">(None / Blank)</option>
                        {excelResult.availableColumns.map((col) => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        5. Vehicle Type
                      </label>
                      <select
                        value={customMapping.vehicleType || ''}
                        onChange={(e) => handleMappingFieldChange('vehicleType', e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium"
                      >
                        <option value="">(Default: 20 Ft Vehicle)</option>
                        {excelResult.availableColumns.map((col) => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        6. Destination
                      </label>
                      <select
                        value={customMapping.destination || ''}
                        onChange={(e) => handleMappingFieldChange('destination', e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium"
                      >
                        <option value="">(None / Blank)</option>
                        {excelResult.availableColumns.map((col) => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-slate-700 mb-1">
                        7. Freight Rate (Rs.) *
                      </label>
                      <select
                        value={customMapping.freightRate || ''}
                        onChange={(e) => handleMappingFieldChange('freightRate', e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium text-emerald-800 font-bold"
                      >
                        <option value="">(Select freight rate column...)</option>
                        {excelResult.availableColumns.map((col) => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Duplicate Policy Selection */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                  <span className="font-semibold text-slate-800">Duplicate Handling Policy:</span>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                      <input
                        type="radio"
                        name="dup-policy"
                        checked={!replaceExisting}
                        onChange={() => setReplaceExisting(false)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span>Preserve existing records (Skip duplicates)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                      <input
                        type="radio"
                        name="dup-policy"
                        checked={replaceExisting}
                        onChange={() => setReplaceExisting(true)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span>Update existing records with new rates</span>
                    </label>
                  </div>
                </div>

                {/* Preview Table of First 20 Rows */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-3 py-2 bg-slate-100 text-xs font-bold text-slate-700 flex justify-between items-center">
                    <span>Parsed Rows Preview (Showing first {Math.min(25, excelResult.rows.length)} of {excelResult.rows.length})</span>
                    <span className="text-slate-500 font-normal">Check that columns reflect the correct values</span>
                  </div>
                  <div className="overflow-x-auto max-h-56">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 sticky top-0">
                        <tr>
                          <th className="py-2 px-2.5 w-12 text-center">Row</th>
                          <th className="py-2 px-2.5">Status</th>
                          <th className="py-2 px-2.5">Dispatch No.</th>
                          <th className="py-2 px-2.5">Order No.</th>
                          <th className="py-2 px-2.5">Loading Date</th>
                          <th className="py-2 px-2.5">Vehicle No.</th>
                          <th className="py-2 px-2.5">Vehicle Type</th>
                          <th className="py-2 px-2.5">Destination</th>
                          <th className="py-2 px-2.5 text-right">Freight Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {excelResult.rows.slice(0, 25).map((r, i) => (
                          <tr
                            key={i}
                            className={r.isValid ? 'hover:bg-slate-50' : 'bg-rose-50/50 hover:bg-rose-50'}
                          >
                            <td className="py-1.5 px-2.5 text-center text-slate-500">{r.rowNumber}</td>
                            <td className="py-1.5 px-2.5 font-sans">
                              {r.isValid ? (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                                  Valid
                                </span>
                              ) : (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-bold" title={r.errors.join(', ')}>
                                  {r.errors[0]}
                                </span>
                              )}
                            </td>
                            <td className="py-1.5 px-2.5 font-bold text-blue-700">{r.data.dispatchNo || '—'}</td>
                            <td className="py-1.5 px-2.5 text-slate-700">{r.data.freightOrderNo || '—'}</td>
                            <td className="py-1.5 px-2.5 text-slate-700">{r.data.loadingDate || '—'}</td>
                            <td className="py-1.5 px-2.5 text-slate-800">{r.data.vehicleNo || '—'}</td>
                            <td className="py-1.5 px-2.5 font-sans text-slate-700">{r.data.vehicleType || '—'}</td>
                            <td className="py-1.5 px-2.5 font-sans font-semibold text-slate-800">{r.data.destination || '—'}</td>
                            <td className="py-1.5 px-2.5 text-right font-bold text-slate-900">
                              Rs. {formatCurrencyPKR(r.data.freightRate)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Modal Footer Controls */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <span className="text-xs text-slate-500">
                    Will save <strong>{excelResult.validCount}</strong> valid rates to your master list.
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowExcelModal(false);
                        setExcelResult(null);
                        setExcelFileBuffer(null);
                      }}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isImporting || excelResult.validCount === 0}
                      onClick={handleSaveImportedRates}
                      className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-md shadow-blue-500/20 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isImporting ? 'Saving Records...' : `Import & Save ${excelResult.validCount} Rates`}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------- MODAL: SINGLE DISPATCH RATE MANUAL ENTRY ---------------- */}
      {showDispatchModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">
                {dispatchForm.id ? 'Edit Dispatch Freight Rate' : 'Add Single Dispatch Freight Rate'}
              </h3>
              <button
                type="button"
                onClick={() => setShowDispatchModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDispatchRate} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Dispatch No. *
                </label>
                <input
                  type="text"
                  value={dispatchForm.dispatchNo}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, dispatchNo: e.target.value.trim() })}
                  placeholder="e.g. CD81052367 or B.NO: 11"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold text-blue-700"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Freight Order No.</label>
                  <input
                    type="text"
                    value={dispatchForm.freightOrderNo}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, freightOrderNo: e.target.value })}
                    placeholder="e.g. 6100000000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Loading Date</label>
                  <input
                    type="text"
                    value={dispatchForm.loadingDate}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, loadingDate: e.target.value })}
                    placeholder="27.09.2026"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Vehicle No.</label>
                  <input
                    type="text"
                    value={dispatchForm.vehicleNo}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, vehicleNo: e.target.value.toUpperCase() })}
                    placeholder="LZR 1089"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Vehicle Type</label>
                  <input
                    type="text"
                    value={dispatchForm.vehicleType}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, vehicleType: e.target.value })}
                    placeholder="20 Ft Vehicle"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Destination City</label>
                  <input
                    type="text"
                    value={dispatchForm.destination}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, destination: e.target.value.toUpperCase() })}
                    placeholder="MULTAN"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl uppercase font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Freight Rate (Rs.) *</label>
                  <input
                    type="number"
                    value={dispatchForm.freightRate}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, freightRate: e.target.value })}
                    placeholder="43200"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold text-slate-900"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDispatchModal(false)}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl text-xs hover:bg-blue-700 shadow-sm"
                >
                  Save Freight Rate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- MODAL: CUSTOMER CONTRACT RATE (PRESERVED) ---------------- */}
      {showCustModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {custForm.id ? 'Edit Customer Contract Rate' : 'Add Customer Contract Rate'}
              </h3>
              <button
                type="button"
                onClick={() => setShowCustModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {custWarnings.length > 0 && (
              <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-2 text-xs">
                <div className="flex items-center gap-2 font-bold text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Low Freight Rate Warning</span>
                </div>
                <div className="bg-white/80 p-2.5 rounded-lg border border-amber-200 divide-y divide-amber-100 space-y-1.5 text-[11px]">
                  {custWarnings.map((w, idx) => (
                    <div key={idx} className="flex justify-between items-center pt-1 first:pt-0">
                      <span className="font-semibold text-slate-800">{w.label}:</span>
                      <span className="font-mono text-amber-900 font-bold">
                        Rs. {formatCurrencyPKR(w.entered)} &nbsp;
                        <span className="text-slate-400 line-through">Rs. {formatCurrencyPKR(w.existing)}</span> &nbsp;
                        <span className="text-rose-600 font-semibold">(-Rs. {formatCurrencyPKR(w.diff)} / -{w.pct}%)</span>
                      </span>
                    </div>
                  ))}
                </div>
                <label className="flex items-start gap-2 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={custConfirmLower}
                    onChange={(e) => setCustConfirmLower(e.target.checked)}
                    className="mt-0.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-amber-950 font-bold select-none text-[11px]">
                    Confirm and Save Lower Rate (I verify this negotiated discount is intentional)
                  </span>
                </label>
              </div>
            )}

            <form onSubmit={handleSaveCust} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Customer / Company Name</label>
                <input
                  type="text"
                  value={custForm.customerName}
                  onChange={(e) => setCustForm({ ...custForm, customerName: e.target.value })}
                  placeholder="e.g. BULLEH SHAH PACKAGING (PVT) LTD"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 font-medium"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Destination Route</label>
                <input
                  type="text"
                  value={custForm.destination}
                  onChange={(e) => setCustForm({ ...custForm, destination: e.target.value })}
                  placeholder="e.g. Kasur to Multan"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">20 Ft Rate / Trip (Rs.)</label>
                  <input
                    type="number"
                    value={custForm.rate20ft}
                    onChange={(e) => setCustForm({ ...custForm, rate20ft: e.target.value })}
                    placeholder="43200"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold text-slate-900"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">40 Ft Rate / Trip (Rs.)</label>
                  <input
                    type="number"
                    value={custForm.rate40ft}
                    onChange={(e) => setCustForm({ ...custForm, rate40ft: e.target.value })}
                    placeholder="50000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold text-slate-900"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCustModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={custWarnings.length > 0 && !custConfirmLower}
                  className={`px-5 py-2.5 font-bold rounded-xl text-xs text-white transition-all shadow-md ${
                    custWarnings.length > 0 && !custConfirmLower
                      ? 'bg-amber-500 opacity-60 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20 cursor-pointer'
                  }`}
                >
                  {custWarnings.length > 0 ? 'Confirm & Save Rate' : 'Save Customer Rate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- MODAL: GENERAL CITY TARIFF (PRESERVED) ---------------- */}
      {showCityModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {cityForm.id ? 'Edit General City Tariff' : 'Add General City Tariff'}
              </h3>
              <button
                type="button"
                onClick={() => setShowCityModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {cityWarnings.length > 0 && (
              <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-2 text-xs">
                <div className="flex items-center gap-2 font-bold text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Low Freight Rate Warning</span>
                </div>
                <div className="bg-white/80 p-2.5 rounded-lg border border-amber-200 divide-y divide-amber-100 space-y-1.5 text-[11px]">
                  {cityWarnings.map((w, idx) => (
                    <div key={idx} className="flex justify-between items-center pt-1 first:pt-0">
                      <span className="font-semibold text-slate-800">{w.label}:</span>
                      <span className="font-mono text-amber-900 font-bold">
                        Rs. {formatCurrencyPKR(w.entered)} &nbsp;
                        <span className="text-slate-400 line-through">Rs. {formatCurrencyPKR(w.existing)}</span> &nbsp;
                        <span className="text-rose-600 font-semibold">(-Rs. {formatCurrencyPKR(w.diff)} / -{w.pct}%)</span>
                      </span>
                    </div>
                  ))}
                </div>
                <label className="flex items-start gap-2 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cityConfirmLower}
                    onChange={(e) => setCityConfirmLower(e.target.checked)}
                    className="mt-0.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-amber-950 font-bold select-none text-[11px]">
                    Confirm and Save Lower Rate (I verify this negotiated discount is intentional)
                  </span>
                </label>
              </div>
            )}

            <form onSubmit={handleSaveCity} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">City / Station Name</label>
                <input
                  type="text"
                  value={cityForm.cityName}
                  onChange={(e) => setCityForm({ ...cityForm, cityName: e.target.value })}
                  placeholder="e.g. Sialkot"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">20 Ft Rate (Rs.) *</label>
                  <input
                    type="number"
                    value={cityForm.rate20ft}
                    onChange={(e) => setCityForm({ ...cityForm, rate20ft: e.target.value })}
                    placeholder="25000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold text-slate-900"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">23-24 Ft Modified (Rs.)</label>
                  <input
                    type="number"
                    value={cityForm.rate24ftModified}
                    onChange={(e) => setCityForm({ ...cityForm, rate24ftModified: e.target.value })}
                    placeholder="32000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">32 Ft Modified (Rs.)</label>
                  <input
                    type="number"
                    value={cityForm.rate32ftModified}
                    onChange={(e) => setCityForm({ ...cityForm, rate32ftModified: e.target.value })}
                    placeholder="42000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">40 Ft Rate (Rs.) *</label>
                  <input
                    type="number"
                    value={cityForm.rate40ft}
                    onChange={(e) => setCityForm({ ...cityForm, rate40ft: e.target.value })}
                    placeholder="52000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold text-slate-900"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCityModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={cityWarnings.length > 0 && !cityConfirmLower}
                  className={`px-5 py-2.5 font-bold rounded-xl text-xs text-white transition-all shadow-md ${
                    cityWarnings.length > 0 && !cityConfirmLower
                      ? 'bg-amber-500 opacity-60 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20 cursor-pointer'
                  }`}
                >
                  {cityWarnings.length > 0 ? 'Confirm & Save Tariff' : 'Save City Tariff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- MODAL: MINIMUM RATE PROTECTION (PRESERVED) ---------------- */}
      {showMinRateSettings && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm">Minimum Freight Protection</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowMinRateSettings(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Set an optional minimum floor threshold (PKR). If an entered rate is below this threshold, you will receive a prompt before saving. Set to 0 to disable.
            </p>

            <form onSubmit={handleSaveMinRate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Minimum Floor Rate (Rs.)
                </label>
                <input
                  type="number"
                  value={tempMinRate}
                  onChange={(e) => setTempMinRate(e.target.value)}
                  placeholder="e.g. 15000"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold font-mono text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMinRateSettings(false)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 shadow-sm"
                >
                  Save Limit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
