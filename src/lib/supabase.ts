import { supabase } from "@/integrations/supabase/client";

export { supabase };

// Helper function to get public URL for storage
export const getPublicUrl = (bucket: string, path: string) => {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
};

// Upload file to storage
export const uploadFile = async (
  bucket: string,
  path: string,
  file: File
): Promise<string | null> => {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true });

  if (error) {
    console.error("Upload error:", error);
    return null;
  }

  return getPublicUrl(bucket, data.path);
};

// Delete file from storage
export const deleteFile = async (bucket: string, path: string) => {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  return !error;
};
