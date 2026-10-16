import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { db } from './src/db/storage';
import { generateInvoiceExcel } from './src/utils/excel-generator';
import { calculateInvoiceTotals, validateInvoiceNumber } from './src/utils/billing-calculations';
import type { UserProfile, UserRole } from './src/types';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'fleetbill3_super_secret_enterprise_jwt_key_2026';

// In-Memory Secure OTP storage with expiration and rate limiting
interface PendingRegistration {
  data: {
    fullName: string;
    companyName: string;
    mobile: string;
    email: string;
    address: string;
    city: string;
    passwordHash: string;
  };
  otp: string;
  expiresAt: number;
  lastSentAt: number;
}

const pendingRegistrations = new Map<string, PendingRegistration>();

interface PasswordResetEntry {
  email: string;
  otp: string;
  expiresAt: number;
  lastSentAt: number;
}

const passwordResetOtps = new Map<string, PasswordResetEntry>();

// System Email Dispatcher
async function sendSystemEmail(to: string, subject: string, text: string, html?: string, attachments?: any[]) {
  const dbSmtp = db.getSmtpSettings();
  const smtpUser = process.env.SMTP_USER || dbSmtp?.user;
  const smtpPass = process.env.SMTP_PASS || dbSmtp?.pass;
  const smtpHost = process.env.SMTP_HOST || dbSmtp?.host || 'smtp.gmail.com';
  const smtpPort = Number(process.env.SMTP_PORT || dbSmtp?.port || 465);

  if (smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      const info = await transporter.sendMail({
        from: `"Fleet Bill 3.0" <${smtpUser}>`,
        to,
        subject,
        text,
        html: html || undefined,
        attachments,
      });
      return { success: true, messageId: info.messageId };
    } catch (err: any) {
      console.error('Nodemailer SMTP Error:', err);
      return { success: false, error: err.message };
    }
  } else {
    console.log(`[Email Simulation -> ${to}] Subject: "${subject}"\n${text}`);
    return { success: true, simulation: true };
  }
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

export interface AuthenticatedRequest extends Request {
  user?: UserProfile;
}

// Authentication Middleware
function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication token required.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id: string; role: string };
    const user = db.findUserById(payload.id);

    if (!user) {
      return res.status(401).json({ error: 'User account not found.' });
    }

    if (user.accountStatus === 'suspended') {
      return res.status(403).json({ error: 'Your account is suspended. Please contact administrator.' });
    }

    if (user.accountStatus === 'deactivated') {
      return res.status(403).json({ error: 'Your account has been deactivated.' });
    }

    const { passwordHash: _, ...safeUser } = user;
    req.user = safeUser as UserProfile;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired session token.' });
  }
}

// Admin only guard
function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
  }
  next();
}

