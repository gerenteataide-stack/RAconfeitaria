ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_notification_key_hash text;

CREATE TABLE IF NOT EXISTS customer_order_push_tokens (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  token text NOT NULL,
  token_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS customer_order_push_tokens_order_token_hash_unique
  ON customer_order_push_tokens (order_id, token_hash);

CREATE INDEX IF NOT EXISTS customer_order_push_tokens_order_id_idx
  ON customer_order_push_tokens (order_id);
