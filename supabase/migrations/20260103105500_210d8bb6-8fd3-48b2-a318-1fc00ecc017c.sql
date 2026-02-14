-- Create storage bucket for user files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('user_files', 'user_files', false, 21474836480, null);

-- Create table for storing file metadata
CREATE TABLE public.user_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  mime_type TEXT,
  category TEXT NOT NULL CHECK (category IN ('media', 'file')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for storing links
CREATE TABLE public.user_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on tables
ALTER TABLE public.user_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_files
CREATE POLICY "Users can view their own files"
ON public.user_files FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own files"
ON public.user_files FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own files"
ON public.user_files FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own files"
ON public.user_files FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies for user_links
CREATE POLICY "Users can view their own links"
ON public.user_links FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own links"
ON public.user_links FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own links"
ON public.user_links FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own links"
ON public.user_links FOR DELETE
USING (auth.uid() = user_id);

-- Storage policies for user_files bucket
CREATE POLICY "Users can view their own storage files"
ON storage.objects FOR SELECT
USING (bucket_id = 'user_files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'user_files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own storage files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'user_files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own storage files"
ON storage.objects FOR DELETE
USING (bucket_id = 'user_files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_user_files_updated_at
BEFORE UPDATE ON public.user_files
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_links_updated_at
BEFORE UPDATE ON public.user_links
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();