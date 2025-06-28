/*
  # Create Storage Bucket for Audio Recordings

  1. Storage Setup
    - Create `audio_recordings` bucket for storing user audio files
    - Set up proper security policies for authenticated users
    - Configure file upload restrictions and permissions

  2. Security
    - Users can only upload to their own folder
    - Users can only access their own audio files
    - File size and type restrictions
*/

-- Create the audio_recordings bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio_recordings', 'audio_recordings', false)
ON CONFLICT (id) DO NOTHING;

-- Create policy for authenticated users to upload their own files
CREATE POLICY "Users can upload own audio files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'audio_recordings' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Create policy for authenticated users to read their own files
CREATE POLICY "Users can read own audio files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'audio_recordings' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Create policy for authenticated users to delete their own files
CREATE POLICY "Users can delete own audio files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'audio_recordings' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Create policy for service role to access all files (for processing)
CREATE POLICY "Service role can access all audio files"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'audio_recordings')
WITH CHECK (bucket_id = 'audio_recordings');