// ---------------- AUTH ROUTES ----------------
app.post('/api/auth/register', async (req: Request, res: Response) => {
  const { fullName, companyName, mobile, email, address, city, password } = req.body;

  if (!fullName || !companyName || !mobile || !email || !password) {
    return res.status(400).json({ error: 'All required registration fields must be provided.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanMobile = mobile.trim();

  const existing = db.findUserByEmailOrMobile(cleanEmail) || db.findUserByEmailOrMobile(cleanMobile);
  if (existing) {
    return res.status(409).json({ error: 'An account with this email or mobile number already exists.' });
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const now = Date.now();
  const expiresAt = now + 15 * 60 * 1000; // 15 mins

  pendingRegistrations.set(cleanEmail, {
    data: {
      fullName: fullName.trim(),
      companyName: companyName.trim(),
      mobile: cleanMobile,
      email: cleanEmail,
      address: address ? address.trim() : '',
      city: city ? city.trim() : '',
      passwordHash,
    },
    otp,
    expiresAt,
    lastSentAt: now,
  });

  // Dispatch OTP email
  const emailResult = await sendSystemEmail(
    cleanEmail,
    `Your Fleet Bill 3.0 Verification Code: ${otp}`,
    `Welcome to Fleet Bill 3.0!\n\nYour 6-digit email verification code is: ${otp}\n\nThis code will expire in 15 minutes. Please enter it to complete your transporter registration.\n\nIf you did not request this, please ignore this message.`
  );

  return res.status(200).json({
    pendingVerification: true,
    message: `Verification code sent to ${cleanEmail}. Please enter the 6-digit OTP code to verify and activate your account.`,
    previewCode: (emailResult && 'simulation' in emailResult && emailResult.simulation) ? otp : undefined,
  });
});

app.post('/api/auth/verify-registration-otp', (req: Request, res: Response) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and verification code are required.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const pending = pendingRegistrations.get(cleanEmail);

  if (!pending) {
    return res.status(400).json({ error: 'No pending registration found for this email, or it has expired. Please register again.' });
  }

  if (Date.now() > pending.expiresAt) {
    pendingRegistrations.delete(cleanEmail);
    return res.status(400).json({ error: 'Verification code has expired. Please request a new code.' });
  }

  if (pending.otp !== otp.trim()) {
    return res.status(400).json({ error: 'Invalid verification code. Please check and try again.' });
  }

  // Create transporter user
  const newTransporterId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const now = new Date();
  const trialExpiry = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days trial

  const newUser = db.createUser({
    id: newTransporterId,
    email: pending.data.email,
    mobile: pending.data.mobile,
    fullName: pending.data.fullName,
    companyName: pending.data.companyName,
    address: pending.data.address,
    city: pending.data.city,
    ntn: '',
    strn: '',
    phone: pending.data.mobile,
    role: 'transporter',
    accountStatus: 'active',
    createdAt: now.toISOString(),
    passwordHash: pending.data.passwordHash,
    subscription: {
      plan: 'trial',
      status: 'active',
      startDate: now.toISOString().split('T')[0],
      expiryDate: trialExpiry.toISOString().split('T')[0],
      price: 0,
    },
    settings: {
      defaultTaxRate: 15,
      defaultTaxName: 'Punjab 15% Tex',
      invoicePrefix: 'INV-26-',
      currency: 'PKR',
    },
  });

  pendingRegistrations.delete(cleanEmail);

  db.logAudit(newUser.id, newUser.email, 'TRANSPORTER_REGISTERED', `New transporter account verified & activated for ${newUser.companyName}`);

  const token = jwt.sign({ id: newUser.id, role: newUser.role }, JWT_SECRET, { expiresIn: '7d' });
  return res.status(201).json({ user: newUser, token });
});

app.post('/api/auth/resend-registration-otp', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });

  const cleanEmail = email.trim().toLowerCase();
  const pending = pendingRegistrations.get(cleanEmail);

  if (!pending) {
    return res.status(400).json({ error: 'No pending registration found for this email.' });
  }

  const now = Date.now();
  if (now - pending.lastSentAt < 60000) {
    const remaining = Math.ceil((60000 - (now - pending.lastSentAt)) / 1000);
    return res.status(429).json({ error: `Please wait ${remaining} seconds before requesting a new code.` });
  }

  const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
  pending.otp = newOtp;
  pending.expiresAt = now + 15 * 60 * 1000;
  pending.lastSentAt = now;

  const emailResult = await sendSystemEmail(
    cleanEmail,
    `New Verification Code: ${newOtp}`,
    `Your new Fleet Bill 3.0 verification code is: ${newOtp}\n\nValid for 15 minutes.`
  );

  return res.json({
    ok: true,
    message: `New verification code sent to ${cleanEmail}.`,
    previewCode: (emailResult && 'simulation' in emailResult && emailResult.simulation) ? newOtp : undefined,
  });
});

app.post('/api/auth/login', (req: Request, res: Response) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ error: 'Please enter your email or mobile and password.' });
  }

  const user = db.findUserByEmailOrMobile(identifier);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials. User not found.' });
  }

  const match = bcrypt.compareSync(password, user.passwordHash);
  if (!match) {
    return res.status(401).json({ error: 'Invalid credentials. Incorrect password.' });
  }

  if (user.accountStatus === 'suspended') {
    return res.status(403).json({ error: 'Account suspended. Please contact Super Admin.' });
  }
  if (user.accountStatus === 'deactivated') {
    return res.status(403).json({ error: 'Account deactivated. Please contact Super Admin.' });
  }

  db.logAudit(user.id, user.email, 'USER_LOGIN', `User ${user.fullName} logged in successfully.`);

  const { passwordHash: _, ...safeUser } = user;
  const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  return res.json({ user: safeUser, token });
});

app.get('/api/auth/me', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  return res.json({ user: req.user });
});

app.post('/api/auth/update-profile', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const { fullName, companyName, address, city, ntn, strn, phone, mobile, settings } = req.body;

  const updated = db.updateUser(req.user.id, {
    fullName,
    companyName,
    address,
    city,
    ntn,
    strn,
    phone,
    mobile,
    settings,
  });

  db.logAudit(req.user.id, req.user.email, 'PROFILE_UPDATED', `Profile and company settings updated.`);
  return res.json({ user: updated });
});

app.post('/api/auth/upload-logo', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const { logoUrl } = req.body;

  const updated = db.updateUser(req.user.id, { logoUrl: logoUrl || '' });
  db.logAudit(req.user.id, req.user.email, 'LOGO_UPDATED', `Company logo updated.`);
  return res.json({ user: updated });
});

