-- Add privacy control flag for showing buyer list in product details
-- This allows admins to enable/disable social proof feature per lot

ALTER TABLE lots 
ADD COLUMN IF NOT EXISTS show_buyers_list BOOLEAN DEFAULT false;

COMMENT ON COLUMN lots.show_buyers_list IS 'Controls whether to show buyer list in product details for social proof effect. Default false for privacy-first approach.';
