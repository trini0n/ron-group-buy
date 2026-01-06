# Group Buy Web Application

A modern web interface for the MTG card Group Buy system, built with SvelteKit, Svelte 5, and Supabase.

## Features

- 🃏 **Card Catalog** - Browse and search Magic: The Gathering cards
- 🛒 **Shopping Cart** - Persistent cart saved between sessions
- 📦 **Deck Import** - Import decklists from Moxfield or Archidekt
- 🔐 **Authentication** - Sign in with Google or Discord
- 📋 **Order Management** - Track order status and shipping
- ⚡ **Real-time Updates** - Instant stock updates across all users

## Tech Stack

- **Frontend**: SvelteKit + Svelte 5 (runes)
- **Styling**: Tailwind CSS + shadcn-svelte
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth (Google, Discord OAuth)
- **Hosting**: Vercel

## Getting Started

### Prerequisites

- Node.js 20+
- npm or pnpm
- Supabase account

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/group-buy.git
   cd group-buy
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the environment file:
   ```bash
   cp .env.example .env
   ```

4. Update `.env` with your Supabase credentials:
   ```
   PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

5. Set up the database:
   ```bash
   npx supabase db push
   ```

6. Sync cards from the MASTER CSV:
   ```bash
   npm run sync:cards
   ```

7. Start the development server:
   ```bash
   npm run dev
   ```

## Project Structure

```
src/
├── lib/
│   ├── components/
│   │   ├── cards/        # Card catalog components
│   │   ├── layout/       # Header, Footer, etc.
│   │   └── ui/           # shadcn-svelte components
│   ├── server/           # Server-only code
│   │   ├── admin.ts      # Admin Supabase client
│   │   ├── database.types.ts
│   │   └── types.ts      # TypeScript types
│   ├── stores/           # Svelte stores
│   │   └── cart.svelte.ts
│   ├── supabase.ts       # Supabase client factory
│   └── utils.ts          # Utility functions
├── routes/
│   ├── +layout.svelte    # Root layout
│   ├── +page.svelte      # Home / Card catalog
│   ├── auth/             # OAuth callbacks
│   ├── cards/[serial]/   # Card detail pages
│   ├── cart/             # Cart page
│   ├── checkout/         # Checkout flow
│   └── orders/           # Order history
└── app.css               # Global styles
```

## Configuration

### Supabase Setup

1. Create a new Supabase project
2. Enable Google and Discord OAuth providers in Authentication settings
3. Run the migration in `supabase/migrations/`
4. Configure Row Level Security policies (included in migration)

### Vercel Deployment

1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy!

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run sync:cards` | Sync cards from MASTER CSV |
| `npm run db:generate` | Generate TypeScript types from database |

## Pricing

| Card Type | Price |
|-----------|-------|
| Normal | $1.25 |
| Holo | $1.25 |
| Foil | $1.50 |

## License

Private - All rights reserved.
