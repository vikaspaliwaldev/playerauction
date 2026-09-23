# 🏏 PlayerAuction - Real-Time Sports Player Auction & Live Broadcast Platform

[![Next.js](https://img.shields.io/badge/Next.js-16.3.5-black?style=flat&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.8-blue?style=flat&logo=react)](https://react.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22.0-2D3748?style=flat&logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791?style=flat&logo=postgresql)](https://www.postgresql.org/)
[![Turbopack](https://img.shields.io/badge/Bundler-Turbopack-0284c7?style=flat)](https://turbo.build/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**PlayerAuction** is a complete, real-time sports player auction management platform designed for tournament organizers, live broadcasters, stage presentations, and spectator feeds. Built with **Next.js 16 (App Router)**, **React 19**, and **Prisma ORM**, it delivers an IPL-style broadcast experience with synchronized multi-screen feeds, smart bidding rules, animated spinner wheels, and sponsor monetization.

---

## 🌟 Key Highlights & Architecture

PlayerAuction is built around a unified real-time state engine that coordinates 4 distinct screens simultaneously:

```
                          ┌────────────────────────┐
                          │   Tournament Operator  │
                          │   (/manage/[id])       │
                          └───────────┬────────────┘
                                      │ Real-Time Sync
         ┌────────────────────────────┼────────────────────────────┐
         │                            │                            │
         ▼                            ▼                            ▼
┌──────────────────┐        ┌──────────────────┐        ┌──────────────────┐
│ Broadcast / OBS  │        │ Stage Projector  │        │ Public Spectator │
│ Overlay Feed     │        │ Live Display     │        │ Mobile/Web Feed  │
│ (/live/[id]?     │        │ (/live/[id]?     │        │ (/live/[id])     │
│  tab=obs)        │        │  tab=projector)  │        │                  │
└──────────────────┘        └──────────────────┘        └──────────────────┘
```

---

## ✨ Features

### 1. 🎡 Interactive Auction Arena (`/manage/[id]`)
- **Random Spinner Wheel**: Select players randomly from the pool with realistic spin physics, or draw directly by player jersey number (`#PNo`).
- **Symmetrical Arena Display**: Real-time side-by-side comparison featuring the player's photo & profile on the left and the leading bidder franchise crest & purse on the right.
- **Quick Keyboard Bidding**:
  - Teams automatically map to **`1` through `9`** for instant keyboard bidding.
  - Custom alphabetic hotkeys (e.g. `[M]`, `[C]`, `[K]`) supported per franchise.
  - **`↑` (Up Arrow)** raises the bid without selecting a new team.
  - **`Enter`** confirms sale to leading team; **`Escape`** marks unsold.
- **High-Visibility Digital Stopwatch / Bid Timer**:
  - Live digital LED clock (`00:00`) with play (`▶`), pause (`⏸`), and reset (`↻`).
  - **Auto-resets to `00:00` on every new bid** so competing franchises receive a fresh bid window.
  - Configurable max bid time (`15s`, `20s`, `30s`, `45s`, `60s`, or `Off`).
  - **Automatic resolution on timer expiry**: Auto-sells to highest bidder or auto-marks unsold.
  - Visual pulsing red alert during the final 5 seconds.
- **Persistent Re-Auction Workflow**:
  - When marked `SOLD` or `UNSOLD`, players remain visible with a distinct badge.
  - Operator can click **`↺ RE-AUCTION`** to restore bidding, or proceed with **`NEXT PLAYER ❯`** / re-spin at their own pace.

### 2. 📈 Flexible Bid Increment Rules
- **Flat Increments**: Raise bids by fixed amounts (e.g., +₹100, +₹500, +₹1,000).
- **Tiered Slabs (IPL Style)**: Configure dynamic tiers:
  - Example: *Up to ₹1,000 $\rightarrow$ +₹100*, *₹1,000 to ₹5,000 $\rightarrow$ +₹200*, *Above ₹5,000 $\rightarrow$ +₹500*.
- Live in-arena rule switcher modal with real-time preview.

### 3. 📺 Multi-Screen Broadcast & Display Suite
- **Broadcast & OBS Overlay (`/live/[id]?tab=obs`)**:
  - Transparent background, chroma-key compatible for OBS Studio, vMix, and Wirecast.
  - Animated lower-third graphics, live bid ticker, recent sales reel, and sponsor banner.
- **Stage / Projector View (`/live/[id]?tab=projector`)**:
  - Designed for large auditorium projection and outdoor screens.
  - High-contrast visual hierarchy, large typography, and team purse standings.
- **Public Spectator Feed (`/live/[id]`)**:
  - Publicly accessible link for viewers and team owners on laptops and smartphones.
  - Live bid synchronization, squad rosters, and category breakdowns.

### 4. 🤝 Weighted Multi-Sponsor Engine
- Add multiple tournament sponsors with custom logos, hyperlinks, and weight percentage (out of 100%).
- **Deficit Round Robin (DRR)**: Fair interleaving algorithm that alternates sponsors every 10 seconds in exact proportion to their weight share without grouping or repetition.
- Sponsor banners include one-click redirects in a new tab across all display screens.

### 5. 🛡️ Franchise & Purse Management
- Real-time purse deduction and balance validation.
- Reserve point calculations to ensure teams retain enough points to complete their minimum squad size.
- Max Bid safety limit: Prevents bidding beyond what a team can legally afford.
- Team roster overview and breakdown by player categories (e.g., Batsman, Bowler, All-Rounder, Wicketkeeper).

### 6. 👥 Jodi / Pair Auctions
- Support for paired "Jodi" auctions where two players are bid on together as a package and their final price is automatically split evenly upon sale.

### 7. 👤 Comprehensive Player Directory
- Full player management with avatar uploads, roles, batting/bowling styles, and categories.
- Sold player cards feature the **acquiring franchise's crest/avatar** on the right side.
- Auction cancellation support: Canceling a sale automatically restores the player to available status and refunds the franchise's purse.

---

## ⌨️ Operator Keyboard Shortcuts

| Shortcut Key | Function |
| :--- | :--- |
| **`1` – `9`** | Instantly place bid for Franchise #1 through #9 |
| **`[Custom Key]`** | Place bid for Franchise with assigned hotkey (e.g., `M`, `C`) |
| **`↑` (Up Arrow)** | Increment bid by active increment slab |
| **`Enter`** | Sell player to the current leading bidder |
| **`Escape`** | Mark current player as UNSOLD |
| **`Spacebar`** | Toggle Stopwatch Timer (Play / Pause) |

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16 (App Router)](https://nextjs.org/)
- **UI Library**: [React 19](https://react.dev/)
- **Database & ORM**: [Prisma 5](https://www.prisma.io/) with PostgreSQL (or SQLite)
- **Styling**: Vanilla CSS Design System with responsive grid, glassmorphism, and dark theme
- **Security**: JWT (`jsonwebtoken`) & password hashing with `bcryptjs`
- **Compiler**: Next.js Turbopack

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.17.0 or higher
- **npm**, **yarn**, or **pnpm**
- A **PostgreSQL** database (e.g. [Aiven](https://aiven.io/), [Supabase](https://supabase.com/), [Neon](https://neon.tech/), or local PostgreSQL)

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/PlayerAuction.git
cd PlayerAuction
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Edit `.env` with your database credentials:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/player_auction?sslmode=prefer"
JWT_SECRET="your-super-secret-jwt-key"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 4. Push Database Schema
Generate Prisma Client and push the schema to your database:
```bash
npx prisma db push
```

*(Optional) Inspect your database using Prisma Studio:*
```bash
npx prisma studio
```

### 5. Start the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📁 Project Structure

```
PlayerAuction/
├── prisma/
│   └── schema.prisma         # Prisma data models (Tournament, Team, Player, Sale, Sponsor)
├── public/                   # Static assets & icons
├── src/
│   ├── app/
│   │   ├── api/              # Next.js API route handlers
│   │   │   ├── auth/         # Login & registration APIs
│   │   │   └── tournaments/  # Tournaments, teams, players, auction state, sponsors
│   │   ├── live/[id]/        # Multi-view screens (OBS Overlay, Projector, Public Spectator)
│   │   ├── manage/[id]/      # Auction master admin dashboard & operator arena
│   │   ├── globals.css       # Unified CSS design system & animations
│   │   ├── layout.js         # Root layout
│   │   └── page.js           # Landing page
│   ├── components/           # Modular React components
│   │   ├── AuctionArena.js   # Live auction table, stopwatch HUD, bid buttons
│   │   ├── BidRulesModal.js  # Increment rules configuration
│   │   ├── PlayerList.js     # Player roster with sold team avatars
│   │   ├── SpinnerWheel.js   # Animated random player drawing wheel
│   │   ├── TeamSummary.js    # Team purse, rosters & shortcut keys
│   │   └── SetupPanel.js     # Tournament configuration & demo data seeder
│   └── lib/                  # Utilities (auth, auction rules, sponsor rotation)
├── .env.example              # Environment variables template
├── package.json              # Project metadata and dependencies
└── README.md                 # Project documentation
```

---

## 🌐 URLs & Screen Endpoints

| View | Route | Purpose |
| :--- | :--- | :--- |
| **Auction Operator** | `/manage/[tournamentId]` | Master auctioneer controls, bids, timer & spinner |
| **OBS / Stream Overlay** | `/live/[tournamentId]?tab=obs` | Transparent graphics for streaming software |
| **Stage Projector** | `/live/[tournamentId]?tab=projector` | High-contrast full-screen view for auditoriums |
| **Public Spectator** | `/live/[tournamentId]` | Fan & owner live tracking screen |

---

## 📦 Production Build

To build the project for production:

```bash
npm run build
npm run start
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
