-- Drop the overly permissive UPDATE policy
DROP POLICY IF EXISTS "Anyone can increment view count" ON public.share_codes;

-- Create a more secure update policy that only allows incrementing view_count
-- by exactly 1, and only if the code hasn't exceeded max_views
CREATE OR REPLACE FUNCTION public.increment_share_view_count(share_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE public.share_codes
  SET view_count = view_count + 1
  WHERE code = share_code
  AND (max_views IS NULL OR view_count < max_views);
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count > 0;
END;
$$;

-- Grant execute permission to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION public.increment_share_view_count(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_share_view_count(TEXT) TO anon;