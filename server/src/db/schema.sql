-- ГдеДешевле — PostgreSQL Schema
-- Run with: psql $DATABASE_URL -f src/db/schema.sql
-- Or let docker-compose mount it as an init script.

-- ─── Extensions ───────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS unaccent;

-- ─── Categories ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS categories (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  slug        TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Products ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS products (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT,
  unit         TEXT NOT NULL DEFAULT 'шт',   -- е.г. кг, л, шт, уп
  category_id  INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  image_url    TEXT,
  barcode      TEXT UNIQUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Product aliases ──────────────────────────────────────────────────────────
-- Alternative names that store scrapers might use for a canonical product.

CREATE TABLE IF NOT EXISTS product_aliases (
  id          SERIAL PRIMARY KEY,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  alias       TEXT NOT NULL,
  UNIQUE(product_id, alias)
);

-- ─── Stores ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stores (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL UNIQUE,
  slug         TEXT NOT NULL UNIQUE,
  logo_url     TEXT,
  website_url  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Prices ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS prices (
  id                  SERIAL PRIMARY KEY,
  product_id          INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  store_id            INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  price               NUMERIC(10, 2) NOT NULL CHECK (price > 0),
  price_per_unit      NUMERIC(10, 2),           -- price per kg/litre if applicable
  store_product_name  TEXT,                     -- raw name from the store
  store_product_url   TEXT,                     -- direct link on the store's site
  scraped_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, store_id)                  -- one price per (product, store) pair
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

-- Full-text search on product names
CREATE INDEX IF NOT EXISTS idx_products_fts
  ON products USING GIN (to_tsvector('russian', name || ' ' || COALESCE(description, '')));

-- Fast lookups of prices by product
CREATE INDEX IF NOT EXISTS idx_prices_product_id ON prices(product_id);

-- Fast lookups of prices by store
CREATE INDEX IF NOT EXISTS idx_prices_store_id ON prices(store_id);

-- Filter out stale prices by scrape time
CREATE INDEX IF NOT EXISTS idx_prices_scraped_at ON prices(scraped_at);

-- ─── Updated-at trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS products_updated_at ON products;
CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
