import { jsPDF } from 'jspdf';
import type { Invoice } from '../types';
import { formatCurrencyPKR } from './billing-calculations';

/**
 * Generates an official, publication-quality PDF document for a Fleet Bill 3.0 invoice.
 * Adheres to Punjab Revenue Authority and Pakistani logistics standards.
 * Supports Landscape and Portrait layouts.
 */
export function generateInvoicePdf(invoice: Invoice, orientation: 'landscape' | 'portrait' = 'landscape'): jsPDF {
  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;

  // Header Background bar
  doc.setFillColor(30, 41, 59); // slate-800
  doc.rect(margin, margin, contentWidth, 22, 'F');

  // Title & Transporter Company Name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.transporterCompanyName || 'IK LOGISTICS (SMC) PVT LTD', margin + 6, margin + 8);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `${invoice.transporterAddress || 'BSP GATE NO.1, 10KM KRK ROAD KASUR'} | Ph: ${invoice.transporterPhone || '0301 6411664'} | Email: ${invoice.transporterEmail || 'iklogisticsofficial@gmail.com'}`,
    margin + 6,
    margin + 14
  );
  doc.text(
    `NTN: ${invoice.transporterNtn || 'J-622143'} | STRN: ${invoice.transporterStrn || '1700300067314'}`,
    margin + 6,
    margin + 19
  );

  // Invoice Number Badge on Header Right
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`INVOICE: ${invoice.invoiceNumber}`, pageWidth - margin - 6, margin + 9, { align: 'right' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${invoice.invoiceDate} ${invoice.deliveryCode || 'CD'}`, pageWidth - margin - 6, margin + 15, { align: 'right' });

  // Bill To / Customer Details Box
  const billToY = margin + 26;
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.rect(margin, billToY, contentWidth, 18, 'FD');

  doc.setTextColor(51, 65, 85);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('BILLED TO (CUSTOMER):', margin + 4, billToY + 5);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(invoice.customerName || 'M/S BULLEH SHAH PACKAGING (PVT) LTD', margin + 4, billToY + 10);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`${invoice.customerAddress || 'Shahrah-e-Roomi, P.O Amer Sidhu Lahore'}`, margin + 4, billToY + 15);

  doc.text(
    `Customer NTN: ${invoice.customerNtn || '3000673-2'}  |  Customer STRN: ${invoice.customerStrn || '1700300067314'}`,
    pageWidth - margin - 4,
    billToY + 10,
    { align: 'right' }
  );

  // Table Headers
  const tableStartY = billToY + 22;
  const colWidths = orientation === 'landscape'
    ? [8, 22, 22, 18, 18, 20, 22, 40, 24, 18, 14, 14, 16, 16, 22]
    : [6, 16, 16, 14, 14, 16, 16, 26, 18, 14, 10, 10, 12, 12, 18];

  const headers = [
    'Sr', 'CD Desp', 'Fr. Order', 'Load Dt', 'Offl Dt', 'Veh No', 'Veh Type',
    'Distributor / Consignee', 'City', 'Freight', 'Unload', 'Move', 'H.Cust', 'H.Fact', 'SubTotal'
  ];

  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(148, 163, 184);
  doc.rect(margin, tableStartY, contentWidth, 7, 'FD');

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);

  let curX = margin;
  headers.forEach((h, i) => {
    const w = colWidths[i];
    const align = i >= 9 ? 'right' : 'left';
    const xPos = align === 'right' ? curX + w - 1 : curX + 1;
    doc.text(h, xPos, tableStartY + 5, { align });
    curX += w;
  });

  // Items
  let curY = tableStartY + 7;
  const rowHeight = 5.5;

  invoice.items.forEach((item, idx) => {
    if (curY > pageHeight - 35) {
      doc.addPage();
      curY = margin + 10;
    }

    // Alternating row background
    if (idx % 2 === 0) {
      doc.setFillColor(255, 255, 255);
    } else {
      doc.setFillColor(248, 250, 252);
    }
    doc.rect(margin, curY, contentWidth, rowHeight, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, curY + rowHeight, margin + contentWidth, curY + rowHeight);

    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);

    const values = [
      String(item.sr || idx + 1),
      item.cdDespatch || '-',
      item.freightOrder || '-',
      item.loadingDate || '-',
      item.offloadingDate || '-',
      item.vehicleNo || '-',
      item.vehicleType || '20 Ft',
      (item.distributorName || '-').substring(0, orientation === 'landscape' ? 28 : 18),
      item.city || '-',
      formatCurrencyPKR(item.freight),
      formatCurrencyPKR(item.unloading),
      formatCurrencyPKR(item.move),
      formatCurrencyPKR(item.haltingCustomer),
      formatCurrencyPKR(item.haltingFactory),
      formatCurrencyPKR(item.subTotal),
    ];

    let rowX = margin;
    values.forEach((val, i) => {
      const w = colWidths[i];
      const align = i >= 9 ? 'right' : 'left';
      const xPos = align === 'right' ? rowX + w - 1 : rowX + 1;
      doc.text(val, xPos, curY + 3.8, { align });
      rowX += w;
    });

    curY += rowHeight;
  });

  // Summary Totals Box
  if (curY > pageHeight - 45) {
    doc.addPage();
    curY = margin + 10;
  }

  curY += 3;
  const totalsBoxWidth = orientation === 'landscape' ? 100 : 80;
  const totalsBoxX = margin + contentWidth - totalsBoxWidth;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(148, 163, 184);
  doc.rect(totalsBoxX, curY, totalsBoxWidth, 24, 'FD');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);

  doc.text('Sub Total (Freight & Charges):', totalsBoxX + 3, curY + 5);
  doc.text(`Rs. ${formatCurrencyPKR(invoice.subTotal)}`, totalsBoxX + totalsBoxWidth - 3, curY + 5, { align: 'right' });

  doc.text(`${invoice.taxName || 'Sales Tax'} (${invoice.taxRate ?? 15}%):`, totalsBoxX + 3, curY + 11);
  doc.text(`Rs. ${formatCurrencyPKR(invoice.taxAmount)}`, totalsBoxX + totalsBoxWidth - 3, curY + 11, { align: 'right' });

  // Grand Total highlight bar
  doc.setFillColor(30, 41, 59);
  doc.rect(totalsBoxX, curY + 15, totalsBoxWidth, 9, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('GRAND TOTAL:', totalsBoxX + 3, curY + 21);
  doc.text(`Rs. ${formatCurrencyPKR(invoice.grandTotal)}`, totalsBoxX + totalsBoxWidth - 3, curY + 21, { align: 'right' });

  // Signature Block
  const sigY = curY + 28;
  if (sigY < pageHeight - 15) {
    doc.setDrawColor(100, 116, 139);
    const colW = contentWidth / 3;

    doc.line(margin + 5, sigY + 8, margin + colW - 5, sigY + 8);
    doc.line(margin + colW + 5, sigY + 8, margin + colW * 2 - 5, sigY + 8);
    doc.line(margin + colW * 2 + 5, sigY + 8, margin + contentWidth - 5, sigY + 8);

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('PREPARED BY (Billing Clerk)', margin + colW / 2, sigY + 12, { align: 'center' });
    doc.text('CHECKED BY (Accounts Manager)', margin + colW * 1.5, sigY + 12, { align: 'center' });
    doc.text(`AUTHORIZED SIGNATORY (${invoice.transporterCompanyName})`, margin + colW * 2.5, sigY + 12, { align: 'center' });
  }

  return doc;
}

/**
 * Downloads the generated PDF directly in the browser.
 */
export function downloadInvoicePdf(invoice: Invoice, orientation: 'landscape' | 'portrait' = 'landscape') {
  const doc = generateInvoicePdf(invoice, orientation);
  doc.save(`${invoice.invoiceNumber}.pdf`);
}

/**
 * Returns the PDF as base64 string for email attachment.
 */
export function getInvoicePdfBase64(invoice: Invoice, orientation: 'landscape' | 'portrait' = 'landscape'): string {
  const doc = generateInvoicePdf(invoice, orientation);
  return doc.output('datauristring').split(',')[1] || '';
}
