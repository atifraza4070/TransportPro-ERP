# Fleet Bill 3.0: Complete GitHub, Free Hosting & Custom Domain Guide

This comprehensive guide covers:
1. **Fixing the "Unexpected token 'T'" Error on GitHub**: Why it happened and how Fleet Bill 3.0's new **Hybrid Client Engine** resolves it completely.
2. **Pushing Your Updated Code to GitHub**.
3. **Hosting Option A: 100% Free Static Hosting on GitHub Pages** (No server needed, works out of the box with browser storage & Firebase).
4. **Hosting Option B: 100% Free Full-Stack Cloud Server on Render.com or Koyeb** (Runs Node.js/Express backend 24/7 with centralized cloud database).
5. **Purchasing & Connecting Your Personal Domain** (e.g. `yourdomain.com`, `fleetbill.pk`) with free automatic SSL/HTTPS.

---

## 1. Why Did the Error Occur on GitHub?

### The Cause
When you published the repository to GitHub and viewed it (for instance via GitHub Pages):
* **GitHub Pages is a static web file server**: It only serves HTML, CSS, and JavaScript files. It does **not** execute a backend Node.js server (`server.ts`).
* When you clicked **"Sign In"** or **"Register"**, the browser sent a network request to `/api/auth/login` or `/api/auth/register`.
* Because there was no Node.js server running to handle `/api/`, GitHub Pages responded with an HTTP **404 Page Not Found** HTML document (`<!DOCTYPE html><html>The page you requested...</html>`).
* When the application tried to read this as JSON (`await res.json()`), the JavaScript parser encountered the letter **"T"** (from *"The page..."*) instead of a `{` JSON bracket and threw:
  ```
  SyntaxError: Unexpected token 'T', "The page you"... is not valid JSON
  ```

### How We Fixed It
We integrated an intelligent **Hybrid Client Engine (`src/lib/client-api-interceptor.ts`)** into Fleet Bill 3.0:
1. **Automatic Static/Offline Detection**: When running on GitHub Pages (or whenever an `/api` backend server is absent), the app automatically intercepts all `/api/` network requests right inside your browser.
2. **Local Client Storage & Firebase Sync**:
   * **Registration**: When you register a new transporter, the account is created, issued a secure session token, and saved in your browser's persistent storage.
   * **Login**: You can log in using your newly registered credentials OR the preloaded accounts (`iklogisticsofficial@gmail.com` with `Password@123`, or `admin@fleetbill.com` with `Admin@123456`).
   * **Full Billing Features**: Invoices, freight rate sheets, customer lists, vehicle fleet, financial totals, and Excel export all work 100% smoothly without needing an external server!
3. **Defensive Response Parsing**: All API calls now verify that the response is JSON before parsing, preventing any `Unexpected token` errors.

---

## 2. Push the Updated Code to Your GitHub Repository

To apply this fix to your GitHub site, push the latest files from your project:

```bash
# 1. Open your terminal in the fleet-bill project folder

# 2. Check changed files
git status

# 3. Stage all new files and updates
git add .

# 4. Commit the changes
git commit -m "Add hybrid client API engine for GitHub Pages support and fix auth parsing"

# 5. Push to GitHub
git push origin main
```

---

## 3. Free Hosting Option A: GitHub Pages (Zero-Server Static Hosting)

If you want to host directly on GitHub for free without configuring any external server:

### Step 1: Build the Production Distribution
In your terminal, run:
```bash
npm run build
```
This generates the optimized production build in the `dist/` directory.

### Step 2: Configure GitHub Pages
1. Go to your repository on **GitHub.com**.
2. Click **Settings** $\rightarrow$ **Pages** (in the left sidebar).
3. Under **Build and deployment**:
   * If using GitHub Actions: Choose **GitHub Actions** and select the **Static HTML** or **Vite** starter workflow.
   * Or if deploying from branch: Select the branch containing your built files (`gh-pages` or `main /dist`).
4. Once published, your URL will be:
   `https://<your-username>.github.io/<repository-name>/`