app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email address is required.' });

  const cleanEmail = email.trim().toLowerCase();
  const user = db.findUserByEmailOrMobile(cleanEmail);
  if (!user) {
    return res.status(404).json({ error: 'No account found with this email address.' });
  }

  const now = Date.now();
  const existing = passwordResetOtps.get(cleanEmail);
  if (existing && now - existing.lastSentAt < 60000) {
    const remaining = Math.ceil((60000 - (now - existing.lastSentAt)) / 1000);
    return res.status(429).json({ error: `Please wait ${remaining} seconds before requesting another code.` });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  passwordResetOtps.set(cleanEmail, {
    email: cleanEmail,
    otp,
    expiresAt: now + 15 * 60 * 1000,
    lastSentAt: now,
  });

  const emailResult = await sendSystemEmail(
    cleanEmail,
    `Fleet Bill Password Reset Code: ${otp}`,
    `Hello ${user.fullName},\n\nYou requested to reset your password on Fleet Bill 3.0.\n\nYour 6-digit password reset code is: ${otp}\n\nThis code will expire in 15 minutes. Enter this code along with your new password to complete the reset.\n\nIf you did not request this, please secure your account immediately.`
  );

  return res.json({
    message: `Password reset code sent to ${cleanEmail}.`,
    previewCode: (emailResult && 'simulation' in emailResult && emailResult.simulation) ? otp : undefined,
  });
});

app.post('/api/auth/reset-password', (req: Request, res: Response) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) {
    return res.status(400).json({ error: 'Email, OTP code, and new password are required.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const entry = passwordResetOtps.get(cleanEmail);

  if (!entry) {
    return res.status(400).json({ error: 'No active password reset request found. Please request a new code.' });
  }

  if (Date.now() > entry.expiresAt) {
    passwordResetOtps.delete(cleanEmail);
    return res.status(400).json({ error: 'Reset code has expired. Please request a new code.' });
  }

  if (entry.otp !== otp.trim()) {
    return res.status(400).json({ error: 'Invalid reset code. Please check and try again.' });
  }

  const user = db.findUserByEmailOrMobile(cleanEmail);
  if (!user) {
    return res.status(404).json({ error: 'User account not found.' });
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(newPassword, salt);
  db.updateUser(user.id, { passwordHash });

  passwordResetOtps.delete(cleanEmail);
  db.logAudit(user.id, user.email, 'PASSWORD_RESET', `User ${user.fullName} reset their password via email OTP.`);

  return res.json({ ok: true, message: 'Password has been reset successfully. You can now sign in.' });
});

app.post('/api/auth/change-password', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Both current password and new password are required.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
  }

  if (currentPassword === newPassword) {
    return res.status(400).json({ error: 'New password must be different from current password.' });
  }

  const userWithHash = db.findUserById(req.user.id);
  if (!userWithHash) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const isCurrentValid = bcrypt.compareSync(currentPassword, userWithHash.passwordHash);
  if (!isCurrentValid) {
    return res.status(400).json({ error: 'Current password does not match our records.' });
  }

  const salt = bcrypt.genSaltSync(10);
  const newHash = bcrypt.hashSync(newPassword, salt);
  db.updateUser(req.user.id, { passwordHash: newHash });

  db.logAudit(req.user.id, req.user.email, 'PASSWORD_CHANGED', `Password updated successfully.`);
  return res.json({ success: true, message: 'Password updated successfully!' });
});

// ---------------- INVOICE ROUTES (STRICT TENANT ISOLATION) ----------------
app.get('/api/invoices', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const invoices = db.getInvoices(req.user.id);
  return res.json({ invoices });
});

app.get('/api/invoices/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const invoice = db.findInvoiceById(req.params.id, req.user.id);
  if (!invoice) {
    return res.status(404).json({ error: 'Invoice not found.' });
  }
  return res.json({ invoice });
});

