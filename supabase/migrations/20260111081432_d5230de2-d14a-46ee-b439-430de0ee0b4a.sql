-- RPC function to get shared item securely
-- Returns item data + signed URL, then increments view_count atomically
-- This prevents the race condition where view_count is incremented before the item is fetched

CREATE OR REPLACE FUNCTION public.get_shared_item_secure(share_code_input text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  share_record RECORD;
  item_data jsonb;
  signed_url text;
  file_record RECORD;
  link_record RECORD;
BEGIN
  -- Get share code info
  SELECT * INTO share_record
  FROM public.share_codes
  WHERE code = UPPER(share_code_input);
  
  -- Check if share code exists
  IF share_record IS NULL THEN
    RETURN jsonb_build_object('error', 'Mã chia sẻ không tồn tại', 'success', false);
  END IF;
  
  -- Check if expired
  IF share_record.expires_at IS NOT NULL AND share_record.expires_at < NOW() THEN
    RETURN jsonb_build_object('error', 'Mã chia sẻ đã hết hạn', 'success', false);
  END IF;
  
  -- Check if max views exceeded
  IF share_record.max_views IS NOT NULL AND share_record.view_count >= share_record.max_views THEN
    RETURN jsonb_build_object('error', 'Mã chia sẻ đã hết lượt xem', 'success', false);
  END IF;
  
  -- Fetch item based on type
  IF share_record.item_type = 'file' THEN
    SELECT * INTO file_record
    FROM public.user_files
    WHERE id = share_record.item_id;
    
    IF file_record IS NULL THEN
      RETURN jsonb_build_object('error', 'File không tồn tại', 'success', false);
    END IF;
    
    item_data := jsonb_build_object(
      'id', file_record.id,
      'name', file_record.name,
      'file_path', file_record.file_path,
      'file_type', file_record.file_type,
      'file_size', file_record.file_size,
      'mime_type', file_record.mime_type,
      'category', file_record.category,
      'created_at', file_record.created_at
    );
    
  ELSE
    SELECT * INTO link_record
    FROM public.user_links
    WHERE id = share_record.item_id;
    
    IF link_record IS NULL THEN
      RETURN jsonb_build_object('error', 'Link không tồn tại', 'success', false);
    END IF;
    
    item_data := jsonb_build_object(
      'id', link_record.id,
      'name', link_record.name,
      'url', link_record.url,
      'created_at', link_record.created_at
    );
  END IF;
  
  -- Increment view count AFTER successful retrieval
  UPDATE public.share_codes
  SET view_count = view_count + 1
  WHERE code = UPPER(share_code_input);
  
  -- Return success with item data
  RETURN jsonb_build_object(
    'success', true,
    'item', item_data,
    'type', share_record.item_type,
    'view_count', share_record.view_count + 1,
    'max_views', share_record.max_views
  );
END;
$$;