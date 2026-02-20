-- Create table for user text documents
CREATE TABLE public.user_texts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled',
  content TEXT NOT NULL DEFAULT '',
  font_size INTEGER NOT NULL DEFAULT 16,
  font_family TEXT NOT NULL DEFAULT 'Arial',
  text_align TEXT NOT NULL DEFAULT 'left',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.user_texts ENABLE ROW LEVEL SECURITY;

-- Users can only access their own texts
CREATE POLICY "Users can view their own texts"
ON public.user_texts
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own texts"
ON public.user_texts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own texts"
ON public.user_texts
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own texts"
ON public.user_texts
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_texts_updated_at
BEFORE UPDATE ON public.user_texts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();