app.post('/api/invoices', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const data = req.body;

  // Validate invoice number uniqueness
  const existingInvoices = db.getInvoices(req.user.id);
  const existingNumbers = existingInvoices.map((i) => i.invoiceNumber);
  const check = validateInvoiceNumber(data.invoiceNumber, existingNumbers);
  if (!check.valid) {
    return res.status(400).json({ error: check.error });
  }

  // Calculate totals safely
  const items = (data.items || []).map((it: any, idx: number) => ({
    id: it.id || `itm_${Date.now()}_${idx}`,
    sr: idx + 1,
    cdDespatch: it.cdDespatch || '',
    freightOrder: it.freightOrder || '',
    loadingDate: it.loadingDate || '',
    offloadingDate: it.offloadingDate || '',
    vehicleNo: it.vehicleNo || '',
    vehicleType: it.vehicleType || '',
    distributorName: it.distributorName || '',
    city: it.city || '',
    freight: Number(it.freight) || 0,
    unloading: Number(it.unloading) || 0,
    move: Number(it.move) || 0,
    haltingCustomer: Number(it.haltingCustomer) || 0,
    haltingFactory: Number(it.haltingFactory) || 0,
    subTotal: (Number(it.freight) || 0) + (Number(it.unloading) || 0) + (Number(it.move) || 0) + (Number(it.haltingCustomer) || 0) + (Number(it.haltingFactory) || 0),
  }));

  const totals = calculateInvoiceTotals(items, data.taxRate ?? 15, data.taxName ?? 'Punjab 15% Tex');

  const newInvoice = db.saveInvoice({
    id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    transporterId: req.user.id,
    invoiceNumber: data.invoiceNumber.trim(),
    invoiceDate: data.invoiceDate || new Date().toISOString().split('T')[0],
    deliveryCode: data.deliveryCode || 'CD',
    customerId: data.customerId || '',
    customerName: data.customerName || '',
    customerAddress: data.customerAddress || '',
    customerNtn: data.customerNtn || '',
    customerStrn: data.customerStrn || '',
    transporterCompanyName: req.user.companyName,
    transporterAddress: req.user.address,
    transporterPhone: req.user.phone || req.user.mobile,
    transporterEmail: req.user.email,
    transporterNtn: req.user.ntn,
    transporterStrn: req.user.strn,
    transporterLogo: req.user.logoUrl,
    items,
    ...totals,
    paymentStatus: data.paymentStatus || 'unpaid',
    paidAmount: Number(data.paidAmount) || 0,
    notes: data.notes || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  db.logAudit(req.user.id, req.user.email, 'INVOICE_CREATED', `Invoice ${newInvoice.invoiceNumber} created for Rs. ${newInvoice.grandTotal}`);
  return res.status(201).json({ invoice: newInvoice });
});

app.put('/api/invoices/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const existing = db.findInvoiceById(req.params.id, req.user.id);
  if (!existing) {
    return res.status(404).json({ error: 'Invoice not found.' });
  }

  const data = req.body;

  // Validate number uniqueness if changing
  if (data.invoiceNumber && data.invoiceNumber.trim() !== existing.invoiceNumber) {
    const existingInvoices = db.getInvoices(req.user.id);
    const existingMap = Object.fromEntries(existingInvoices.map((i) => [i.id, i.invoiceNumber]));
    const check = validateInvoiceNumber(data.invoiceNumber, [], req.params.id, existingMap);
    if (!check.valid) {
      return res.status(400).json({ error: check.error });
    }
  }

  const items = (data.items || existing.items).map((it: any, idx: number) => ({
    id: it.id || `itm_${Date.now()}_${idx}`,
    sr: idx + 1,
    cdDespatch: it.cdDespatch || '',
    freightOrder: it.freightOrder || '',
    loadingDate: it.loadingDate || '',
    offloadingDate: it.offloadingDate || '',
    vehicleNo: it.vehicleNo || '',
    vehicleType: it.vehicleType || '',
    distributorName: it.distributorName || '',
    city: it.city || '',
    freight: Number(it.freight) || 0,
    unloading: Number(it.unloading) || 0,
    move: Number(it.move) || 0,
    haltingCustomer: Number(it.haltingCustomer) || 0,
    haltingFactory: Number(it.haltingFactory) || 0,
    subTotal: (Number(it.freight) || 0) + (Number(it.unloading) || 0) + (Number(it.move) || 0) + (Number(it.haltingCustomer) || 0) + (Number(it.haltingFactory) || 0),
  }));

  const totals = calculateInvoiceTotals(items, data.taxRate ?? existing.taxRate, data.taxName ?? existing.taxName);

  const updatedInvoice = db.saveInvoice({
    ...existing,
    ...data,
    transporterId: req.user.id,
    id: existing.id,
    items,
    ...totals,
    updatedAt: new Date().toISOString(),
  });

  db.logAudit(req.user.id, req.user.email, 'INVOICE_UPDATED', `Invoice ${updatedInvoice.invoiceNumber} updated.`);
  return res.json({ invoice: updatedInvoice });
});

app.delete('/api/invoices/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const existing = db.findInvoiceById(req.params.id, req.user.id);
  if (!existing) {
    return res.status(404).json({ error: 'Invoice not found.' });
  }

  db.deleteInvoice(req.params.id, req.user.id);
  db.logAudit(req.user.id, req.user.email, 'INVOICE_DELETED', `Invoice ${existing.invoiceNumber} deleted.`);
  return res.json({ success: true, message: 'Invoice deleted successfully.' });
});

