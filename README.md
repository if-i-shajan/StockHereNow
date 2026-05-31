# StockHereNow

StockHereNow is a lightweight stock, billing, and reporting web app for agro and product businesses. It focuses on fast invoice generation, live stock updates, customer due tracking, and simple operational reporting on desktop and mobile.

Live site: https://stockhere.web.app
StockHere is a lightweight stock, billing, and reporting web app for agro and product businesses. It focuses on fast invoice generation, live stock updates, customer due tracking, and simple operational reporting on desktop and mobile.

## 👥 Dev

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/if-i-shajan">
        <img src="https://github.com/if-i-shajan.png" width="100px" height="100px" style="object-fit:cover;" alt="Shajan"/>
        <br/>
        <b>J.M. Ifthakharul Islam Shajan</b>
      </a>
  </tr>
</table>

## Features

- Product catalog with category, company, pack size, pricing, and live stock.
- Low stock alerts with quick update links.
- Invoices with multiple line items, automatic stock reduction, and due tracking.
- Customer directory with ledger entries for manual debt and payment updates.
- Daily sales entry with multiple products per entry, profit calculation, and stock updates.
- Dashboard with 7-day sales chart, category summary, top buyers, and due list.
- Reports with PDF export, CSV download, and print-ready layouts.
- Mobile-first layout with a bottom navigation bar.

## Tech Stack

- Frontend: React 19 + Vite
- Styling: Tailwind CSS
- Data: Firebase Firestore
- Auth: Firebase Auth
- Hosting: Firebase Hosting
- PDF: jsPDF + jspdf-autotable

## Project Structure

```
src/
  components/    # Reusable UI components
  context/       # Authentication and shared context
  firebase/      # Firebase config and Firestore services
  hooks/         # Custom React hooks
  pages/         # Route-level pages (Home, Invoices, Customers, etc.)
  utils/         # Formatting and helper utilities
```

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create a .env file with your Firebase config:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

3. Start the dev server:

```bash
npm run dev
```

4. Build for production:

```bash
npm run build
```

## Scripts

- npm run dev: Start the dev server
- npm run build: Build the production bundle
- npm run preview: Preview the production build
- npm run lint: Run ESLint
- npm run deploy:firebase: Build and deploy to Firebase Hosting
- npm run deploy:watch: Auto-deploy on file changes

## Firebase Setup

- Enable Firebase Auth and Firestore in your project.
- Add your project config values to .env (see Local Setup).
- Deploy hosting with the script below.

## Data Model (Firestore)

- products
- invoices
- customers
- customerLedger
- dailySales
- settings

Notes:
- Invoice creation reduces stock quantities in the same write flow.
- Daily sales entries update stock and store profit metadata.

## Deployment

```bash
npm run deploy:firebase
```

Or deploy hosting directly:

```bash
firebase deploy --only hosting
```

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## 📮 Contact & Support

For questions, issues, or feedback:
- 📧 Email:  jmifthakharul.shajan@gmail.com

---
