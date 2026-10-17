# Fleet Bill 3.0: Complete System Manual, Hosting & Custom Domain Guide

---

## 1. The Two Portals & URLs (Transporter vs. Super Admin)

The system is configured with two distinct entry portals:

| Portal | Intended User | Public URL | What is Displayed |
|---|---|---|---|
| **Transporter Portal** | All Transporters & Clients | `https://your-domain.com/` | Clean **Transporter Sign In** and **New Registration** only. The Super Admin tab is **100% hidden** so transporters never see or access admin controls. |
| **Super Admin HQ** | You (System Owner) | `https://your-domain.com/?admin=true`<br>*(also works with `#admin` or `/admin`)* | Dedicated **Super Administrator Control Center** with gold shield security lock. Full management of all transporters, subscription approvals, custom vehicle types, pricing, and SMTP email settings. |

### Super Admin Default Credentials
- **Admin Email**: `atifraza4070@gmail.com` (or `admin@fleetbill.com`)
- **Admin Password**: `Admin@123456`

*(When you log in through `?admin=true`, the system immediately opens your Super Admin HQ dashboard).*

---

## 2. How to Run & Host 100% Free (Live for All Transporters)

You do **not** need to pay for hosting. You have two excellent 100% free options:

### Option A: Use Your Current Live Cloud Run URL (Instant & Free)
Your app is already compiled and running on Google Cloud Run:
- **Transporter Link**: `https://ais-pre-y5ndjlflssdqx43cssx5nb-181255096325.asia-northeast1.run.app/`
- **Super Admin Link**: `https://ais-pre-y5ndjlflssdqx43cssx5nb-181255096325.asia-northeast1.run.app/?admin=true`

You can share the Transporter link with transporters immediately.

---

### Option B: Free 24/7 Cloud Hosting on Render.com (Connected to GitHub)
If you push your code to your GitHub repository and want a permanent free server:

1. **Create a Free Account**: Visit [https://render.com](https://render.com) and click **Sign Up with GitHub**.
2. **Create New Web Service**:
   - In Render Dashboard, click **New +** $\rightarrow$ **Web Service**.
   - Select **Build and deploy from a Git repository** and connect your `fleet-bill` repo.
3. **Set Build & Start Commands**:
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: Select **Free ($0.00/month)**.
4. **Environment Variables**:
   Under **Advanced / Environment Variables**, add:
   - `NODE_ENV` = `production`
   - `PORT` = `3000`
   - `JWT_SECRET` = `fleetbill_super_secret_key_2026`
5. **Click "Create Web Service"**:
   Render builds the app in ~2 minutes and gives you a free live URL:
   `https://fleet-bill.onrender.com`

---

## 3. How to Connect Your Own Custom Domain (If You Buy One)

If you purchase a custom domain (e.g. `fleetbill.com`, `iklogistics.pk`, or `pakfreight.com`):

### Step 1: Purchase the Domain
You can buy from any registrar:
- [Namecheap.com](https://www.namecheap.com) (recommended for `.com`)
- [Cloudflare.com](https://www.cloudflare.com) (lowest wholesale renewal prices)
- [GoDaddy.com](https://www.godaddy.com)
- [PKNIC.net.pk](https://www.pknic.net.pk) (for `.pk` or `.com.pk` domains)

### Step 2: Add Domain in Render (or your hosting provider)
1. Go to your Render Dashboard $\rightarrow$ select your `fleet-bill` service.
2. Click **Settings** $\rightarrow$ scroll down to **Custom Domains**.
3. Click **Add Custom Domain** and enter:
   - `yourdomain.com`
   - `www.yourdomain.com`

### Step 3: Configure DNS Records at Your Domain Registrar
Log into where you bought your domain (Namecheap, GoDaddy, or Cloudflare DNS manager) and add two records:

| Record Type | Name / Host | Target / Value | TTL |
|---|---|---|---|
| **CNAME** | `www` | `fleet-bill.onrender.com` | Automatic / 1 Hour |
| **A** | `@` | Point to the IP address displayed in your Render dashboard | Automatic / 1 Hour |

*Render automatically provisions a free **Let's Encrypt SSL certificate** with HTTPS encryption within 15–30 minutes.*

---

## 4. Transporter User Guide (How Transporters Use the System)

### Step 1: Sign Up & Log In
1. Transporter opens `https://your-domain.com/`.
2. Clicks **New Registration**, enters their Name, Company Name (e.g. *IK Logistics*), Mobile, Email, and Password.
3. Verifies their email via OTP code.
4. Logs into their dedicated portal.

### Step 2: Upload Freight Rates from Excel
1. Transporter goes to **Freight Rates** in the sidebar.
2. Under **Dispatch Rates (Excel Master)**, clicks **Upload Excel File**.
3. Selects their Excel spreadsheet (`.xlsx`, `.xls`, or `.csv`).
4. The system automatically reads and maps the 7 columns:
   1. `Dispatch No.`
   2. `Freight Order No.`
   3. `Loading Date`
   4. `Vehicle No.`
   5. `Vehicle Type`
   6. `Destination`
   7. `Freight Rate`
5. Transporter reviews the preview table and clicks **Import & Save Rates**.
6. Any new vehicle types in the file are automatically registered in their catalog.

### Step 3: Create an Invoice with Automatic Population (Most Important Feature)
1. Transporter goes to **Invoices & Billing** $\rightarrow$ **Create New Invoice**.
2. **Step 1: Automatic Auto-Fill**:
   - In the quick-fill bar, types or selects the **Dispatch No.** (e.g. `CD81052367`) and clicks **Auto-Populate Trip** (or types it directly into the line item).
   - The system instantly searches their imported Freight Rate records and populates all 7 fields:
     - Dispatch No.
     - Freight Order No.
     - Loading Date
     - Vehicle No.
     - Vehicle Type
     - Destination City
     - Freight Rate (PKR)
3. **All fields remain 100% editable**:
   - If vehicle number changed, they can correct it.
   - If freight rate was renegotiated, they can change the amount.
   - If a new vehicle type is needed, they can select **+ Add New Vehicle Type...** directly in the dropdown.
   - Row subtotals and invoice totals update immediately.
4. **Duplicate Protection**:
   - If the Dispatch No. was already billed in another invoice, a warning banner appears showing the invoice number.
5. **Save & Export**:
   - Transporter clicks **Save Invoice**.
   - Can print in Portrait or Landscape, download high-definition PDF, export to styled Excel, or email directly with PDF attachment to the customer.

---

## 5. Super Admin Guide (How You Manage Everything)

### Step 1: Open Super Admin HQ
Open `https://your-domain.com/?admin=true` and sign in with:
- **Email**: `atifraza4070@gmail.com`
- **Password**: `Admin@123456`

### Step 2: Transporter Management & Approvals
In **Super Admin HQ $\rightarrow$ Transporters**:
- View all registered transporters, their company names, contact numbers, NTN numbers, and registration dates.
- View subscription status: `Active`, `Pending Approval`, or `Expired`.
- **Approve / Renew Plan**: Click **Approve / Extend** to grant 1 Month, 6 Months, or 12 Months of access.
- **Deactivate / Suspend**: One-click toggle to suspend an account if payments are overdue.

### Step 3: Subscription Pricing & Bank Details
In **Super Admin HQ $\rightarrow$ Pricing & Banking**:
- Set your Monthly subscription fee (e.g. Rs. 5,000) and Yearly fee (e.g. Rs. 50,000).
- Enter your Bank Name, Account Title, Account Number, IBAN, and Support WhatsApp number.
- Transporters see these details when renewing their subscriptions.

### Step 4: Configure Live SMTP Email Delivery
In **Super Admin HQ $\rightarrow$ Email Delivery (SMTP)**:
- Enter your Gmail address (e.g. `yourcompany@gmail.com`) and Google App Password (16-character password generated in Google Account Security).
- Click **Send Test Email** to verify instant live delivery for verification codes and invoice PDFs.

---

## 6. Quick Reference Summary

- **Transporter Link**: `https://<your-host>/` *(shows only Sign In & Sign Up — no admin link visible)*
- **Admin Link**: `https://<your-host>/?admin=true` *(restricted super admin access)*
- **Excel Upload**: In Freight Rates $\rightarrow$ Upload Excel $\rightarrow$ Review $\rightarrow$ Save.
- **Auto-Fill**: In Create Invoice $\rightarrow$ Enter Dispatch No. $\rightarrow$ Auto-fills 7 fields $\rightarrow$ Fully editable.

---

## 7. Troubleshooting: Resolving the Google Cloud / Firebase IAM Error

### Error Description
```json
{
  "code": 3,
  "message": "Exception calling IAM: Service account firebase-adminsdk-fbsvc@fleet-bill-software.iam.gserviceaccount.com does not exist.",
  "serviceName": "cloudresourcemanager.googleapis.com",
  "methodName": "SetIamPolicy",
  "resourceName": "projects/fleet-bill-software"
}
```

### Why this occurred
Google Cloud Project `fleet-bill-software` attempted to apply an IAM policy granting permissions (`roles/firebase.sdkAdminServiceAgent` and `roles/iam.serviceAccountTokenCreator`) to the service account `firebase-adminsdk-fbsvc@fleet-bill-software.iam.gserviceaccount.com`. Because that specific service account was not yet created (or was removed), Google Cloud rejected the policy with Code 3 (`INVALID_ARGUMENT`).

### How to resolve it in 2 minutes:

#### Solution 1: Create the Missing Service Account in Google Cloud (Recommended)
1. Open Google Cloud Console:
   👉 **[https://console.cloud.google.com/iam-admin/serviceaccounts?project=fleet-bill-software](https://console.cloud.google.com/iam-admin/serviceaccounts?project=fleet-bill-software)**
2. Click **+ CREATE SERVICE ACCOUNT** at the top.
3. Fill in the details:
   - **Service account name**: `firebase-adminsdk-fbsvc`
   - **Service account ID**: `firebase-adminsdk-fbsvc`
   *(This matches the email `firebase-adminsdk-fbsvc@fleet-bill-software.iam.gserviceaccount.com` exactly)*
4. Click **Create and Continue**.
5. In **Grant this service account access to project**, add these 2 roles:
   - **Firebase Admin SDK Administrator Service Agent** (`roles/firebase.sdkAdminServiceAgent`)
   - **Service Account Token Creator** (`roles/iam.serviceAccountTokenCreator`)
6. Click **Done**.
7. Run your Firebase operation or deploy again — it will now succeed immediately with no errors!

#### Solution 2: Via Firebase Console (Automatic Provisioning)
1. Open Firebase Console:
   👉 **[https://console.firebase.google.com/project/fleet-bill-software/settings/serviceaccounts/adminsdk](https://console.firebase.google.com/project/fleet-bill-software/settings/serviceaccounts/adminsdk)**
2. Under **Firebase Admin SDK**, click **Generate new private key**.
3. Confirm the dialog. Firebase automatically creates the service account with the appropriate IAM permissions.

#### Note on Fleet Bill 3.0 Architecture
Fleet Bill 3.0 runs as a high-speed, self-contained server with its own built-in secure database and session manager. It does not require Firebase Admin SDK to process invoices, calculate freight, import Excel files, or generate PDFs. Resolving the IAM service account ensures your Google Cloud project policies are clean and error-free.