app.post('/api/invoices/:id/send-email', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const invoice = db.findInvoiceById(req.params.id, req.user.role === 'admin' ? undefined : req.user.id);
  if (!invoice) {
    return res.status(404).json({ error: 'Invoice not found or access denied.' });
  }

  const { to, cc, bcc, subject, body, invoicePdf, attachments } = req.body;
  if (!to || typeof to !== 'string' || !to.includes('@')) {
    return res.status(400).json({ error: 'A valid recipient email address is required.' });
  }

  const mailAttachments: any[] = [];
  if (invoicePdf && invoicePdf.base64) {
    mailAttachments.push({
      filename: invoicePdf.filename || `${invoice.invoiceNumber}.pdf`,
      content: Buffer.from(invoicePdf.base64, 'base64'),
      contentType: 'application/pdf',
    });
  }

  if (Array.isArray(attachments)) {
    for (const att of attachments) {
      if (att.base64 && att.filename) {
        mailAttachments.push({
          filename: att.filename,
          content: Buffer.from(att.base64, 'base64'),
          contentType: att.contentType || 'application/octet-stream',
        });
      }
    }
  }

  const emailRes = await sendSystemEmail(
    to.trim(),
    subject || `Transport Invoice ${invoice.invoiceNumber} - ${invoice.transporterCompanyName}`,
    body,
    undefined,
    mailAttachments
  );

  if (!emailRes.success) {
    return res.status(500).json({
      error: `Failed to deliver email: ${emailRes.error || 'SMTP delivery error'}. Please verify SMTP credentials.`,
    });
  }

  const deliveryNote = emailRes.simulation
    ? `Dispatched to ${to} (Preview Mode: set SMTP_USER & SMTP_PASS in .env for live Gmail delivery)`
    : `Delivered via SMTP to ${to}`;

  db.logAudit(
    req.user.id,
    req.user.email,
    'INVOICE_EMAILED',
    `Invoice ${invoice.invoiceNumber} emailed to ${to}${cc ? ` (CC: ${cc})` : ''}. ${deliveryNote}`
  );

  return res.json({
    success: true,
    message: `Invoice ${invoice.invoiceNumber} successfully dispatched to ${to}.`,
    details: deliveryNote,
  });
});

app.get('/api/invoices/:id/export-excel', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const invoice = db.findInvoiceById(req.params.id, req.user.id);
  if (!invoice) {
    return res.status(404).json({ error: 'Invoice not found.' });
  }

  const excelBuffer = generateInvoiceExcel(invoice);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.xlsx"`);
  return res.send(Buffer.from(excelBuffer));
});

// ---------------- FREIGHT RATE ROUTES ----------------
app.get('/api/freight-rates', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const customerRates = db.getCustomerFreightRates(req.user.id);
  const cityRates = db.getCityFreightRates(req.user.id);
  return res.json({ customerRates, cityRates });
});

app.post('/api/freight-rates/customer', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const { id, customerName, destination, rate20ft, rate40ft } = req.body;

  if (!customerName || !destination) {
    return res.status(400).json({ error: 'Customer name and destination are required.' });
  }

  const rate = db.saveCustomerFreightRate({
    id: id || `cfr_${Date.now()}`,
    transporterId: req.user.id,
    customerName: customerName.trim(),
    destination: destination.trim(),
    rate20ft: Number(rate20ft) || 0,
    rate40ft: Number(rate40ft) || 0,
    updatedAt: new Date().toISOString(),
  });

  return res.json({ rate });
});

app.post('/api/freight-rates/city', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const { id, cityName, rate20ft, rate24ftModified, rate32ftModified, rate40ft } = req.body;

  if (!cityName) {
    return res.status(400).json({ error: 'City name is required.' });
  }

  const rate = db.saveCityFreightRate({
    id: id || `ct_${Date.now()}`,
    transporterId: req.user.id,
    cityName: cityName.trim(),
    rate20ft: Number(rate20ft) || 0,
    rate24ftModified: Number(rate24ftModified) || 0,
    rate32ftModified: Number(rate32ftModified) || 0,
    rate40ft: Number(rate40ft) || 0,
    updatedAt: new Date().toISOString(),
  });

  return res.json({ rate });
});

app.delete('/api/freight-rates/:type/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const { type, id } = req.params;
  if (type === 'customer') {
    db.deleteCustomerFreightRate(id, req.user.id);
  } else {
    db.deleteCityFreightRate(id, req.user.id);
  }
  return res.json({ success: true });
});

// ---------------- DISPATCH FREIGHT RATES ROUTES ----------------
app.get('/api/dispatch-freight-rates', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const rates = db.getDispatchFreightRates(req.user.id);
  return res.json({ rates });
});

app.get('/api/dispatch-freight-rates/lookup', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const dispatchNo = (req.query.dispatchNo as string) || '';
  if (!dispatchNo.trim()) {
    return res.json({ matches: [], invoiceCheck: { invoiced: false, invoiceNumbers: [] } });
  }
  const matches = db.findDispatchFreightRatesByDispatchNo(req.user.id, dispatchNo);
  const invoiceCheck = db.checkDispatchAlreadyInvoiced(req.user.id, dispatchNo);
  return res.json({ matches, invoiceCheck });
});

app.get('/api/dispatch-freight-rates/search', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const query = (req.query.q as string) || '';
  const rates = db.searchDispatchFreightRates(req.user.id, query);
  return res.json({ rates });
});

