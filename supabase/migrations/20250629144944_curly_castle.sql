-- Create the audio_recordings bucket (only if it doesn't exist)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'audio_recordings',
  'audio_recordings', 
  true,
  52428800, -- 50MB limit
  ARRAY['audio/webm', 'audio/wav', 'audio/mp3', 'audio/ogg', 'audio/m4a']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can upload own audio files" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own audio files" ON storage.objects;
DROP POLICY IF EXISTS "Service role can read all audio files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own audio files" ON storage.objects;
DROP POLICY IF EXISTS "Public can read audio files" ON storage.objects;
DROP POLICY IF EXISTS "Service role can access all audio files" ON storage.objects;

-- Allow authenticated users to upload audio files to their own folder
CREATE POLICY "Users can upload own audio files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'audio_recordings' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to read their own audio files
CREATE POLICY "Users can read own audio files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'audio_recordings' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow service role (edge functions) to read all audio files for processing
CREATE POLICY "Service role can read all audio files"
ON storage.objects
FOR SELECT
TO service_role
USING (bucket_id = 'audio_recordings');

-- Allow authenticated users to delete their own audio files
CREATE POLICY "Users can delete own audio files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'audio_recordings' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);