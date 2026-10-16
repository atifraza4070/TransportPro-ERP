import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { Invoice } from '../../types';
import { formatCurrencyPKR } from '../../utils/billing-calculations';
import { generateInvoiceExcel, downloadExcelFile } from '../../utils/excel-generator';
import {
  Plus,
  Search,
  FileSpreadsheet,
  Printer,
  Edit2,
  Trash2,
  TrendingUp,
  Receipt,
  Truck,
  Clock,
  CheckCircle2,
  AlertCircle,
  Download,
  Building,
  Mail,
} from 'lucide-react';

interface InvoiceListProps {
  onCreateNew: () => void;
  onViewPrint: (invoice: Invoice) => void;
  onEdit: (invoice: Invoice) => void;
}

export const InvoiceList: React.FC<InvoiceListProps> = ({ onCreateNew, onViewPrint, onEdit }) => {
  const { token, user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'unpaid' | 'partial'>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchInvoices = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch('/api/invoices', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.invoices || []);
      }
    } catch (err) {
      console.error('Error loading invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [token]);

  const handleDelete = async (invoice: Invoice) => {
    if (!token) return;
    const confirmDelete = window.confirm(
      `Are you sure you want to delete Invoice "${invoice.invoiceNumber}"? This action cannot be undone.`
    );
    if (!confirmDelete) return;

    try {
      setDeletingId(invoice.id);
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setInvoices(invoices.filter((i) => i.id !== invoice.id));
      } else {
        alert('Failed to delete invoice.');
      }
    } catch (err) {
      console.error('Failed to delete invoice:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleExportExcel = (invoice: Invoice) => {
    const data = generateInvoiceExcel(invoice);
    downloadExcelFile(data, `${invoice.invoiceNumber}.xlsx`);
  };

  // Filtered List
  const filtered = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.items.some(
        (it) =>
          it.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
          it.vehicleNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
          it.distributorName.toLowerCase().includes(searchTerm.toLowerCase())
      );

    const matchesStatus = statusFilter === 'all' || inv.paymentStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // KPI calculations
  const totalBilled = invoices.reduce((acc, inv) => acc + inv.grandTotal, 0);
  const totalSubTotal = invoices.reduce((acc, inv) => acc + inv.subTotal, 0);
  const totalHalting = invoices.reduce(
    (acc, inv) => acc + (inv.haltingCustomerTotal || 0) + (inv.haltingFactoryTotal || 0),
    0
  );
  const totalMove = invoices.reduce((acc, inv) => acc + (inv.moveTotal || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Welcome & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>Invoices & Billing Sheets</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage trip invoices, halting charges, and export Excel billing sheets for transporters.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onCreateNew}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" />
            Create Invoice
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Total Invoiced (PKR)</p>
            <h3 className="text-lg font-bold text-slate-900">{formatCurrencyPKR(totalBilled)}</h3>
            <p className="text-[11px] text-slate-400">{invoices.length} invoices registered</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Sub Total Freight</p>
            <h3 className="text-lg font-bold text-slate-900">{formatCurrencyPKR(totalSubTotal)}</h3>
            <p className="text-[11px] text-emerald-600 font-medium">Verified calculations</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Halting Charges</p>
            <h3 className="text-lg font-bold text-slate-900">{formatCurrencyPKR(totalHalting)}</h3>
            <p className="text-[11px] text-slate-400">Customer & factory halting</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Movement Charges</p>
            <h3 className="text-lg font-bold text-slate-900">{formatCurrencyPKR(totalMove)}</h3>
            <p className="text-[11px] text-slate-400">Special movement trips</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by invoice #, customer, vehicle, destination city..."
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          {(['all', 'paid', 'unpaid', 'partial'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                statusFilter === st
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3.5">Invoice #</th>
                <th className="px-4 py-3.5">Date</th>
                <th className="px-4 py-3.5">Customer Name</th>
                <th className="px-4 py-3.5 text-center">Deliveries</th>
                <th className="px-4 py-3.5 text-right">Sub Total</th>
                <th className="px-4 py-3.5 text-right">Punjab 15% Tex</th>
                <th className="px-4 py-3.5 text-right font-bold text-slate-900">Grand Total</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                    Loading invoices...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-700">No invoices found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {searchTerm ? 'Try adjusting your search criteria' : 'Create your first transport billing sheet'}
                    </p>
                    <button
                      onClick={onCreateNew}
                      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      New Invoice
                    </button>
                  </td>
                </tr>
              ) : (
                filtered.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-50/80 transition-colors">
                    <td
                      onClick={() => onViewPrint(invoice)}
                      className="px-4 py-3 font-mono font-bold text-blue-700 hover:underline cursor-pointer"
                    >
                      {invoice.invoiceNumber}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{invoice.invoiceDate}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate max-w-[200px]">{invoice.customerName}</span>
                      </div>
                      <span className="text-[11px] text-slate-400 block font-normal font-mono">
                        NTN: {invoice.customerNtn || 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                        {invoice.items?.length || 0} trips
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-700">
                      {formatCurrencyPKR(invoice.subTotal)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {formatCurrencyPKR(invoice.taxAmount)}
                    </td>
                    <td className="px-4 py-3 text-right font-extrabold text-slate-900 font-mono">
                      {formatCurrencyPKR(invoice.grandTotal)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                          invoice.paymentStatus === 'paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : invoice.paymentStatus === 'partial'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {invoice.paymentStatus === 'paid' && <CheckCircle2 className="w-3 h-3" />}
                        {invoice.paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onViewPrint(invoice)}
                          title="View / Print Document"
                          className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onViewPrint(invoice)}
                          title="Email Invoice"
                          className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <Mail className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleExportExcel(invoice)}
                          title="Export to Excel (.xlsx)"
                          className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        >
                          <FileSpreadsheet className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onEdit(invoice)}
                          title="Edit Invoice"
                          className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(invoice)}
                          disabled={deletingId === invoice.id}
                          title="Delete Invoice"
                          className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