5. Open the URL in your browser:
   * Click **Sign in** with `iklogisticsofficial@gmail.com` / `Password@123`.
   * Or click the **Register Transporter** tab and create your own company account!

---

## 4. Free Hosting Option B: Render.com (Full-Stack Node.js Server)

If you want a **centralized cloud backend** where multiple employees can log in from different computers and all share the exact same live database simultaneously:

Render provides **free Node.js web services** connected directly to your GitHub repository:

### Step 1: Sign Up on Render
1. Visit [https://render.com](https://render.com) and click **Sign Up** (choose **Sign in with GitHub**).

### Step 2: Create a New Web Service
1. In the Render Dashboard, click **New +** $\rightarrow$ **Web Service**.
2. Select **Build and deploy from a Git repository**.
3. Choose your `fleet-bill-3` GitHub repository and click **Connect**.

### Step 3: Configure Settings
Fill in these fields:
* **Name**: `fleet-bill-3` (or your company name)
* **Region**: Choose the closest region (e.g., Singapore / Frankfurt)
* **Branch**: `main`
* **Runtime**: `Node`
* **Build Command**: `npm install && npm run build`
* **Start Command**: `npm start`
* **Instance Type**: Select **Free** ($0.00/month)

### Step 4: Add Environment Variables
Scroll down to **Environment Variables** and add:
* `NODE_ENV` = `production`
* `PORT` = `3000`
* `JWT_SECRET` = `fleetbill_super_secure_key_2026`

### Step 5: Deploy
Click **Create Web Service**.
Render will automatically clone your GitHub repository, install packages, build the application, and start the server. Within 2 to 3 minutes, you will receive a free public URL:
`https://fleet-bill-3.onrender.com`

---

## 5. How to Purchase & Connect Your Personal Domain Later

When you are ready to use a branded custom domain (like `www.yourcompany.com` or `billing.yourtransports.pk`):

### Step 1: Purchase Your Domain
You can purchase a domain from any reputable registrar:
* [Namecheap](https://www.namecheap.com)
* [Cloudflare](https://www.cloudflare.com/products/registrar/)
* [GoDaddy](https://www.godaddy.com)
* [PKNIC](https://www.pknic.net.pk) (for `.pk` domains)

### Step 2: Connect Domain to GitHub Pages (If using Option A)
1. On GitHub.com, navigate to your repository **Settings** $\rightarrow$ **Pages**.
2. In the **Custom domain** box, enter your domain name (e.g. `www.yourcompany.com`).
3. Click **Save**.
4. Log into your domain registrar's DNS manager and add:
   * **CNAME Record**:
     * Host/Name: `www`
     * Value/Target: `<your-username>.github.io`
   * **A Records** (to point the apex domain `yourcompany.com`):
     * Point `@` to GitHub's IP addresses:
       * `185.199.108.153`
       * `185.199.109.153`
       * `185.199.110.153`
       * `185.199.111.153`
5. Check the box **Enforce HTTPS** on GitHub Pages (free SSL is provisioned automatically).

### Step 3: Connect Domain to Render (If using Option B)
1. In your Render Dashboard, select your `fleet-bill-3` service.
2. Go to **Settings** $\rightarrow$ **Custom Domains**.
3. Click **Add Custom Domain** and enter `www.yourcompany.com` and `yourcompany.com`.
4. Render will display the DNS records to add:
   * **CNAME Record**: Host `www`, Value `fleet-bill-3.onrender.com`.
   * **A Record**: Host `@`, Value provided by Render.
5. Once DNS updates (5 to 30 minutes), Render automatically generates a free **Let's Encrypt SSL certificate** with HTTPS encryption.

---

## Summary Checklist

| Goal | Solution | Cost |
|---|---|---|
| Fix `Unexpected token 'T'` on GitHub | Hybrid Client API Engine (now installed) | Free |
| Deploy without managing a server | GitHub Pages | Free |
| Deploy with centralized cloud Node server | Render.com or Koyeb | Free |
| Connect custom domain + SSL | CNAME / A Records | Free SSL included |
