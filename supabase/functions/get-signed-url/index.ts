import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { file_path, share_code } = await req.json()

    if (!file_path || !share_code) {
      return new Response(
        JSON.stringify({ error: 'Missing file_path or share_code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create admin client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify share code exists (validation already done by RPC, this is just to confirm the code is real)
    const { data: shareData, error: shareError } = await supabaseAdmin
      .from('share_codes')
      .select('id, item_type')
      .eq('code', share_code.toUpperCase())
      .maybeSingle()

    if (shareError || !shareData) {
      return new Response(
        JSON.stringify({ error: 'Invalid share code' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate signed URL using admin client (bypasses RLS)
    const { data: signedData, error: signedError } = await supabaseAdmin.storage
      .from('user_files')
      .createSignedUrl(file_path, 3600) // 1 hour expiry

    if (signedError || !signedData?.signedUrl) {
      console.error('Signed URL error:', signedError)
      return new Response(
        JSON.stringify({ error: 'Failed to generate signed URL' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ signedUrl: signedData.signedUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
