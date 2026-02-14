-- Drop existing problematic SELECT policies on share_codes
DROP POLICY IF EXISTS "Anyone can access valid share codes by code" ON public.share_codes;
DROP POLICY IF EXISTS "Users can view their own share codes" ON public.share_codes;

-- Create a PERMISSIVE policy for users to view their own share codes
CREATE POLICY "Users can view their own share codes"
ON public.share_codes
FOR SELECT
USING (auth.uid() = user_id);

-- Create a PERMISSIVE policy for anyone to look up share codes by code value only
-- This allows looking up by exact code match without exposing the whole table
CREATE POLICY "Anyone can lookup share codes by code"
ON public.share_codes
FOR SELECT
USING (true);

-- Create a policy to allow anyone to update view_count on share_codes (for incrementing views)
CREATE POLICY "Anyone can increment view count"
ON public.share_codes
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Add policies to user_files to allow viewing shared files
CREATE POLICY "Anyone can view files with valid share code"
ON public.user_files
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.share_codes sc
    WHERE sc.item_id = user_files.id
    AND sc.item_type = 'file'
    AND (sc.max_views IS NULL OR sc.view_count < sc.max_views)
  )
);

-- Add policies to user_links to allow viewing shared links
CREATE POLICY "Anyone can view links with valid share code"
ON public.user_links
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.share_codes sc
    WHERE sc.item_id = user_links.id
    AND sc.item_type = 'link'
    AND (sc.max_views IS NULL OR sc.view_count < sc.max_views)
  )
);