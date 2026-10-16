import React, { useState } from 'react';
import type { Invoice } from '../../types';
import { formatCurrencyPKR } from '../../utils/billing-calculations';
import { generateInvoiceExcel, downloadExcelFile } from '../../utils/excel-generator';
import { downloadInvoicePdf, getInvoicePdfBase64 } from '../../utils/invoice-pdf';
import { TransportRouteMap } from '../maps/TransportRouteMap';
import {
  Printer,
  Download,
  ArrowLeft,
  Edit3,
  CheckCircle,
  MapPin,
  Mail,
  Send,
  Paperclip,
  X,
  FileText,
  AlertCircle,
  CheckCircle2,
  FileCheck,
} from 'lucide-react';

interface InvoicePrintViewProps {
  invoice: Invoice;
  onBack: () => void;
  onEdit: (invoice: Invoice) => void;
}

interface AttachedFile {
  name: string;
  size: number;
  type: string;
  base64: string;
}

export const InvoicePrintView: React.FC<InvoicePrintViewProps> = ({ invoice, onBack, onEdit }) => {
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [showRouteMap, setShowRouteMap] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);

  // Email form state
  const defaultToEmail = invoice.customerEmail || (invoice.customerName.includes('BULLEH') ? 'billing@bullehshah.com.pk' : 'accounts@customer.com');
  const [emailTo, setEmailTo] = useState(defaultToEmail);
  const [emailCc, setEmailCc] = useState('');
  const [emailBcc, setEmailBcc] = useState('');
  const [emailSubject, setEmailSubject] = useState(
    `Transport Invoice ${invoice.invoiceNumber} - ${invoice.transporterCompanyName}`
  );
  const [emailBody, setEmailBody] = useState(
    `Dear Accounts Team,\n\nPlease find attached the official transport billing invoice ${invoice.invoiceNumber} for deliveries.\n\nSummary:\n- Transporter: ${invoice.transporterCompanyName}\n- Customer: ${invoice.customerName}\n- Invoice Date: ${invoice.invoiceDate}\n- Total Deliveries: ${invoice.items.length}\n- Sub Total: Rs. ${formatCurrencyPKR(invoice.subTotal)}\n- Sales Tax (${invoice.taxRate ?? 15}%): Rs. ${formatCurrencyPKR(invoice.taxAmount)}\n- Grand Total: Rs. ${formatCurrencyPKR(invoice.grandTotal)}\n\nPlease process for payment according to agreed credit terms.\n\nRegards,\nBilling & Accounts Department\n${invoice.transporterCompanyName}\nPhone: ${invoice.transporterPhone}`
  );
  const [additionalFiles, setAdditionalFiles] = useState<AttachedFile[]>([]);
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Print handler
  const handlePrint = () => {
    window.print();
  };

  // Download PDF
  const handleDownloadPdf = () => {
    downloadInvoicePdf(invoice, orientation);
  };

  // Download Excel
  const handleDownloadExcel = () => {
    const data = generateInvoiceExcel(invoice);
    downloadExcelFile(data, `${invoice.invoiceNumber}.xlsx`);
  };

  // Handle additional file attachments
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      // 10MB limit per file
      if (file.size > 10 * 1024 * 1024) {
        alert(`File "${file.name}" exceeds the 10MB limit.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1] || '';
        setAdditionalFiles((prev) => [
          ...prev,
          {
            name: file.name,
            size: file.size,
            type: file.type || 'application/octet-stream',
            base64,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const removeAdditionalFile = (index: number) => {
    setAdditionalFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Send Email Handler
  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailTo) return;

    setEmailSending(true);
    setEmailResult(null);

    try {
      // 1. Generate real invoice PDF in base64
      const invoicePdfBase64 = getInvoicePdfBase64(invoice, orientation);

      // 2. Prepare payload
      const payload = {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        to: emailTo.trim(),
        cc: emailCc.trim() || undefined,
        bcc: emailBcc.trim() || undefined,
        subject: emailSubject.trim(),
        body: emailBody.trim(),
        invoicePdf: {
          filename: `${invoice.invoiceNumber}.pdf`,
          base64: invoicePdfBase64,
        },
        attachments: additionalFiles.map((f) => ({
          filename: f.name,
          base64: f.base64,
          contentType: f.type,
        })),
      };

      const token = localStorage.getItem('fleetbill_token');
      const res = await fetch(`/api/invoices/${invoice.id}/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setEmailResult({
          type: 'success',
          message: data.message || `Invoice ${invoice.invoiceNumber} successfully dispatched to ${emailTo}.`,
        });
        setTimeout(() => {
          setShowEmailModal(false);
          setEmailResult(null);
        }, 2500);
      } else {
        setEmailResult({
          type: 'error',
          message: data.error || 'Failed to dispatch email. Please check recipient addresses.',
        });
      }
    } catch (err: any) {
      setEmailResult({
        type: 'error',
        message: err.message || 'Network error attempting to send invoice email.',
      });
    } finally {
      setEmailSending(false);
    }
  };

  const primaryCity = invoice.items[0]?.city || 'Multan';
  const originCity = invoice.transporterAddress?.includes('KASUR') ? 'Kasur' : 'Lahore';

  return (
    <div className="space-y-6">
      {/* Dynamic Print Styles for Landscape and Portrait */}
      <style>{`
        @media print {
          @page {
            size: ${orientation};
            margin: 6mm 8mm;
          }
          header, aside, nav, button, .print-hidden, .print\\:hidden {
            display: none !important;
          }
          html, body {
            background-color: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          .invoice-sheet {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          table {
            width: 100% !important;
            page-break-inside: auto;
            font-size: ${orientation === 'portrait' ? '9px' : '10.5px'} !important;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          thead {
            display: table-header-group;
          }
          tfoot {
            display: table-footer-group;
          }
        }
      `}</style>

      {/* Top Action Bar (hidden in print) */}
      <div className="print:hidden bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Billing Invoice
              </span>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-none">
                {invoice.invoiceNumber}
              </h1>
            </div>
          </div>

          {/* Orientation & Format Switcher */}
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
            <span className="text-xs font-semibold text-slate-600 px-2">Print Page:</span>
            <button
              type="button"
              onClick={() => setOrientation('landscape')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                orientation === 'landscape'
                  ? 'bg-white text-blue-700 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Landscape (Recommended)
            </button>
            <button
              type="button"
              onClick={() => setOrientation('portrait')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                orientation === 'portrait'
                  ? 'bg-white text-blue-700 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Portrait
            </button>
          </div>

          {/* Primary Operations: PRINT & EMAIL TOGETHER */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Invoice</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowEmailModal(true);
                setEmailResult(null);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-500/20 transition-all cursor-pointer"
            >
              <Mail className="w-4 h-4" />
              <span>Email Invoice</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              title="Download PDF"
            >
              <FileText className="w-4 h-4 text-slate-600" />
              <span>Save PDF</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadExcel}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-xl transition-colors"
              title="Export Excel"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>Excel (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={() => setShowRouteMap(true)}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-blue-800 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-xl transition-colors"
            >
              <MapPin className="w-4 h-4 text-blue-600" />
              <span>Maps Route</span>
            </button>

            <button
              type="button"
              onClick={() => onEdit(invoice)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors"
            >
              <Edit3 className="w-4 h-4 text-slate-500" />
              <span>Edit</span>
            </button>
          </div>
        </div>
      </div>

      {/* Google Maps Route Modal */}
      {showRouteMap && (
        <div className="print:hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <TransportRouteMap
            origin={originCity}
            destination={primaryCity}
            distributorName={invoice.items[0]?.distributorName}
            onClose={() => setShowRouteMap(false)}
          />
        </div>
      )}

      {/* EMAIL COMPOSER MODAL */}
      {showEmailModal && (
        <div className="print:hidden fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-none">Email Transport Invoice</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Send invoice {invoice.invoiceNumber} with attached official PDF & supporting documents.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {emailResult && (
              <div
                className={`p-4 text-xs flex items-center gap-2.5 ${
                  emailResult.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-b border-rose-200'
                }`}
              >
                {emailResult.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{emailResult.message}</span>
              </div>
            )}

            <form onSubmit={handleSendEmail} className="p-5 sm:p-6 space-y-4 text-xs">
              {/* To / CC / BCC */}
              <div className="space-y-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">To: Recipient Email Address *</label>
                  <input
                    type="email"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    placeholder="billing@bullehshah.com.pk or accounts@customer.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 font-medium focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">CC: (Optional)</label>
                    <input
                      type="text"
                      value={emailCc}
                      onChange={(e) => setEmailCc(e.target.value)}
                      placeholder="logistics@company.com"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">BCC: (Optional)</label>
                    <input
                      type="text"
                      value={emailBcc}
                      onChange={(e) => setEmailBcc(e.target.value)}
                      placeholder="archive@mytransports.com"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Subject Line</label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 font-medium focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email Message</label>
                  <textarea
                    rows={6}
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-xl text-slate-900 font-mono text-xs focus:outline-none focus:border-indigo-500 leading-relaxed"
                  />
                </div>
              </div>

              {/* Attachments Section */}
              <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Attachments</span>
                  </span>
                  <label className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer">
                    <Paperclip className="w-3 h-3" />
                    <span>+ Add Delivery Slips / Documents</span>
                    <input
                      type="file"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                      accept=".pdf,.png,.jpg,.jpeg,.xlsx,.doc,.docx"
                    />
                  </label>
                </div>

                {/* Primary Invoice PDF Auto-Attachment */}
                <div className="flex items-center justify-between p-2.5 bg-white border border-indigo-200 rounded-lg shadow-xs">
                  <div className="flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-indigo-600" />
                    <div>
                      <span className="font-bold text-slate-900">{invoice.invoiceNumber}.pdf</span>
                      <span className="text-[10px] text-indigo-600 block">
                        Official Invoice PDF (Auto-generated in {orientation.toUpperCase()})
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md">
                    Attached
                  </span>
                </div>

                {/* Additional Attached Files */}
                {additionalFiles.map((f, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 bg-white border border-slate-200 rounded-lg text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="text-slate-800 font-medium truncate">{f.name}</span>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        ({Math.round(f.size / 1024)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAdditionalFile(idx)}
                      className="text-rose-500 hover:text-rose-700 p-1"
                      title="Remove attachment"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEmailModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={emailSending || !emailTo}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-500/20 disabled:opacity-50 transition-all cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>{emailSending ? 'Dispatching Email...' : 'Send Invoice Email'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Official Invoice Document Canvas */}
      <div className="invoice-sheet bg-white p-6 sm:p-10 rounded-2xl border border-slate-300 shadow-xl text-slate-900 font-sans print:p-0 print:border-none print:shadow-none print:text-black">
        {/* Document Header */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4 border-b-2 border-slate-800">
          {/* Left: Transporter details */}
          <div>
            <div className="flex items-start gap-4">
              {invoice.transporterLogo && (
                <img
                  src={invoice.transporterLogo}
                  alt="Company Logo"
                  className="w-16 h-16 object-contain rounded-lg border border-slate-200 p-1"
                />
              )}
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">
                  {invoice.transporterCompanyName || 'IK LOGISTICS (SMC) PVT LTD'}
                </h2>
                <p className="text-xs text-slate-600 font-medium mt-0.5">
                  {invoice.transporterAddress || 'BSP GATE NO.1, 10KM KRK ROAD KASUR'}
                </p>
                <p className="text-xs text-slate-600 mt-0.5">
                  <span className="font-semibold">Ph:</span> {invoice.transporterPhone || '0301 6411664'} &nbsp;|&nbsp;
                  <span className="font-semibold">E.Mail:</span> {invoice.transporterEmail || 'iklogisticsofficial@gmail.com'}
                </p>
                <div className="flex gap-4 mt-1.5 text-xs">
                  <span className="font-bold text-slate-800">
                    NTN # <span className="font-mono text-blue-700">{invoice.transporterNtn || 'J-622143'}</span>
                  </span>
                  <span className="font-bold text-slate-800">
                    STRN # <span className="font-mono text-blue-700">{invoice.transporterStrn || '1700300067314'}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Customer & Invoice ID info */}
          <div className="flex flex-col justify-between items-start md:items-end text-left md:text-right">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Customer / Billed To</span>
              <h3 className="text-sm font-bold text-slate-900 uppercase">
                {invoice.customerName || 'M/S BULLEH SHAH PACKAGING (PVT) LTD'}
              </h3>
              <p className="text-xs text-slate-600 max-w-xs md:ml-auto">
                {invoice.customerAddress || 'Shahrah-e-Roomi, P.O Amer Sidhu Lahore'}
              </p>
              <div className="mt-1 text-xs text-slate-600">
                <span className="font-semibold">Customer NTN:</span> <span className="font-mono">{invoice.customerNtn || '3000673-2'}</span> &nbsp;|&nbsp;
                <span className="font-semibold">STRN:</span> <span className="font-mono">{invoice.customerStrn || '1700300067314'}</span>
              </div>
            </div>

            <div className="mt-3 md:mt-0 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-left md:text-right w-full md:w-auto">
              <div className="text-xs">
                <span className="font-semibold text-slate-500">Invoice No:</span>{' '}
                <span className="font-mono font-bold text-slate-900">{invoice.invoiceNumber}</span>
              </div>
              <div className="text-xs mt-0.5">
                <span className="font-semibold text-slate-500">Date:</span>{' '}
                <span className="font-bold text-slate-900">{invoice.invoiceDate}</span>{' '}
                <span className="text-[11px] font-mono font-semibold text-slate-600">{invoice.deliveryCode || 'CD'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Deliveries & Billing Table */}
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-y-2 border-slate-800 text-[11px] font-bold text-slate-900">
                <th className="py-2.5 px-2 text-center w-8">SR</th>
                <th className="py-2.5 px-2">CD DESPATCH</th>
                <th className="py-2.5 px-2">FREIGHT ORDER</th>
                <th className="py-2.5 px-2">LOADING</th>
                <th className="py-2.5 px-2">OFFLOAD</th>
                <th className="py-2.5 px-2">VEHICLE NO</th>
                <th className="py-2.5 px-2">VEHICLE TYPE</th>
                <th className="py-2.5 px-2">DISTRIBUTOR / DESTINATION</th>
                <th className="py-2.5 px-2">CITY</th>
                <th className="py-2.5 px-2 text-right">FREIGHT</th>
                <th className="py-2.5 px-2 text-right">UNLOAD</th>
                <th className="py-2.5 px-2 text-right">MOVE</th>
                <th className="py-2.5 px-2 text-right">HALT (C)</th>
                <th className="py-2.5 px-2 text-right">HALT (F)</th>
                <th className="py-2.5 px-2 text-right bg-slate-200/70">TOTAL (RS)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
              {invoice.items.map((item, idx) => (
                <tr key={item.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                  <td className="py-2 px-2 text-center font-sans font-semibold text-slate-500">{item.sr || idx + 1}</td>
                  <td className="py-2 px-2 font-semibold text-slate-900">{item.cdDespatch || '-'}</td>
                  <td className="py-2 px-2 text-slate-600">{item.freightOrder || '-'}</td>
                  <td className="py-2 px-2 text-slate-600">{item.loadingDate || '-'}</td>
                  <td className="py-2 px-2 text-slate-600">{item.offloadingDate || '-'}</td>
                  <td className="py-2 px-2 font-bold text-slate-900">{item.vehicleNo || '-'}</td>
                  <td className="py-2 px-2 text-slate-600 font-sans text-[10px]">{item.vehicleType || '20 Ft'}</td>
                  <td className="py-2 px-2 font-sans font-medium text-slate-900 truncate max-w-[160px]">
                    {item.distributorName || '-'}
                  </td>
                  <td className="py-2 px-2 font-sans font-semibold text-blue-700">{item.city || '-'}</td>
                  <td className="py-2 px-2 text-right">{formatCurrencyPKR(item.freight)}</td>
                  <td className="py-2 px-2 text-right text-slate-500">{formatCurrencyPKR(item.unloading)}</td>
                  <td className="py-2 px-2 text-right text-slate-500">{formatCurrencyPKR(item.move)}</td>
                  <td className="py-2 px-2 text-right text-slate-500">{formatCurrencyPKR(item.haltingCustomer)}</td>
                  <td className="py-2 px-2 text-right text-slate-500">{formatCurrencyPKR(item.haltingFactory)}</td>
                  <td className="py-2 px-2 text-right font-bold text-slate-900 bg-slate-100/50">
                    {formatCurrencyPKR(item.subTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Table Column Totals Footer */}
            <tfoot>
              <tr className="border-t-2 border-slate-800 bg-slate-100 font-bold text-[11px] text-slate-900 font-mono">
                <td colSpan={9} className="py-2.5 px-2 text-right font-sans uppercase">
                  Freight Column Totals:
                </td>
                <td className="py-2.5 px-2 text-right">{formatCurrencyPKR(invoice.freightTotal)}</td>
                <td className="py-2.5 px-2 text-right">{formatCurrencyPKR(invoice.unloadingTotal)}</td>
                <td className="py-2.5 px-2 text-right">{formatCurrencyPKR(invoice.moveTotal)}</td>
                <td className="py-2.5 px-2 text-right">{formatCurrencyPKR(invoice.haltingCustomerTotal)}</td>
                <td className="py-2.5 px-2 text-right">{formatCurrencyPKR(invoice.haltingFactoryTotal)}</td>
                <td className="py-2.5 px-2 text-right text-sm bg-slate-200 text-blue-900">
                  {formatCurrencyPKR(invoice.subTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Summary Totals & Tax Calculation Breakdown */}
        <div className="mt-6 flex flex-col md:flex-row justify-between items-start gap-6 pt-4 border-t border-slate-200">
          <div className="text-xs text-slate-600 space-y-1 max-w-sm">
            <p className="font-semibold text-slate-800">Billing Notes & Terms:</p>
            <p className="text-[11px] leading-relaxed">
              {invoice.notes || 'Official billing cycle deliveries. All freight charges verified against registered transport delivery contracts.'}
            </p>
          </div>

          <div className="w-full md:w-80 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Sub Total (Freight & Charges):</span>
              <span className="font-mono font-semibold">Rs. {formatCurrencyPKR(invoice.subTotal)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>{invoice.taxName || 'Sales Tax'} ({invoice.taxRate ?? 15}%):</span>
              <span className="font-mono font-semibold">Rs. {formatCurrencyPKR(invoice.taxAmount)}</span>
            </div>
            <div className="pt-2 border-t-2 border-slate-800 flex justify-between text-sm font-black text-slate-900">
              <span>Grand Total:</span>
              <span className="font-mono text-base text-blue-900">Rs. {formatCurrencyPKR(invoice.grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Official Signatures Block */}
        <div className="mt-12 pt-8 border-t border-slate-300 grid grid-cols-3 gap-6 text-center text-xs text-slate-700">
          <div>
            <div className="h-10 border-b border-dashed border-slate-800"></div>
            <p className="mt-2 font-bold uppercase text-[11px]">Prepared By</p>
            <p className="text-[10px] text-slate-500">Billing Clerk</p>
          </div>
          <div>
            <div className="h-10 border-b border-dashed border-slate-800"></div>
            <p className="mt-2 font-bold uppercase text-[11px]">Checked By</p>
            <p className="text-[10px] text-slate-500">Accounts Manager</p>
          </div>
          <div>
            <div className="h-10 border-b border-dashed border-slate-800"></div>
            <p className="mt-2 font-bold uppercase text-[11px]">Authorized Signatory</p>
            <p className="text-[10px] text-slate-500">{invoice.transporterCompanyName}</p>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-8 text-center text-[10px] text-slate-400 print:text-slate-600 border-t border-slate-200 pt-3">
          Generated via Fleet Bill 3.0 • Commercial Transport Billing Software • Punjab Revenue Authority Compliant
        </div>
      </div>
    </div>
  );
};
