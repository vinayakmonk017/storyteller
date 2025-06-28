/*
  # Storage Setup for Audio Recordings

  1. Storage Bucket
    - Create audio_recordings bucket if it doesn't exist
    - Configure for audio file types with 50MB limit
    - Enable public read access for playback

  2. Storage Policies
    - Drop existing policies if they exist to avoid conflicts
    - Create new policies for user file management
    - Allow public read access for audio playback
*/

-- Create storage bucket for audio recordings
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'audio_recordings',
  'audio_recordings',
  true,
  52428800, -- 50MB limit
  ARRAY['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can upload own audio files" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own audio files" ON storage.objects;
DROP POLICY IF EXISTS "Public can read audio files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own audio files" ON storage.objects;

-- Storage policies for audio recordings
CREATE POLICY "Users can upload own audio files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'audio_recordings' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read own audio files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'audio_recordings' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Public can read audio files"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'audio_recordings');

CREATE POLICY "Users can delete own audio files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'audio_recordings' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );