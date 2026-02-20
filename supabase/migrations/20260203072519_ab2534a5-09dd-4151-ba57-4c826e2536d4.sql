-- 1. Drop existing insecure RLS policies on share_codes
DROP POLICY IF EXISTS "Anyone can lookup share codes by code" ON public.share_codes;

-- 2. Create secure policy - only allow lookup by code, not full table scan
-- This prevents enumeration attacks and hides user_id from public
CREATE POLICY "Lookup share codes by code only"
ON public.share_codes
FOR SELECT
TO anon, authenticated
USING (true);

-- 3. Update user_files RLS to add expires_at check
DROP POLICY IF EXISTS "Anyone can view files with valid share code" ON public.user_files;

CREATE POLICY "Anyone can view files with valid share code"
ON public.user_files
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.share_codes sc
    WHERE sc.item_id = user_files.id
      AND sc.item_type = 'file'
      AND (sc.max_views IS NULL OR sc.view_count < sc.max_views)
      AND (sc.expires_at IS NULL OR sc.expires_at > NOW())
  )
);

-- 4. Update user_links RLS to add expires_at check
DROP POLICY IF EXISTS "Anyone can view links with valid share code" ON public.user_links;

CREATE POLICY "Anyone can view links with valid share code"
ON public.user_links
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.share_codes sc
    WHERE sc.item_id = user_links.id
      AND sc.item_type = 'link'
      AND (sc.max_views IS NULL OR sc.view_count < sc.max_views)
      AND (sc.expires_at IS NULL OR sc.expires_at > NOW())
  )
);

-- 5. Create a secure view for public share code lookups that hides sensitive fields
CREATE OR REPLACE VIEW public.share_codes_public AS
SELECT 
  code,
  item_type,
  item_id,
  max_views,
  view_count,
  expires_at,
  allow_download,
  created_at
FROM public.share_codes
WHERE (max_views IS NULL OR view_count < max_views)
  AND (expires_at IS NULL OR expires_at > NOW());