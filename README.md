# ClearSpend – Smart Expense Tracker

A personal expense tracker that runs entirely in your browser.

## Run it
Open `index.html` in a modern browser (Chrome, Edge, Firefox or Safari).
No server, build step or sign-in needed. An internet connection is needed the first time
so the page can load Bootstrap 5, Bootstrap Icons, Chart.js and the Manrope font from CDNs.

## What's inside
- `index.html` – page structure, modals and navigation
- `css/style.css` – design system (blue = trust, teal/green = savings, amber/coral/red = warnings only)
- `js/app.js` – state, validation, calculations, charts and rendering

## Features
- Dashboard with six live summary cards, a doughnut/pie chart of spending by category and recent transactions
- Add, edit and delete expenses with validation and success notifications
- Transactions table with search, category filter, date range, sorting and pagination
- Monthly budget with amber (75%), coral (90%) and red (100%) warning levels
- Analytics: six-month trend, daily spending, category breakdown with drill-down
- Savings goals with progress tracking
- Settings: name, currency, JSON export/import, load sample data, clear all data

## Data
Everything is saved in your browser's localStorage under the key `clearspend.v1`.
The first launch shows fictional sample data; clear it from the dashboard banner or Settings.
