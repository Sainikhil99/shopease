-- ShopEase Database Schema
-- PostgreSQL

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── shops (one per shop owner) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shops (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_name      VARCHAR(255) NOT NULL,
  shop_name       VARCHAR(255) NOT NULL,
  phone           VARCHAR(20) UNIQUE NOT NULL,
  email           VARCHAR(255),
  address         TEXT,
  gstin           VARCHAR(20),
  logo_url        VARCHAR(500),
  report_email    VARCHAR(255),
  daily_report    BOOLEAN DEFAULT true,
  daily_time      TIME DEFAULT '21:00',
  monthly_report  BOOLEAN DEFAULT true,
  low_stock_limit INTEGER DEFAULT 5,
  pdf_attachment  BOOLEAN DEFAULT true,
  password_hash   VARCHAR(255),
  created_at      TIMESTAMP DEFAULT NOW()
);

-- ─── products ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id          UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name             VARCHAR(255) NOT NULL,
  category         VARCHAR(100) NOT NULL,
  barcode          VARCHAR(100),
  mrp              DECIMAL(10,2) NOT NULL,
  selling_price    DECIMAL(10,2) NOT NULL,
  cost_price       DECIMAL(10,2) DEFAULT 0,
  gst_rate         DECIMAL(5,2) DEFAULT 0,
  stock_qty        INTEGER DEFAULT 0,
  min_stock_alert  INTEGER DEFAULT 5,
  image_url        VARCHAR(500),
  is_active        BOOLEAN DEFAULT true,
  created_at       TIMESTAMP DEFAULT NOW(),
  updated_at       TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_shop_id ON products(shop_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);

-- ─── customers ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id      UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name         VARCHAR(255) NOT NULL,
  phone        VARCHAR(20),          -- nullable: privacy respected
  total_bills  INTEGER DEFAULT 0,
  total_spent  DECIMAL(10,2) DEFAULT 0,
  created_at   TIMESTAMP DEFAULT NOW()
);

-- ─── bills ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bills (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bill_number     VARCHAR(30) UNIQUE NOT NULL,
  shop_id         UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  customer_id     UUID REFERENCES customers(id),
  customer_name   VARCHAR(255) NOT NULL,
  customer_phone  VARCHAR(20),
  subtotal        DECIMAL(10,2) NOT NULL,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  tax_amount      DECIMAL(10,2) DEFAULT 0,
  total           DECIMAL(10,2) NOT NULL,
  payment_mode    VARCHAR(30) NOT NULL CHECK (payment_mode IN ('cash','upi','phonepe','googlepay','card')),
  coupon_code     VARCHAR(50),
  pdf_url         VARCHAR(500),
  status          VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('completed','refunded')),
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bills_shop_id ON bills(shop_id);
CREATE INDEX IF NOT EXISTS idx_bills_created_at ON bills(created_at);
CREATE INDEX IF NOT EXISTS idx_bills_customer_name ON bills(customer_name);

-- ─── bill_items ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bill_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bill_id         UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES products(id),
  product_name    VARCHAR(255) NOT NULL,   -- stored at billing time (survives product deletion)
  quantity        INTEGER NOT NULL,
  mrp             DECIMAL(10,2) NOT NULL,
  selling_price   DECIMAL(10,2) NOT NULL,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  gst_rate        DECIMAL(5,2) DEFAULT 0,
  item_total      DECIMAL(10,2) NOT NULL
);

-- ─── coupons ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coupons (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id          UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  code             VARCHAR(50) NOT NULL,
  type             VARCHAR(30) NOT NULL CHECK (type IN ('percentage','flat','bogo','combo','minimum_purchase')),
  value            DECIMAL(10,2) NOT NULL,
  min_purchase     DECIMAL(10,2) DEFAULT 0,
  product_id       UUID REFERENCES products(id),
  combo_product_id UUID REFERENCES products(id),
  expiry_date      DATE NOT NULL,
  times_used       INTEGER DEFAULT 0,
  is_active        BOOLEAN DEFAULT true,
  created_at       TIMESTAMP DEFAULT NOW(),
  UNIQUE(shop_id, code)
);

-- ─── stock_purchases ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_purchases (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id        UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  product_id     UUID NOT NULL REFERENCES products(id),
  quantity       INTEGER NOT NULL,
  purchase_price DECIMAL(10,2),
  total_cost     DECIMAL(10,2),
  supplier_name  VARCHAR(255),
  purchased_at   TIMESTAMP DEFAULT NOW()
);

-- ─── email_logs ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_logs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id      UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  type         VARCHAR(20) NOT NULL CHECK (type IN ('daily','monthly')),
  sent_at      TIMESTAMP DEFAULT NOW(),
  status       VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('sent','failed')),
  retry_count  INTEGER DEFAULT 0
);