app.post('/api/dispatch-freight-rates/save-batch', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const { rates, replaceExisting, sourceFileName } = req.body;
  if (!Array.isArray(rates)) {
    return res.status(400).json({ error: 'Expected an array of freight rate records.' });
  }

  const result = db.saveDispatchFreightRates(req.user.id, rates, {
    replaceExisting: Boolean(replaceExisting),
    sourceFileName: sourceFileName || 'Excel_Import.xlsx',
  });

  db.logAudit(
    req.user.id,
    req.user.email,
    'DISPATCH_RATES_IMPORTED',
    `Imported ${result.savedCount} dispatch freight rates (${result.duplicateCount} duplicates skipped, ${result.newVehicleTypesAdded.length} vehicle types registered).`
  );

  return res.json({
    success: true,
    ...result,
  });
});

app.post('/api/dispatch-freight-rates', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const { dispatchNo, freightOrderNo, loadingDate, vehicleNo, vehicleType, destination, freightRate } = req.body;
  if (!dispatchNo || !dispatchNo.trim()) {
    return res.status(400).json({ error: 'Dispatch No. is required.' });
  }

  const result = db.saveDispatchFreightRates(
    req.user.id,
    [
      {
        dispatchNo: dispatchNo.trim(),
        freightOrderNo: freightOrderNo || '',
        loadingDate: loadingDate || '',
        vehicleNo: vehicleNo || '',
        vehicleType: vehicleType || '20 Ft Vehicle',
        destination: destination || '',
        freightRate: Number(freightRate) || 0,
      },
    ],
    { replaceExisting: true }
  );

  return res.json({ success: true, ...result });
});

app.delete('/api/dispatch-freight-rates/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const deleted = db.deleteDispatchFreightRate(req.user.id, req.params.id);
  return res.json({ success: deleted });
});

app.delete('/api/dispatch-freight-rates', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const count = db.clearDispatchFreightRates(req.user.id);
  db.logAudit(req.user.id, req.user.email, 'DISPATCH_RATES_CLEARED', `Cleared ${count} dispatch freight rates.`);
  return res.json({ success: true, count });
});

// ---------------- VEHICLE TYPES ROUTES (DYNAMIC) ----------------
app.get('/api/vehicle-types', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const vehicleTypes = db.getVehicleTypes(req.user.id);
  return res.json({ vehicleTypes });
});

app.post('/api/vehicle-types', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Vehicle type name is required.' });
  }
  const vehicleType = db.createVehicleType(req.user.id, name);
  return res.json({ vehicleType });
});

app.put('/api/vehicle-types/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const { name, status } = req.body;
  const updated = db.updateVehicleType(req.user.id, req.params.id, { name, status });
  if (!updated) {
    return res.status(404).json({ error: 'Vehicle type not found.' });
  }
  return res.json({ vehicleType: updated });
});

app.delete('/api/vehicle-types/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const deleted = db.deleteVehicleType(req.user.id, req.params.id);
  return res.json({ success: deleted });
});

// ---------------- CUSTOMERS & VEHICLES ROUTES ----------------
app.get('/api/customers', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const customers = db.getCustomers(req.user.id);
  return res.json({ customers });
});

app.post('/api/customers', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const { id, name, address, ntn, strn, phone, email } = req.body;
  if (!name) return res.status(400).json({ error: 'Customer name is required.' });

  const customer = db.saveCustomer({
    id: id || `cust_${Date.now()}`,
    transporterId: req.user.id,
    name: name.trim(),
    address: address || '',
    ntn: ntn || '',
    strn: strn || '',
    phone: phone || '',
    email: email || '',
    createdAt: new Date().toISOString(),
  });
  return res.json({ customer });
});

app.delete('/api/customers/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  db.deleteCustomer(req.params.id, req.user.id);
  return res.json({ success: true });
});

app.get('/api/vehicles', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const vehicles = db.getVehicles(req.user.id);
  return res.json({ vehicles });
});

app.post('/api/vehicles', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const { id, vehicleNo, vehicleType, driverName, driverPhone, status } = req.body;
  if (!vehicleNo) return res.status(400).json({ error: 'Vehicle number is required.' });

  const vehicle = db.saveVehicle({
    id: id || `veh_${Date.now()}`,
    transporterId: req.user.id,
    vehicleNo: vehicleNo.trim().toUpperCase(),
    vehicleType: vehicleType || '20 Ft Vehicle',
    driverName: driverName || '',
    driverPhone: driverPhone || '',
    status: status || 'available',
  });
  return res.json({ vehicle });
});

app.delete('/api/vehicles/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  db.deleteVehicle(req.params.id, req.user.id);
  return res.json({ success: true });
});

