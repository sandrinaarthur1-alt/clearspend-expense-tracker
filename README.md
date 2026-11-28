# ClearSpend – Smart Expense Tracker

**Track expenses. Manage budgets. Reach your savings goals.**

ClearSpend is a personal expense tracking application designed to help users manage daily expenses, monitor monthly budgets, analyze spending habits, and track savings goals through a simple and intuitive dashboard.

**Live Demo:** [Try ClearSpend](https://clearspend-expense-tracker.vercel.app/)

## Features

- **Dashboard** — View six live summary cards, spending breakdown charts, and recent transactions.
- **Expense Management** — Add, edit, and delete expenses with input validation and success notifications.
- **Transaction History** — Search, filter by category, select date ranges, sort, and paginate transactions.
- **Monthly Budget Tracking** — Set monthly budgets and receive visual warnings at 75%, 90%, and 100% of the budget.
- **Spending Analytics** — Analyze six-month spending trends, daily expenses, and category-wise breakdowns with drill-down functionality.
- **Savings Goals** — Create savings goals and track progress.
- **Settings** — Customize your name and preferred currency.
- **Data Management** — Export and import data in JSON format, load sample data, and clear stored data.

## Technology Stack

| Frontend | Libraries & Frameworks | Storage |
| -------- | ---------------------- | ------- |
| HTML5 | Bootstrap 5 | localStorage |
| CSS3 | Bootstrap Icons | |
| JavaScript | Chart.js | |
| | Manrope Font | |

## Project Structure

```text
ClearSpend/
├── index.html
├── css/
│   └── style.css
├── js/
│   └── app.js
└── README.md
```

## Getting Started

### Prerequisites

- A modern web browser (Chrome, Edge, Firefox, or Safari)
- An internet connection to load external libraries and fonts from CDNs

### 1. Clone the Repository

```bash
git clone https://github.com/sandrinaarthur1-alt/clearspend-expense-tracker.git
cd clearspend-expense-tracker
```

### 2. Run the Application

Open `index.html` directly in your preferred web browser.

No server, build process, dependency installation, or sign-in is required.

## Architecture

- **HTML** — Defines the application structure, modals, and navigation.
- **CSS** — Handles styling, layout, and the visual design system.
- **JavaScript** — Manages application state, validation, calculations, charts, and rendering.
- **Bootstrap 5** — Provides responsive UI components.
- **Chart.js** — Powers spending charts and analytics.
- **localStorage** — Stores expense data directly in the browser under the key `clearspend.v1`.

## Data Management

- The application initially loads fictional sample data.
- Expense information is stored locally in the browser.
- Users can export and import their data in JSON format.
- Sample data can be cleared from the dashboard banner or Settings.
- No account creation or backend server is required.

## Project Status

**Deployed**

ClearSpend is deployed on Vercel and available for users to explore through the live demo.
