-- Add view limit columns to share_codes table
ALTER TABLE public.share_codes 
ADD COLUMN IF NOT EXISTS max_views integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS view_count integer DEFAULT 0 NOT NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_share_codes_code ON public.share_codes(code);

-- Update RLS policy for public access to check view limits
DROP POLICY IF EXISTS "Anyone can access share codes by code" ON public.share_codes;

CREATE POLICY "Anyone can access valid share codes by code" 
ON public.share_codes 
FOR SELECT 
USING (
  max_views IS NULL OR view_count < max_views
);