// ---------------- ANALYTICS ROUTE ----------------
app.get('/api/analytics', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const invoices = db.getInvoices(req.user.id);
  const vehicles = db.getVehicles(req.user.id);

  let totalRevenue = 0;
  let totalTrips = 0;
  let totalHaltingCustomer = 0;
  let totalHaltingFactory = 0;
  let totalMovementCharges = 0;
  let totalTaxCollected = 0;

  const customerBillingMap: Record<string, number> = {};
  const cityTripsMap: Record<string, number> = {};
  const vehicleTypeMap: Record<string, number> = {};

  invoices.forEach((inv) => {
    totalRevenue += inv.subTotal;
    totalTaxCollected += inv.taxAmount;
    totalHaltingCustomer += inv.haltingCustomerTotal;
    totalHaltingFactory += inv.haltingFactoryTotal;
    totalMovementCharges += inv.moveTotal;

    const cName = inv.customerName || 'Other Customers';
    customerBillingMap[cName] = (customerBillingMap[cName] || 0) + inv.subTotal;

    inv.items.forEach((item) => {
      totalTrips += 1;
      const city = item.city || 'Unknown';
      cityTripsMap[city] = (cityTripsMap[city] || 0) + 1;

      const vt = item.vehicleType || '20 Ft Vehicle';
      vehicleTypeMap[vt] = (vehicleTypeMap[vt] || 0) + 1;
    });
  });

  return res.json({
    metrics: {
      totalRevenue,
      totalTaxCollected,
      grandBilled: totalRevenue + totalTaxCollected,
      totalInvoices: invoices.length,
      totalTrips,
      totalVehicles: vehicles.length,
      totalHaltingCharges: totalHaltingCustomer + totalHaltingFactory,
      totalMovementCharges,
    },
    customerBilling: Object.entries(customerBillingMap).map(([name, amount]) => ({ name, amount })),
    cityTrips: Object.entries(cityTripsMap).map(([city, count]) => ({ city, count })),
    vehicleTypes: Object.entries(vehicleTypeMap).map(([type, count]) => ({ type, count })),
  });
});

// ---------------- SUBSCRIPTION / RENEWAL ROUTE ----------------
app.post('/api/subscription/request-renewal', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).send();
  const { plan, paymentReference } = req.body;

  const pricing = db.getPricing();
  const price = plan === 'yearly' ? pricing.yearlyPrice : pricing.monthlyPrice;

  const updated = db.updateUser(req.user.id, {
    subscription: {
      ...req.user.subscription,
      plan: plan || 'monthly',
      status: 'pending_approval',
      price,
      paymentReference: paymentReference || 'Offline Bank Transfer',
      paymentDate: new Date().toISOString().split('T')[0],
    },
  });

  db.logAudit(
    req.user.id,
    req.user.email,
    'SUBSCRIPTION_RENEWAL_REQUESTED',
    `Requested ${plan} subscription renewal with reference: ${paymentReference}`
  );

  return res.json({ user: updated, message: 'Renewal request submitted! Super admin will verify and activate your plan.' });
});

// ---------------- SUPER ADMIN ROUTES ----------------
app.get('/api/admin/transporters', authenticateToken, requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
  const users = db.getUsers().map(({ passwordHash: _, ...u }) => {
    const invCount = db.getInvoices(u.id).length;
    return { ...u, invoiceCount: invCount };
  });
  return res.json({ transporters: users });
});

app.post('/api/admin/transporters/:id/status', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { status } = req.body;
  if (!['active', 'suspended', 'deactivated'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status value.' });
  }

  const updated = db.updateUser(req.params.id, { accountStatus: status });
  if (!updated) return res.status(404).json({ error: 'Transporter not found.' });

  db.logAudit(req.user!.id, req.user!.email, 'ADMIN_STATUS_CHANGED', `Changed status of ${updated.companyName} to ${status}`);
  return res.json({ user: updated });
});

app.post('/api/admin/transporters/:id/subscription', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { plan, status, durationMonths } = req.body;
  const user = db.findUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'Transporter not found.' });

  const now = new Date();
  const months = durationMonths ? parseInt(durationMonths, 10) : (plan === 'yearly' ? 12 : 1);
  const expiry = new Date(now.getTime() + months * 30 * 24 * 60 * 60 * 1000);

  const updated = db.updateUser(req.params.id, {
    subscription: {
      plan: plan || user.subscription.plan,
      status: status || 'active',
      startDate: now.toISOString().split('T')[0],
      expiryDate: expiry.toISOString().split('T')[0],
      price: user.subscription.price,
      approvedBy: req.user!.fullName,
    },
  });

  db.logAudit(req.user!.id, req.user!.email, 'ADMIN_SUBSCRIPTION_APPROVED', `Approved ${plan} plan for ${user.companyName} until ${expiry.toISOString().split('T')[0]}`);
  return res.json({ user: updated });
});

app.delete('/api/admin/transporters/:id', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const user = db.findUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'Transporter not found.' });

  if (user.role === 'admin') {
    return res.status(400).json({ error: 'Cannot delete Super Admin account.' });
  }

  const deleteData = req.query.deleteData === 'true';
  db.deleteUser(req.params.id, deleteData);
  db.logAudit(req.user!.id, req.user!.email, 'ADMIN_TRANSPORTER_DELETED', `Deleted account ${user.companyName} (data deleted: ${deleteData})`);
  return res.json({ success: true, message: 'Account deleted.' });
});

