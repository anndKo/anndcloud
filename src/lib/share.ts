import { supabase } from '@/integrations/supabase/client';

// Generate a random 8-character alphanumeric code
export function generateShareCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing chars like O, 0, 1, I
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function createShareCode(
  userId: string,
  itemId: string,
  itemType: 'file' | 'link',
  maxViews: number | null = null,
  expiresInMinutes: number | null = null, // Custom expiry in minutes, or null for no expiry
  isPrivate: boolean = false, // If true, revoke sharing (delete share code)
  allowDownload: boolean = true // If false, only allow preview, not download
): Promise<{ code: string | null; error: Error | null }> {
  try {
    // Private mode: revoke any existing share code for this item (disable sharing)
    if (isPrivate) {
      const { error: revokeError } = await supabase
        .from('share_codes')
        .delete()
        .eq('item_id', itemId)
        .eq('item_type', itemType);

      if (revokeError) throw revokeError;
      return { code: null, error: null };
    }

    // Delete existing share code for this item if any
    await supabase
      .from('share_codes')
      .delete()
      .eq('item_id', itemId)
      .eq('item_type', itemType);

    // Generate new unique code
    const code = generateShareCode();
    
    // Calculate expiration time based on minutes
    let expiresAt: string | null = null;
    if (expiresInMinutes && expiresInMinutes > 0) {
      expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString();
    }
    
    const { error } = await supabase
      .from('share_codes')
      .insert({
        code,
        user_id: userId,
        item_id: itemId,
        item_type: itemType,
        max_views: maxViews,
        view_count: 0,
        expires_at: expiresAt,
        allow_download: allowDownload,
      });

    if (error) throw error;

    return { code, error: null };
  } catch (error) {
    return { code: null, error: error as Error };
  }
}

// Get signed URL for shared files using Edge Function (bypasses RLS)
export async function getSharedFileSignedUrl(filePath: string, shareCode: string): Promise<{
  url: string | null;
  error: Error | null;
}> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    
    const response = await fetch(`${supabaseUrl}/functions/v1/get-signed-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ file_path: filePath, share_code: shareCode }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { url: null, error: new Error(data.error || 'Failed to get signed URL') };
    }

    return { url: data.signedUrl, error: null };
  } catch (error) {
    return { url: null, error: error as Error };
  }
}

// Secure function to get shared item using RPC
// This atomically checks validity and increments view_count AFTER retrieving the item
export async function getSharedItemSecure(code: string): Promise<{
  item: any;
  type: 'file' | 'link' | null;
  viewCount?: number;
  maxViews?: number | null;
  allowDownload?: boolean;
  signedUrl?: string;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase.rpc('get_shared_item_secure', {
      share_code_input: code.toUpperCase()
    });

    if (error) throw error;

    // Parse the response
    const result = data as {
      success: boolean;
      error?: string;
      item?: any;
      type?: 'file' | 'link';
      view_count?: number;
      max_views?: number | null;
      allow_download?: boolean;
    };

    if (!result.success) {
      return { 
        item: null, 
        type: null, 
        error: new Error(result.error || 'Không thể lấy nội dung chia sẻ') 
      };
    }

    // For files, get signed URL via Edge Function
    let signedUrl: string | undefined;
    if (result.type === 'file' && result.item?.file_path) {
      const { url, error: urlError } = await getSharedFileSignedUrl(result.item.file_path, code);
      if (!urlError && url) {
        signedUrl = url;
      }
    }

    return { 
      item: result.item, 
      type: result.type || null,
      viewCount: result.view_count,
      maxViews: result.max_views,
      allowDownload: result.allow_download ?? true,
      signedUrl,
      error: null 
    };
  } catch (error) {
    return { item: null, type: null, error: error as Error };
  }
}

// Legacy function - kept for backward compatibility but use getSharedItemSecure instead
export async function getSharedItem(code: string): Promise<{
  item: any;
  type: 'file' | 'link' | null;
  error: Error | null;
}> {
  const result = await getSharedItemSecure(code);
  return {
    item: result.item,
    type: result.type,
    error: result.error
  };
}

export async function getShareCodeForItem(
  itemId: string,
  itemType: 'file' | 'link'
): Promise<string | null> {
  const { data } = await supabase
    .from('share_codes')
    .select('code')
    .eq('item_id', itemId)
    .eq('item_type', itemType)
    .maybeSingle();

  return data?.code || null;
}
