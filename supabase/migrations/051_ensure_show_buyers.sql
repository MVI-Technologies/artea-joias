-- Ensure show_buyers_list column exists
ALTER TABLE lots 
ADD COLUMN IF NOT EXISTS show_buyers_list BOOLEAN DEFAULT false;

COMMENT ON COLUMN lots.show_buyers_list IS 'Indicates if buyers list should be shown publicly on the catalog page';
