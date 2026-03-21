-- Migration 018: add file_hash to documents for duplicate detection
ALTER TABLE public.documents
  ADD COLUMN file_hash text;

-- Reject same filename within the same interview
CREATE UNIQUE INDEX idx_documents_interview_filename
  ON public.documents (interview_id, filename);

-- Reject same file content (by SHA-256) within the same interview
CREATE UNIQUE INDEX idx_documents_interview_hash
  ON public.documents (interview_id, file_hash)
  WHERE file_hash IS NOT NULL;
