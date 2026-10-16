import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import type {
  Invoice,
  InvoiceItem,
  Customer,
  Vehicle,
  CustomerFreightRate,
  CityFreightRate,
  DispatchFreightRate,
  TransporterVehicleType,
} from '../../types';
import {
  calculateRowSubTotal,
  calculateInvoiceTotals,
  matchFreightRate,
  formatCurrencyPKR,
} from '../../utils/billing-calculations';
import {
  Save,
  ArrowLeft,
  Plus,
  Trash2,
  Copy,
  Sparkles,
  Calculator,
  AlertCircle,
  Building2,
  User,
  Search,
  CheckCircle2,
  AlertTriangle,
  Truck,
  Calendar,
  X,
  Layers,
  Info,
} from 'lucide-react';

interface InvoiceFormProps {
  initialInvoice?: Invoice | null;
  onSaveSuccess: (invoice: Invoice) => void;
  onCancel: () => void;
}

export const InvoiceForm: React.FC<InvoiceFormProps> = ({ initialInvoice, onSaveSuccess, onCancel }) => {
  const { user, token } = useAuth();

  // Reference data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [customerRates, setCustomerRates] = useState<CustomerFreightRate[]>([]);
  const [cityRates, setCityRates] = useState<CityFreightRate[]>([]);
  const [dispatchMasterRates, setDispatchMasterRates] = useState<DispatchFreightRate[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<TransporterVehicleType[]>([]);

  // Form State
  const [invoiceNumber, setInvoiceNumber] = useState(
    initialInvoice?.invoiceNumber || `${user?.settings?.invoicePrefix || 'IK-BSP-26-'}005-Punjab`
  );
  const [invoiceDate, setInvoiceDate] = useState(initialInvoice?.invoiceDate || '08.10.2026');
  const [deliveryCode, setDeliveryCode] = useState(initialInvoice?.deliveryCode || 'CD');

  // Customer details
  const [selectedCustomerId, setSelectedCustomerId] = useState(initialInvoice?.customerId || '');
  const [customerName, setCustomerName] = useState(initialInvoice?.customerName || '');
  const [customerAddress, setCustomerAddress] = useState(initialInvoice?.customerAddress || '');
  const [customerNtn, setCustomerNtn] = useState(initialInvoice?.customerNtn || '');
  const [customerStrn, setCustomerStrn] = useState(initialInvoice?.customerStrn || '');

  // Transporter details
  const [transporterCompanyName, setTransporterCompanyName] = useState(
    initialInvoice?.transporterCompanyName || user?.companyName || 'IK LOGISTICS (SMC) PVT LTD'
  );
  const [transporterAddress, setTransporterAddress] = useState(
    initialInvoice?.transporterAddress || user?.address || 'BSP GATE NO.1, 10KM KRK ROAD KASUR'
  );
  const [transporterPhone, setTransporterPhone] = useState(
    initialInvoice?.transporterPhone || user?.phone || '0301 6411664'
  );
  const [transporterEmail, setTransporterEmail] = useState(
    initialInvoice?.transporterEmail || user?.email || 'iklogisticsofficial@gmail.com'
  );
  const [transporterNtn, setTransporterNtn] = useState(
    initialInvoice?.transporterNtn || user?.ntn || 'J-622143'
  );

  // Taxes
  const [taxRate, setTaxRate] = useState<number>(initialInvoice?.taxRate ?? 15);
  const [taxName, setTaxName] = useState<string>(initialInvoice?.taxName || 'Total Punjab 15% Tex');
  const [paymentStatus, setPaymentStatus] = useState<'unpaid' | 'paid' | 'partial'>(
    initialInvoice?.paymentStatus || 'unpaid'
  );
  const [notes, setNotes] = useState(initialInvoice?.notes || '');

  // Items
  const [items, setItems] = useState<InvoiceItem[]>(
    initialInvoice?.items || [
      {
        id: 'itm_new_1',
        sr: 1,
        cdDespatch: 'CD81052367',
        freightOrder: '6100000000',
        loadingDate: '27.09.2026',
        offloadingDate: '29.09.2026',
        vehicleNo: 'LZR 1089',
        vehicleType: '20 Ft Vehicle',
        distributorName: 'PEPSI COLA INTERNATIONAL',
        city: 'MULTAN',
        freight: 43200,
        unloading: 0,
        move: 0,
        haltingCustomer: 4000,
        haltingFactory: 0,
        subTotal: 47200,
      },
    ]
  );

  // Auto-population and feedback state
  const [quickDispatchInput, setQuickDispatchInput] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [autoPopulateAlert, setAutoPopulateAlert] = useState<{
    type: 'success' | 'warning' | 'info';
    message: string;
    details?: string;
  } | null>(null);

  // Multi-match selection state
  const [multiMatchModal, setMultiMatchModal] = useState<{
    isOpen: boolean;
    dispatchNo: string;
    matches: DispatchFreightRate[];
    targetIndex?: number; // target row to populate, or undefined to append/fill first
  }>({
    isOpen: false,
    dispatchNo: '',
    matches: [],
  });

  // Inline New Vehicle Type Modal
  const [newVehicleTypeModal, setNewVehicleTypeModal] = useState<{
    isOpen: boolean;
    targetItemIndex: number | null;
  }>({
    isOpen: false,
    targetItemIndex: null,
  });
  const [newTypeNameInput, setNewTypeNameInput] = useState('');

  // Duplicate Dispatch on Save Confirmation
  const [duplicateWarningOnSave, setDuplicateWarningOnSave] = useState<{
    isOpen: boolean;
    duplicates: { dispatchNo: string; invoices: string[] }[];
  }>({
    isOpen: false,
    duplicates: [],
  });

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasConfirmedLowerRates, setHasConfirmedLowerRates] = useState(false);

  // ---------------- LOAD SUPPORTING RESOURCES ----------------
  const loadData = async () => {
    if (!token) return;
    try {
      const [custRes, vehRes, ratesRes, dispatchRes, typesRes] = await Promise.all([
        fetch('/api/customers', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/vehicles', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/freight-rates', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/dispatch-freight-rates', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/vehicle-types', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (custRes.ok) {
        const cData = await custRes.json();
        setCustomers(cData.customers || []);
        if (!initialInvoice && cData.customers?.length > 0 && !selectedCustomerId) {
          const first = cData.customers[0];
          setSelectedCustomerId(first.id);
          setCustomerName(first.name);
          setCustomerAddress(first.address);
          setCustomerNtn(first.ntn);
          setCustomerStrn(first.strn);
        }
      }
      if (vehRes.ok) {
        const vData = await vehRes.json();
        setVehicles(vData.vehicles || []);
      }
      if (ratesRes.ok) {
        const rData = await ratesRes.json();
        setCustomerRates(rData.customerRates || []);
        setCityRates(rData.cityRates || []);
      }
      if (dispatchRes.ok) {
        const dData = await dispatchRes.json();
        setDispatchMasterRates(dData.rates || []);
      }
      if (typesRes.ok) {
        const tData = await typesRes.json();
        setVehicleTypes(tData.vehicleTypes || []);
      }
    } catch (err) {
      console.error('Error fetching supporting invoice data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  // Handle Customer Selection
  const handleCustomerChange = (custId: string) => {
    setSelectedCustomerId(custId);
    const found = customers.find((c) => c.id === custId);
    if (found) {
      setCustomerName(found.name);
      setCustomerAddress(found.address);
      setCustomerNtn(found.ntn);
      setCustomerStrn(found.strn);
    }
  };

  // ---------------- LINE ITEM MUTATION ----------------
  const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
    const updated = [...items];
    const current = { ...updated[index], [field]: value };

    // Recompute subtotal when any numerical charge is modified
    if (['freight', 'unloading', 'move', 'haltingCustomer', 'haltingFactory'].includes(field)) {
      current.subTotal = calculateRowSubTotal(
        Number(current.freight) || 0,
        Number(current.unloading) || 0,
        Number(current.move) || 0,
        Number(current.haltingCustomer) || 0,
        Number(current.haltingFactory) || 0
      );
    }

    updated[index] = current;
    setItems(updated);
  };

  // ---------------- DISPATCH AUTO-POPULATION LOGIC ----------------
  const applyDispatchRecordToItem = (
    itemIndex: number,
    record: DispatchFreightRate,
    invoiceCheck?: { invoiced: boolean; invoiceNumbers: string[] }
  ) => {
    const updated = [...items];
    const target = updated[itemIndex] || {
      id: `itm_${Date.now()}_${items.length + 1}`,
      sr: items.length + 1,
      unloading: 0,
      move: 0,
      haltingCustomer: 0,
      haltingFactory: 0,
      offloadingDate: record.loadingDate || invoiceDate,
      distributorName: customerName || 'PEPSI COLA INTERNATIONAL',
    };

    // Auto-populate the 7 REQUIRED FIELDS
    target.cdDespatch = record.dispatchNo;
    target.freightOrder = record.freightOrderNo || target.freightOrder || '';
    target.loadingDate = record.loadingDate || target.loadingDate || invoiceDate;
    target.vehicleNo = record.vehicleNo || target.vehicleNo || '';
    target.vehicleType = record.vehicleType || target.vehicleType || '20 Ft Vehicle';
    target.city = record.destination || target.city || '';
    target.freight = Number(record.freightRate) || 0;

    // Recalculate subtotal
    target.subTotal = calculateRowSubTotal(
      target.freight,
      Number(target.unloading) || 0,
      Number(target.move) || 0,
      Number(target.haltingCustomer) || 0,
      Number(target.haltingFactory) || 0
    );

    if (itemIndex < updated.length) {
      updated[itemIndex] = target;
    } else {
      updated.push(target);
    }
    setItems(updated);

    // Feedback message
    if (invoiceCheck?.invoiced) {
      setAutoPopulateAlert({
        type: 'warning',
        message: `Dispatch #${record.dispatchNo} was already invoiced in ${invoiceCheck.invoiceNumbers.join(
          ', '
        )}. Fields have been populated for supplementary or corrected billing.`,
      });
    } else {
      setAutoPopulateAlert({
        type: 'success',
        message: `Auto-populated 7 fields for Dispatch #${record.dispatchNo} (Order: ${record.freightOrderNo || 'N/A'}, Vehicle: ${record.vehicleNo || 'N/A'}, City: ${record.destination || 'N/A'}, Rate: Rs. ${formatCurrencyPKR(record.freightRate)}).`,
      });
    }
  };

  /**
   * Search and auto-populate by Dispatch No.
   * Can be triggered from the top Quick-Fill bar OR from the row input
   */
  const handleLookupDispatch = async (dispatchNoToLookup: string, targetIndex?: number) => {
    const cleanNo = dispatchNoToLookup.trim();
    if (!cleanNo) return;

    if (!token) return;
    setIsLookingUp(true);
    setAutoPopulateAlert(null);

    try {
      const res = await fetch(`/api/dispatch-freight-rates/lookup?dispatchNo=${encodeURIComponent(cleanNo)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('Failed to search dispatch rates');
      }

      const { matches, invoiceCheck } = await res.json();

      if (!matches || matches.length === 0) {
        // No match found: show clear friendly message & allow manual entry
        setAutoPopulateAlert({
          type: 'info',
          message: `No freight rate record found for Dispatch "${cleanNo}". You can enter the trip information manually.`,
        });
        return;
      }

      if (matches.length === 1) {
        // Single match found: auto-populate immediately!
        const match = matches[0];
        let idx = targetIndex;
        if (idx === undefined) {
          // If first item is mostly empty or default, fill it; otherwise append a new trip
          const firstItem = items[0];
          if (
            items.length === 1 &&
            (!firstItem.cdDespatch || firstItem.cdDespatch === 'CD81052367' || firstItem.cdDespatch === cleanNo)
          ) {
            idx = 0;
          } else {
            // Find existing item with this dispatch no, or append
            const existingIdx = items.findIndex((it) => it.cdDespatch.trim().toLowerCase() === cleanNo.toLowerCase());
            idx = existingIdx !== -1 ? existingIdx : items.length;
          }
        }
        applyDispatchRecordToItem(idx, match, invoiceCheck);
        setQuickDispatchInput('');
      } else {
        // Multiple matches found for the same Dispatch No: show selection modal
        setMultiMatchModal({
          isOpen: true,
          dispatchNo: cleanNo,
          matches,
          targetIndex,
        });
      }
    } catch (err: any) {
      console.error(err);
      setAutoPopulateAlert({
        type: 'warning',
        message: 'Could not lookup freight rate. Please enter trip details manually.',
      });
    } finally {
      setIsLookingUp(false);
    }
  };

  // Add Item Row
  const addItemRow = () => {
    const nextSr = items.length + 1;
    const defaultType = vehicleTypes.find((vt) => vt.status !== 'inactive')?.name || '20 Ft Vehicle';
    const newItem: InvoiceItem = {
      id: `itm_${Date.now()}_${nextSr}`,
      sr: nextSr,
      cdDespatch: '',
      freightOrder: '',
      loadingDate: invoiceDate,
      offloadingDate: invoiceDate,
      vehicleNo: vehicles.length > 0 ? vehicles[0].vehicleNo : '',
      vehicleType: defaultType,
      distributorName: customerName || 'PEPSI COLA INTERNATIONAL',
      city: '',
      freight: 0,
      unloading: 0,
      move: 0,
      haltingCustomer: 0,
      haltingFactory: 0,
      subTotal: 0,
    };
    setItems([...items, newItem]);
  };

  const duplicateItemRow = (index: number) => {
    const source = items[index];
    const nextSr = items.length + 1;
    const copy: InvoiceItem = {
      ...source,
      id: `itm_${Date.now()}_${nextSr}`,
      sr: nextSr,
      cdDespatch: `${source.cdDespatch}-COPY`,
    };
    setItems([...items, copy]);
  };

  const removeItemRow = (index: number) => {
    if (items.length <= 1) {
      alert('Invoice must have at least one line item.');
      return;
    }
    const filtered = items.filter((_, i) => i !== index).map((item, idx) => ({ ...item, sr: idx + 1 }));
    setItems(filtered);
  };

  // ---------------- DYNAMIC VEHICLE TYPE INLINE CREATION ----------------
  const handleAddNewVehicleType = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newTypeNameInput.trim();
    if (!clean || !token) return;

    try {
      const res = await fetch('/api/vehicle-types', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: clean }),
      });

      if (res.ok) {
        const { vehicleType } = await res.json();
        setVehicleTypes((prev) => [vehicleType, ...prev.filter((t) => t.id !== vehicleType.id)]);

        // If modal was opened from a specific item row, select it immediately
        if (newVehicleTypeModal.targetItemIndex !== null) {
          handleItemChange(newVehicleTypeModal.targetItemIndex, 'vehicleType', vehicleType.name);
        }

        setNewVehicleTypeModal({ isOpen: false, targetItemIndex: null });
        setNewTypeNameInput('');
      }
    } catch (err) {
      console.error('Error adding vehicle type:', err);
    }
  };

  // Check if item rate is lower than agreed rate sheet for that exact city and vehicle
  const getItemRateWarning = (item: InvoiceItem) => {
    if (!item.city || !item.freight) return null;
    const match = matchFreightRate(
      item.city,
      item.vehicleType || '20 Ft Vehicle',
      customerName,
      customerRates,
      cityRates
    );
    if (match.matchedRate !== null && match.matchedRate > 0) {
      if (item.freight < match.matchedRate) {
        const diff = match.matchedRate - item.freight;
        const pct = Math.round((diff / match.matchedRate) * 100);
        return {
          standardRate: match.matchedRate,
          diff,
          pct,
          source: match.note || 'Agreed Rate Sheet',
        };
      }
    }
    return null;
  };

  // Live Summary calculation
  const totals = calculateInvoiceTotals(items, taxRate, taxName);

  // ---------------- SUBMIT HANDLER & DUPLICATE PROTECTION ----------------
  const performSaveInvoice = async () => {
    setSaving(true);
    setErrorMessage(null);
    try {
      const payload = {
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate,
        deliveryCode,
        customerId: selectedCustomerId,
        customerName,
        customerAddress,
        customerNtn,
        customerStrn,
        transporterCompanyName,
        transporterAddress,
        transporterPhone,
        transporterEmail,
        transporterNtn,
        taxRate,
        taxName,
        paymentStatus,
        notes,
        items,
        paidAmount: paymentStatus === 'paid' ? totals.grandTotal : 0,
      };

      const url = initialInvoice ? `/api/invoices/${initialInvoice.id}` : '/api/invoices';
      const method = initialInvoice ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to save invoice.');
        setSaving(false);
        return;
      }

      onSaveSuccess(data.invoice);
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!invoiceNumber.trim()) {
      setErrorMessage('Please enter an Invoice Number.');
      return;
    }
    if (!customerName.trim()) {
      setErrorMessage('Please specify the Customer name.');
      return;
    }
    if (items.length === 0) {
      setErrorMessage('Please add at least one line item.');
      return;
    }

    // Check for lower rates than agreed contracts
    const lowerRateItems = items
      .map((it, idx) => ({ item: it, idx: idx + 1, warning: getItemRateWarning(it) }))
      .filter((x) => x.warning !== null);

    if (lowerRateItems.length > 0 && !hasConfirmedLowerRates) {
      const details = lowerRateItems
        .map(
          (x) =>
            `• Trip #${x.idx} (${x.item.city} - ${x.item.vehicleType || '20 Ft'}): entered Rs. ${formatCurrencyPKR(
              x.item.freight
            )}, contract tariff is Rs. ${formatCurrencyPKR(x.warning!.standardRate)} (-${x.warning!.pct}%)`
        )
        .join('\n');

      const proceed = window.confirm(
        `Low Freight Rate Alert:\n\nThe following delivery rates are lower than your agreed rate sheet:\n\n${details}\n\nDo you want to confirm and save this invoice with intentionally lower freight rates?`
      );
      if (!proceed) {
        return;
      }
      setHasConfirmedLowerRates(true);
    }

    // Duplicate Dispatch Warning Check across existing invoices (Requirement 5)
    if (!initialInvoice && token) {
      try {
        const invRes = await fetch('/api/invoices', { headers: { Authorization: `Bearer ${token}` } });
        if (invRes.ok) {
          const { invoices }: { invoices: Invoice[] } = await invRes.json();
          const existingInvoices = invoices || [];
          const duplicatesFound: { dispatchNo: string; invoices: string[] }[] = [];

          for (const it of items) {
            if (!it.cdDespatch || !it.cdDespatch.trim()) continue;
            const cleanD = it.cdDespatch.trim().toLowerCase();
            const matchedInvs = existingInvoices
              .filter((inv) => inv.items.some((i) => i.cdDespatch && i.cdDespatch.trim().toLowerCase() === cleanD))
              .map((inv) => inv.invoiceNumber);

            if (matchedInvs.length > 0) {
              duplicatesFound.push({ dispatchNo: it.cdDespatch, invoices: matchedInvs });
            }
          }

          if (duplicatesFound.length > 0) {
            setDuplicateWarningOnSave({
              isOpen: true,
              duplicates: duplicatesFound,
            });
            return;
          }
        }
      } catch (err) {
        console.error('Error verifying duplicate dispatches:', err);
      }
    }

    await performSaveInvoice();
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Top Header & Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Cancel
          </button>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {initialInvoice ? 'Edit Existing Invoice' : 'Create New Billing Sheet'}
            </span>
            <h1 className="text-lg font-bold text-slate-900">{invoiceNumber || 'New Invoice'}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
          >
            Discard
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving Invoice...' : 'Save Invoice'}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Unable to save invoice</p>
            <p>{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Invoice Meta Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Transporter Details */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <Building2 className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-slate-900 text-sm">Transporter (Billed From)</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="sm:col-span-2">
              <label className="block font-medium text-slate-700 mb-1">Company Name</label>
              <input
                type="text"
                value={transporterCompanyName}
                onChange={(e) => setTransporterCompanyName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold text-slate-900"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-medium text-slate-700 mb-1">Company Address</label>
              <input
                type="text"
                value={transporterAddress}
                onChange={(e) => setTransporterAddress(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Phone / Mobile</label>
              <input
                type="text"
                value={transporterPhone}
                onChange={(e) => setTransporterPhone(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Transporter NTN #</label>
              <input
                type="text"
                value={transporterNtn}
                onChange={(e) => setTransporterNtn(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-900"
              />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Invoice Number</label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold font-mono text-blue-700"
                placeholder="IK-BSP-26-004-Punjab"
                required
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Invoice Date</label>
              <input
                type="text"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                placeholder="08.10.2026"
                required
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Delivery Code</label>
              <input
                type="text"
                value={deliveryCode}
                onChange={(e) => setDeliveryCode(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg uppercase font-mono text-slate-900"
                placeholder="CD"
              />
            </div>
          </div>
        </div>

        {/* Right: Customer Details */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-slate-900 text-sm">Customer (Billed To)</h3>
            </div>
            {customers.length > 0 && (
              <select
                value={selectedCustomerId}
                onChange={(e) => handleCustomerChange(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-slate-700 font-medium cursor-pointer"
              >
                <option value="">Select Existing Customer...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Customer / Company Name</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="M/S BULLEH SHAH PACKAGING (PVT) LTD"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-900 uppercase"
                required
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Delivery / Plant Address</label>
              <input
                type="text"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="Shahrah-e-Roomi, P.O Amer Sidhu Lahore"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Customer NTN #</label>
                <input
                  type="text"
                  value={customerNtn}
                  onChange={(e) => setCustomerNtn(e.target.value)}
                  placeholder="3000673-2"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-900"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Customer STRN #</label>
                <input
                  type="text"
                  value={customerStrn}
                  onChange={(e) => setCustomerStrn(e.target.value)}
                  placeholder="1700300067314"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-900"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Payment Status</label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                >
                  <option value="unpaid">Unpaid / In Process</option>
                  <option value="paid">Paid</option>
                  <option value="partial">Partial Payment</option>
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Sales Tax Label</label>
                <input
                  type="text"
                  value={taxName}
                  onChange={(e) => setTaxName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- STEP 1: AUTOMATIC INVOICE POPULATION USING DISPATCH NO ---------------- */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-5 rounded-2xl shadow-md space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-400/30 flex items-center justify-center font-black text-xs">
              1
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-wide">
                Step 1: Automatic Invoice Population using Dispatch No.
              </h3>
              <p className="text-xs text-blue-200 mt-0.5">
                Enter or select a Dispatch No. The system instantly auto-fills Freight Order, Date, Vehicle, Vehicle Type, Destination, and Freight Rate.
              </p>
            </div>
          </div>

          <div className="text-xs text-blue-300 font-medium">
            Master Records Available: <strong className="text-white font-mono">{dispatchMasterRates.length}</strong>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
          <div className="relative flex-1">
            <input
              type="text"
              list="dispatch-no-datalist"
              value={quickDispatchInput}
              onChange={(e) => setQuickDispatchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleLookupDispatch(quickDispatchInput);
                }
              }}
              placeholder="Enter Dispatch No. (e.g. CD81052367, CD81052735, B.NO: 11)..."
              className="w-full pl-3 pr-24 py-2.5 bg-slate-800/90 border border-blue-400/30 rounded-xl text-xs sm:text-sm font-mono font-bold text-white placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
            />
            <datalist id="dispatch-no-datalist">
              {dispatchMasterRates.slice(0, 50).map((r) => (
                <option key={r.id} value={r.dispatchNo}>
                  {r.destination} · {r.vehicleType} · Rs. {r.freightRate}
                </option>
              ))}
            </datalist>
          </div>

          <button
            type="button"
            disabled={isLookingUp || !quickDispatchInput.trim()}
            onClick={() => handleLookupDispatch(quickDispatchInput)}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all cursor-pointer whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isLookingUp ? 'Searching...' : 'Auto-Populate Trip'}</span>
          </button>
        </div>

        {/* Auto-Populate Notification Banner */}
        {autoPopulateAlert && (
          <div
            className={`p-3 rounded-xl text-xs flex items-start gap-2.5 transition-all ${
              autoPopulateAlert.type === 'success'
                ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30'
                : autoPopulateAlert.type === 'warning'
                ? 'bg-amber-500/20 text-amber-200 border border-amber-500/30'
                : 'bg-blue-500/20 text-blue-200 border border-blue-500/30'
            }`}
          >
            {autoPopulateAlert.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : autoPopulateAlert.type === 'warning' ? (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className="font-semibold">{autoPopulateAlert.message}</p>
              {autoPopulateAlert.details && <p className="mt-0.5 opacity-90">{autoPopulateAlert.details}</p>}
            </div>
            <button
              type="button"
              onClick={() => setAutoPopulateAlert(null)}
              className="text-white/60 hover:text-white p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Itemized Deliveries Table Editor */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <span>Trip Deliveries & Freight Ledger</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                {items.length} items
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              All 7 auto-populated fields remain completely editable. Calculations update dynamically.
            </p>
          </div>

          <button
            type="button"
            onClick={addItemRow}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Trip Row
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <th className="px-2 py-2 w-10 text-center">#</th>
                <th className="px-2 py-2 min-w-[130px]">1. CD Despatch</th>
                <th className="px-2 py-2 min-w-[110px]">2. Freight Order</th>
                <th className="px-2 py-2 min-w-[100px]">3. Loading Date</th>
                <th className="px-2 py-2 min-w-[100px]">Offloading</th>
                <th className="px-2 py-2 min-w-[110px]">4. Vehicle No</th>
                <th className="px-2 py-2 min-w-[140px]">5. Vehicle Type</th>
                <th className="px-2 py-2 min-w-[160px]">Distributor Name</th>
                <th className="px-2 py-2 min-w-[120px]">6. Destination</th>
                <th className="px-2 py-2 min-w-[115px] text-right">7. Freight (Rs.)</th>
                <th className="px-2 py-2 min-w-[85px] text-right">Unloading</th>
                <th className="px-2 py-2 min-w-[85px] text-right">Move</th>
                <th className="px-2 py-2 min-w-[100px] text-right">Halting Cust</th>
                <th className="px-2 py-2 min-w-[100px] text-right">Halting Fact</th>
                <th className="px-2 py-2 min-w-[100px] text-right font-extrabold text-slate-900">Sub Total</th>
                <th className="px-2 py-2 w-16 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.map((item, index) => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-2 py-1.5 text-center font-bold text-slate-500">{index + 1}</td>

                  {/* 1. CD Despatch (with inline lookup button) */}
                  <td className="px-1.5 py-1">
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={item.cdDespatch}
                        onChange={(e) => handleItemChange(index, 'cdDespatch', e.target.value)}
                        onBlur={() => {
                          if (item.cdDespatch && (!item.freight || item.freight === 0)) {
                            handleLookupDispatch(item.cdDespatch, index);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleLookupDispatch(item.cdDespatch, index);
                          }
                        }}
                        placeholder="CD81052367"
                        className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-mono font-bold text-blue-700"
                        title="Enter Dispatch No. and press Enter to auto-fill"
                      />
                      <button
                        type="button"
                        onClick={() => handleLookupDispatch(item.cdDespatch, index)}
                        className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-100"
                        title="Auto-fill this trip from master rate sheet"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>

                  {/* 2. Freight Order */}
                  <td className="px-1.5 py-1">
                    <input
                      type="text"
                      value={item.freightOrder}
                      onChange={(e) => handleItemChange(index, 'freightOrder', e.target.value)}
                      placeholder="6100000000"
                      className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-mono text-slate-800"
                    />
                  </td>

                  {/* 3. Loading Date */}
                  <td className="px-1.5 py-1">
                    <input
                      type="text"
                      value={item.loadingDate}
                      onChange={(e) => handleItemChange(index, 'loadingDate', e.target.value)}
                      placeholder="27.09.2026"
                      className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-mono"
                    />
                  </td>

                  {/* Offloading Date */}
                  <td className="px-1.5 py-1">
                    <input
                      type="text"
                      value={item.offloadingDate}
                      onChange={(e) => handleItemChange(index, 'offloadingDate', e.target.value)}
                      placeholder="29.09.2026"
                      className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-mono"
                    />
                  </td>

                  {/* 4. Vehicle No */}
                  <td className="px-1.5 py-1">
                    <input
                      type="text"
                      value={item.vehicleNo}
                      onChange={(e) => handleItemChange(index, 'vehicleNo', e.target.value.toUpperCase())}
                      placeholder="LZR 1089"
                      className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-mono font-bold text-slate-900 uppercase"
                    />
                  </td>

                  {/* 5. Vehicle Type (Dynamic Dropdown + Inline Add Option) */}
                  <td className="px-1.5 py-1">
                    <div className="flex items-center gap-1">
                      <select
                        value={item.vehicleType || '20 Ft Vehicle'}
                        onChange={(e) => {
                          if (e.target.value === '__ADD_NEW__') {
                            setNewVehicleTypeModal({ isOpen: true, targetItemIndex: index });
                          } else {
                            handleItemChange(index, 'vehicleType', e.target.value);
                          }
                        }}
                        className="w-full px-1.5 py-1 border border-slate-300 rounded text-[11px] font-medium"
                      >
                        {vehicleTypes
                          .filter((vt) => vt.status !== 'inactive' || vt.name === item.vehicleType)
                          .map((vt) => (
                            <option key={vt.id} value={vt.name}>
                              {vt.name}
                            </option>
                          ))}
                        <option value="__ADD_NEW__" className="font-bold text-blue-600">
                          + Add New Vehicle Type...
                        </option>
                      </select>
                    </div>
                  </td>

                  {/* Distributor Name */}
                  <td className="px-1.5 py-1">
                    <input
                      type="text"
                      value={item.distributorName}
                      onChange={(e) => handleItemChange(index, 'distributorName', e.target.value.toUpperCase())}
                      placeholder="PEPSI COLA INTL"
                      className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-medium"
                    />
                  </td>

                  {/* 6. Destination City */}
                  <td className="px-1.5 py-1">
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={item.city}
                        onChange={(e) => handleItemChange(index, 'city', e.target.value.toUpperCase())}
                        placeholder="MULTAN"
                        className="w-full px-2 py-1 border border-slate-300 rounded text-xs uppercase font-semibold"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const match = matchFreightRate(
                            item.city,
                            item.vehicleType || '20 Ft Vehicle',
                            customerName,
                            customerRates,
                            cityRates
                          );
                          if (match.matchedRate !== null) {
                            handleItemChange(index, 'freight', match.matchedRate);
                          } else {
                            alert(`No rate found in rate sheets for Destination: "${item.city}" and Vehicle: "${item.vehicleType || '20 Ft Vehicle'}". You can enter freight manually.`);
                          }
                        }}
                        title="Auto-match rate from agreed tariff tables"
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>

                  {/* 7. Freight Rate (PKR) */}
                  <td className="px-1.5 py-1">
                    <input
                      type="number"
                      value={item.freight || ''}
                      onChange={(e) => handleItemChange(index, 'freight', Number(e.target.value))}
                      placeholder="0"
                      className={`w-full px-2 py-1 border rounded text-xs text-right font-mono font-bold ${
                        getItemRateWarning(item) ? 'border-amber-400 bg-amber-50/50 text-amber-900' : 'border-slate-300 text-slate-900'
                      }`}
                    />
                    {getItemRateWarning(item) && (
                      <span
                        className="text-[9px] text-amber-600 block text-right font-semibold leading-none mt-0.5"
                        title={`Agreed standard rate is Rs. ${formatCurrencyPKR(getItemRateWarning(item)!.standardRate)} (${getItemRateWarning(item)!.source})`}
                      >
                        ⚠️ -{getItemRateWarning(item)!.pct}%
                      </span>
                    )}
                  </td>

                  {/* Unloading */}
                  <td className="px-1.5 py-1">
                    <input
                      type="number"
                      value={item.unloading || ''}
                      onChange={(e) => handleItemChange(index, 'unloading', Number(e.target.value))}
                      placeholder="0"
                      className="w-full px-2 py-1 border border-slate-300 rounded text-xs text-right font-mono"
                    />
                  </td>

                  {/* Move */}
                  <td className="px-1.5 py-1">
                    <input
                      type="number"
                      value={item.move || ''}
                      onChange={(e) => handleItemChange(index, 'move', Number(e.target.value))}
                      placeholder="0"
                      className="w-full px-2 py-1 border border-slate-300 rounded text-xs text-right font-mono"
                    />
                  </td>

                  {/* Halting Customer */}
                  <td className="px-1.5 py-1">
                    <input
                      type="number"
                      value={item.haltingCustomer || ''}
                      onChange={(e) => handleItemChange(index, 'haltingCustomer', Number(e.target.value))}
                      placeholder="0"
                      className="w-full px-2 py-1 border border-slate-300 rounded text-xs text-right font-mono"
                    />
                  </td>

                  {/* Halting Factory */}
                  <td className="px-1.5 py-1">
                    <input
                      type="number"
                      value={item.haltingFactory || ''}
                      onChange={(e) => handleItemChange(index, 'haltingFactory', Number(e.target.value))}
                      placeholder="0"
                      className="w-full px-2 py-1 border border-slate-300 rounded text-xs text-right font-mono"
                    />
                  </td>

                  {/* Sub Total */}
                  <td className="px-2 py-1 text-right font-mono font-bold text-slate-900 bg-slate-50/50">
                    {formatCurrencyPKR(item.subTotal)}
                  </td>

                  {/* Actions */}
                  <td className="px-1 py-1 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => duplicateItemRow(index)}
                        title="Duplicate Row"
                        className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItemRow(index)}
                        title="Delete Row"
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Financial Summary & Tax Calculation Box */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-6 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="space-y-3 max-w-md w-full">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Invoice Notes / Internal Memo</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. October deliveries for Bulleh Shah Packaging Kasur."
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <Calculator className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Formula: Sub Total = Freight + Unloading + Move + Halting (Cust + Fact)</span>
          </div>
        </div>

        {/* Totals Breakdown */}
        <div className="w-full sm:w-80 space-y-2 border border-slate-200 p-4 rounded-xl bg-slate-50 text-xs">
          <div className="flex justify-between text-slate-600">
            <span>Total Freight:</span>
            <span className="font-semibold font-mono">{formatCurrencyPKR(totals.freightTotal)}</span>
          </div>
          {totals.moveTotal > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Movement Charges:</span>
              <span className="font-semibold font-mono">{formatCurrencyPKR(totals.moveTotal)}</span>
            </div>
          )}
          {totals.haltingCustomerTotal > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Halting Customer:</span>
              <span className="font-semibold font-mono">{formatCurrencyPKR(totals.haltingCustomerTotal)}</span>
            </div>
          )}
          {totals.haltingFactoryTotal > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Halting Factory:</span>
              <span className="font-semibold font-mono">{formatCurrencyPKR(totals.haltingFactoryTotal)}</span>
            </div>
          )}

          <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-800 text-sm">
            <span>Sub Total Rs.:</span>
            <span className="font-mono">{formatCurrencyPKR(totals.subTotal)}</span>
          </div>

          <div className="flex justify-between items-center text-slate-600 pt-1">
            <div className="flex items-center gap-1.5">
              <span>{taxName}:</span>
              <input
                type="number"
                min="0"
                max="100"
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value))}
                className="w-12 px-1 py-0.5 border border-slate-300 rounded text-center text-xs font-bold"
              />
              <span>%</span>
            </div>
            <span className="font-semibold font-mono">{formatCurrencyPKR(totals.taxAmount)}</span>
          </div>

          <div className="pt-2 border-t-2 border-slate-900 flex justify-between font-extrabold text-base text-blue-700">
            <span>Grand Total:</span>
            <span className="font-mono">{formatCurrencyPKR(totals.grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* ---------------- MODAL: MULTIPLE MATCHES FOR DISPATCH NO ---------------- */}
      {multiMatchModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Multiple Records Found for Dispatch #{multiMatchModal.dispatchNo}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select the exact freight record you wish to populate for this invoice delivery:
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMultiMatchModal({ isOpen: false, dispatchNo: '', matches: [] })}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Order No.</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Vehicle</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Destination</th>
                    <th className="py-2.5 px-3 text-right">Freight Rate</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {multiMatchModal.matches.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-semibold">{m.freightOrderNo || '—'}</td>
                      <td className="py-2.5 px-3 font-mono">{m.loadingDate || '—'}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{m.vehicleNo || '—'}</td>
                      <td className="py-2.5 px-3">{m.vehicleType || '—'}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{m.destination || '—'}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        Rs. {formatCurrencyPKR(m.freightRate)}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            let idx = multiMatchModal.targetIndex;
                            if (idx === undefined) {
                              const firstItem = items[0];
                              if (items.length === 1 && !firstItem.cdDespatch) {
                                idx = 0;
                              } else {
                                idx = items.length;
                              }
                            }
                            applyDispatchRecordToItem(idx, m);
                            setMultiMatchModal({ isOpen: false, dispatchNo: '', matches: [] });
                          }}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs cursor-pointer shadow-2xs"
                        >
                          Use Record
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setMultiMatchModal({ isOpen: false, dispatchNo: '', matches: [] })}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- MODAL: INLINE NEW VEHICLE TYPE ---------------- */}
      {newVehicleTypeModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <span>Add New Vehicle Type</span>
              </h3>
              <button
                type="button"
                onClick={() => setNewVehicleTypeModal({ isOpen: false, targetItemIndex: null })}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Enter the new vehicle category. It will be added to your transporter list and available for all future invoices.
            </p>

            <form onSubmit={handleAddNewVehicleType} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Vehicle Type / Size</label>
                <input
                  type="text"
                  value={newTypeNameInput}
                  onChange={(e) => setNewTypeNameInput(e.target.value)}
                  placeholder="e.g. 50 Ft Trailer or Mazda 16 Ft"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 font-semibold focus:outline-none focus:border-blue-500"
                  required
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewVehicleTypeModal({ isOpen: false, targetItemIndex: null })}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 shadow-sm"
                >
                  Save & Apply
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- MODAL: DUPLICATE DISPATCH WARNING ON SAVE ---------------- */}
      {duplicateWarningOnSave.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-amber-300 space-y-4">
            <div className="flex items-center gap-2.5 text-amber-900">
              <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
              <div>
                <h3 className="font-bold text-base text-slate-900">Duplicate Dispatch Warning</h3>
                <p className="text-xs text-slate-500">
                  One or more entered dispatches have already been billed previously.
                </p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs space-y-2">
              <p className="font-semibold text-amber-950">
                The following Dispatch No.(s) were detected in existing invoices:
              </p>
              <ul className="space-y-1 text-amber-900 list-disc list-inside font-mono">
                {duplicateWarningOnSave.duplicates.map((d, idx) => (
                  <li key={idx}>
                    <span className="font-bold">{d.dispatchNo}</span> (billed in: {d.invoices.join(', ')})
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-amber-800 pt-1">
                If this is an intentional supplementary invoice, split shipment, or authorized correction, you can proceed. Otherwise, click Review to check your entries.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDuplicateWarningOnSave({ isOpen: false, duplicates: [] })}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Review Dispatches
              </button>
              <button
                type="button"
                onClick={async () => {
                  setDuplicateWarningOnSave({ isOpen: false, duplicates: [] });
                  await performSaveInvoice();
                }}
                className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-sm cursor-pointer"
              >
                Proceed & Save Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
};
