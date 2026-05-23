# StockHereNow

StockHereNow is a lightweight stock and billing web app for agro/product businesses.
It focuses on fast invoice generation, live stock updates, customer due tracking, and simple operational reporting.

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

## Focus Areas

- Product and stock management
- Invoice generation with PDF export
- Customer profile and due tracking
- Sales and dashboard insights for day-to-day operation

## Key Features

- Add, edit, and manage products with pricing and quantity
- Generate invoices and automatically reduce stock
- Download invoices as styled PDF
- Track customers, total purchase, and outstanding due
- View invoice history directly from the invoice module
- Home dashboard with summary metrics and sales insights

## Tech Stack

- Frontend: React 19 + Vite
- Styling: Tailwind CSS
- Backend/Data: Firebase Firestore
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

2. Start development server:

```bash
npm run dev
```

3. Build production bundle:

```bash
npm run build
```

## Deployment

```bash
npm run deploy:firebase
```

Or deploy hosting directly:

```bash
firebase deploy --only hosting
```

## Documentation Notes

- Firestore collections used: `products`, `invoices`, `customers`, `customerLedger`, `dailySales`, `settings`
- Invoice creation updates stock quantities in the same write flow
- Environment values are managed via `.env` (not committed)

## License

This project is licensed under the MIT License. See the LICENSE file for details.
