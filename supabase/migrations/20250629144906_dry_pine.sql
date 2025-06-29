/*
  # Create audio_recordings storage bucket

  1. Storage Setup
    - Create `audio_recordings` bucket for storing user audio files
    - Configure bucket with appropriate policies for authenticated users
    - Allow public read access for processing by edge functions
    - Allow authenticated users to upload their own audio files

  2. Security
    - Users can only upload to their own folder (user_id prefix)
    - Public read access for edge function processing
    - Automatic cleanup policies can be added later if needed
*/

-- Create the audio_recordings bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'audio_recordings',
  'audio_recordings', 
  true,
  52428800, -- 50MB limit
  ARRAY['audio/webm', 'audio/wav', 'audio/mp3', 'audio/ogg', 'audio/m4a']
);

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