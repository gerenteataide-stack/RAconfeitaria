ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending';

UPDATE orders
SET payment_status = 'paid'
WHERE status = 'paid' AND payment_status <> 'paid';
