-- ShopEase — incremental migrations (safe to run multiple times)
-- Run: psql $DATABASE_URL -f db/migrate.sql

-- ── 1. Add gst_rate to bills (tracks billing-level GST for GST Summary reports) ──
ALTER TABLE bills ADD COLUMN IF NOT EXISTS gst_rate DECIMAL(5,2) DEFAULT 0;

-- ── 2. Add buy_n / get_free to coupons (flexible Buy-N-Get-M support) ──
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS buy_n     INTEGER DEFAULT 1;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS get_free  INTEGER DEFAULT 1;

-- ── 3. Widen coupon type to include 'buyget' ──
-- Drop old constraint, recreate with new value included
ALTER TABLE coupons DROP CONSTRAINT IF EXISTS coupons_type_check;
ALTER TABLE coupons ADD CONSTRAINT coupons_type_check
  CHECK (type IN ('percentage','flat','bogo','buyget','combo','minimum_purchase'));

-- ── 4. Performance indexes (all IF NOT EXISTS — safe to re-run) ──

-- Bills: shop + date composite (dashboard and reports hit this constantly)
CREATE INDEX IF NOT EXISTS idx_bills_shop_date
  ON bills(shop_id, created_at DESC);

-- Bills: shop + status (most queries filter completed only)
CREATE INDEX IF NOT EXISTS idx_bills_shop_status
  ON bills(shop_id, status);

-- Bills: customer name search
CREATE INDEX IF NOT EXISTS idx_bills_customer_name
  ON bills(customer_name);

-- Bills: bill number lookup (receipt reprint)
CREATE INDEX IF NOT EXISTS idx_bills_number
  ON bills(bill_number);

-- Bill items: join from bill_id
CREATE INDEX IF NOT EXISTS idx_bill_items_bill_id
  ON bill_items(bill_id);

-- Bill items: product aggregation for reports
CREATE INDEX IF NOT EXISTS idx_bill_items_product_id
  ON bill_items(product_id);

-- Products: active products per shop (product list and barcode scan)
CREATE INDEX IF NOT EXISTS idx_products_shop_active
  ON products(shop_id, is_active);

-- Products: barcode scan (unique-ish but needs fast lookup)
CREATE INDEX IF NOT EXISTS idx_products_barcode
  ON products(barcode) WHERE barcode IS NOT NULL;

-- Coupons: shop + active + expiry (validate-coupon hot path)
CREATE INDEX IF NOT EXISTS idx_coupons_shop_active
  ON coupons(shop_id, is_active, expiry_date);

-- Coupons: code lookup
CREATE INDEX IF NOT EXISTS idx_coupons_code
  ON coupons(shop_id, code);

-- Shops: email login
CREATE UNIQUE INDEX IF NOT EXISTS idx_shops_email
  ON shops(email) WHERE email IS NOT NULL;

-- Customers: phone lookup per shop
CREATE INDEX IF NOT EXISTS idx_customers_shop_phone
  ON customers(shop_id, phone);

-- Email logs: cron job dedup check
CREATE INDEX IF NOT EXISTS idx_email_logs_shop_type
  ON email_logs(shop_id, type, sent_at DESC);

-- ── 5. Atomic bill number counter (replaces COUNT(*)+1 race condition) ──────
-- ON CONFLICT DO UPDATE is an atomic read-modify-write — safe under PM2 cluster.
-- seq_type separates bill sequences ('bill') from return sequences ('return').
CREATE TABLE IF NOT EXISTS bill_sequences (
  shop_id  UUID        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  seq_type VARCHAR(10) NOT NULL DEFAULT 'bill',
  year     INTEGER     NOT NULL,
  last_seq INTEGER     NOT NULL DEFAULT 0,
  PRIMARY KEY (shop_id, seq_type, year)
);

-- ── 5b. Migrate existing bill_sequences rows (adds seq_type if table pre-exists) ─
ALTER TABLE bill_sequences ADD COLUMN IF NOT EXISTS seq_type VARCHAR(10) NOT NULL DEFAULT 'bill';
-- Rebuild PK to include seq_type (DROP CONSTRAINT is idempotent via DO block)
DO $$ BEGIN
  ALTER TABLE bill_sequences DROP CONSTRAINT bill_sequences_pkey;
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE bill_sequences ADD PRIMARY KEY (shop_id, seq_type, year);
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

-- ── 6. DB-backed OTP store (replaces in-memory Map that breaks PM2 cluster) ─
-- Short TTL rows; cleaned by the cron in auth.js.
CREATE TABLE IF NOT EXISTS otps (
  phone      VARCHAR(20) PRIMARY KEY,
  otp_code   VARCHAR(6)  NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attempts   INTEGER     NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_otps_expires ON otps(expires_at);

-- ── 7. Returns table ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS returns (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  return_number      VARCHAR(30) UNIQUE NOT NULL,
  shop_id            UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  original_bill_id   UUID REFERENCES bills(id),
  original_bill_number VARCHAR(30),
  customer_name      VARCHAR(255) NOT NULL,
  customer_phone     VARCHAR(20),
  refund_amount      DECIMAL(10,2) NOT NULL,
  reason             TEXT,
  returned_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS return_items (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  return_id    UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  product_id   UUID REFERENCES products(id),
  product_name VARCHAR(255) NOT NULL,
  return_qty   INTEGER NOT NULL,
  selling_price DECIMAL(10,2) NOT NULL,
  cost_price    DECIMAL(10,2) DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_returns_shop_id   ON returns(shop_id);
CREATE INDEX IF NOT EXISTS idx_returns_bill_id   ON returns(original_bill_id);
CREATE INDEX IF NOT EXISTS idx_return_items_ret  ON return_items(return_id);

-- ── 8. Updated_at trigger for products ───────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS products_updated_at ON products;
CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