app.get('/api/admin/pricing', authenticateToken, (_req: AuthenticatedRequest, res: Response) => {
  return res.json({ pricing: db.getPricing() });
});

app.post('/api/admin/pricing', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const updated = db.updatePricing(req.body);
  db.logAudit(req.user!.id, req.user!.email, 'ADMIN_PRICING_UPDATED', `Updated subscription prices: Monthly Rs. ${updated.monthlyPrice}, Yearly Rs. ${updated.yearlyPrice}`);
  return res.json({ pricing: updated });
});

app.get('/api/admin/audit-logs', authenticateToken, requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
  return res.json({ logs: db.getAuditLogs() });
});

// Admin SMTP Configuration Routes
app.get('/api/admin/smtp', authenticateToken, requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
  const smtp = db.getSmtpSettings();
  if (!smtp) {
    return res.json({
      smtp: {
        user: process.env.SMTP_USER || '',
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: Number(process.env.SMTP_PORT || 465),
        fromName: 'Fleet Bill 3.0',
        isConfigured: Boolean(process.env.SMTP_USER && process.env.SMTP_PASS),
        hasPass: Boolean(process.env.SMTP_PASS),
      },
    });
  }
  return res.json({
    smtp: {
      user: smtp.user || process.env.SMTP_USER || '',
      host: smtp.host || process.env.SMTP_HOST || 'smtp.gmail.com',
      port: smtp.port || Number(process.env.SMTP_PORT || 465),
      fromName: smtp.fromName || 'Fleet Bill 3.0',
      isConfigured: Boolean((smtp.user && smtp.pass) || (process.env.SMTP_USER && process.env.SMTP_PASS)),
      hasPass: Boolean(smtp.pass || process.env.SMTP_PASS),
    },
  });
});

app.post('/api/admin/smtp', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { user, pass, host, port, fromName } = req.body;
  if (!user) {
    return res.status(400).json({ error: 'SMTP User/Email is required.' });
  }

  const existing = db.getSmtpSettings() || { user: '', pass: '', host: 'smtp.gmail.com', port: 465, fromName: 'Fleet Bill 3.0' };
  const updatedSettings = {
    user: user.trim(),
    pass: pass && pass.trim() ? pass.trim() : existing.pass,
    host: host ? host.trim() : (existing.host || 'smtp.gmail.com'),
    port: port ? Number(port) : (existing.port || 465),
    fromName: fromName ? fromName.trim() : (existing.fromName || 'Fleet Bill 3.0'),
  };

  db.saveSmtpSettings(updatedSettings);
  db.logAudit(req.user!.id, req.user!.email, 'ADMIN_SMTP_UPDATED', `Updated SMTP server credentials for ${updatedSettings.user}`);

  return res.json({
    success: true,
    message: 'SMTP settings saved successfully.',
    smtp: {
      user: updatedSettings.user,
      host: updatedSettings.host,
      port: updatedSettings.port,
      fromName: updatedSettings.fromName,
      isConfigured: Boolean(updatedSettings.user && updatedSettings.pass),
      hasPass: Boolean(updatedSettings.pass),
    },
  });
});

app.post('/api/admin/smtp/test', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { testEmail } = req.body;
  const targetEmail = testEmail || req.user?.email || 'atifraza4070@gmail.com';

  const testResult = await sendSystemEmail(
    targetEmail,
    'Fleet Bill 3.0 - SMTP Verification Test',
    'Congratulations! Your Fleet Bill 3.0 SMTP email delivery system is functioning correctly.',
    '<div style="font-family:sans-serif;padding:24px;border:1px solid #cbd5e1;border-radius:12px;background:#f8fafc;"><h2 style="color:#1e3a8a;margin-top:0;">Fleet Bill 3.0</h2><p style="color:#16a34a;font-weight:bold;font-size:16px;">✅ SMTP Connection Verified!</p><p style="color:#334155;">Your system email service is configured and active. Invoices, password resets, and registration verification codes will now be delivered reliably.</p></div>'
  );

  if (testResult.success) {
    if ('simulation' in testResult && testResult.simulation) {
      return res.json({
        success: true,
        simulation: true,
        message: 'SMTP is currently in Simulation Mode. Provide your SMTP password to send live emails.',
      });
    }
    return res.json({
      success: true,
      simulation: false,
      message: `Test email successfully dispatched to ${targetEmail}!`,
    });
  } else {
    return res.status(500).json({
      success: false,
      error: testResult.error || 'Failed to dispatch email via SMTP server.',
    });
  }
});

// ---------------- VITE MIDDLEWARE / STATIC ASSETS ----------------
// Production / Serverless Export
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  startServer().catch((err) => {
    console.error('Fatal server startup failure:', err);
  });
}

async function startServer() {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Fleet Bill 3.0 Server running at http://localhost:${PORT}`);
  });
}

export default app;
