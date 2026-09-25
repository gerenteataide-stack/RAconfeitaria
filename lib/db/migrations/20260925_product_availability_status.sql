ALTER TABLE products ADD COLUMN IF NOT EXISTS availability_status text;

UPDATE products
SET availability_status = CASE WHEN available THEN 'available' ELSE 'sold_out' END
WHERE availability_status IS NULL;

ALTER TABLE products ALTER COLUMN availability_status SET DEFAULT 'available';
ALTER TABLE products ALTER COLUMN availability_status SET NOT NULL;

ALTER TABLE products
  ADD CONSTRAINT products_availability_status_check
  CHECK (availability_status IN ('available', 'unavailable', 'sold_out'));
