## Pivot CryptoVest into a Trading Signals Platform

Transform the app into a crypto trading platform where users deposit crypto, then receive auto-generated trading signals via an in-house chatbot. Users "take" a signal with a stake amount and earn a 3% profit on that stake when the signal closes.

### What gets removed
- Investment packages, marketplace, QM Token, referral system, earnings_log
- All related pages, components, admin tabs, and DB tables

### What stays
- Auth, profiles, crypto deposit flow concept, withdrawals, admin panel shell, dark crypto design

### New data model
- `deposits` — user_id, amount_usd, crypto_currency, crypto_amount, tx_hash, proof_url, status (pending/approved/rejected). Approval credits `profiles.deposit_balance`.
- `signals` — pair (e.g. BTC/USDT), direction (LONG/SHORT), entry_price, target_price, status (open/closed), opens_at, closes_at, profit_percentage (default 3.00), message (chatbot text).
- `signal_takes` — user_id, signal_id, stake_amount, profit_amount, status (active/won). Profit credited when signal closes.
- `profiles.deposit_balance` replaces `total_balance` semantics.

### Signal generation
- Edge function `generate-signal` (pg_cron, every 4 hours): picks a random crypto pair + direction, creates an open signal with `closes_at = now + 2h`, posts a chatbot message.
- Edge function `close-signals` (pg_cron, every 5 min): for each signal whose `closes_at < now` and status=open → mark closed, credit each taker's stake × 3% to their `deposit_balance`, mark take as won.

### Chatbot page (`/signals`)
- Chat-style UI listing signals chronologically as bot messages with cards: pair, direction, entry, target, countdown, profit %.
- For each open signal: user enters stake amount (≤ balance), clicks "Take Signal" → creates signal_take, locks stake (deducts from balance immediately) and shows "Active" state.
- Closed signals show profit credited.
- Realtime subscription on `signals` + `signal_takes`.

### Dashboard (`/dashboard`)
- Cards: Deposit Balance, Total Profits, Active Trades, Total Deposited
- Buttons: Deposit, Withdraw, Go to Signals
- Recent trades list

### Deposit flow (`/deposit` dialog)
- Pick BTC or USDT (TRC20/ERC20), enter USD amount → show wallet address + QR, submit tx hash + proof image, status pending until admin approves.

### Admin panel
- Tabs: Deposits (approve/reject), Withdrawals (existing), Signals (manual create + view history), Users, Settings.

### Landing page
- Hero: "AI-Powered Crypto Trading Signals — 3% per trade"
- Sections: How it works (Deposit → Receive signals in chat → Take trade → Profit), Live signal preview, Stats, CTA.

### Technical notes
- Migration: drop investments/packages/earnings/token_* tables (cascade); add new tables with GRANTs + RLS; rename/repurpose `profiles.total_balance` → keep as deposit_balance.
- Reuse `payment-proofs` storage bucket.
- Cron via pg_cron + pg_net calling edge functions with anon key.
- Stake deduction + take creation in a Postgres function `take_signal(signal_id, stake)` (SECURITY DEFINER, validates balance and open status atomically).
- Closing logic in `close-signals` edge function using service role.

### Out of scope (this iteration)
- Real exchange integration / real trading
- Per-user referrals (removed)
- AI-generated signal text (rule-based templated messages from the bot)