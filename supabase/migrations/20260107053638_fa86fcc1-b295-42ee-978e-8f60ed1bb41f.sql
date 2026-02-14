-- Create table for share codes
CREATE TABLE public.share_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('file', 'link')),
  item_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.share_codes ENABLE ROW LEVEL SECURITY;

-- Users can create share codes for their own items
CREATE POLICY "Users can create share codes for their own items"
ON public.share_codes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own share codes
CREATE POLICY "Users can view their own share codes"
ON public.share_codes
FOR SELECT
USING (auth.uid() = user_id);

-- Users can delete their own share codes
CREATE POLICY "Users can delete their own share codes"
ON public.share_codes
FOR DELETE
USING (auth.uid() = user_id);

-- Anyone can view share code to access shared item (public access by code)
CREATE POLICY "Anyone can access share codes by code"
ON public.share_codes
FOR SELECT
USING (true);

-- Create index for faster code lookup
CREATE INDEX idx_share_codes_code ON public.share_codes(code);
CREATE INDEX idx_share_codes_item ON public.share_codes(item_type, item_id);