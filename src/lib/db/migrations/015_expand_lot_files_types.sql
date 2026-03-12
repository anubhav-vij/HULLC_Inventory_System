-- Expand the lot_files.type CHECK constraint to match ALLOWED_FILE_TYPES in types.ts.
-- Previous constraint only allowed: pdf, jpeg, tiff.
-- Now also allows: png, docx (openxmlformats), xlsx (openxmlformats).

ALTER TABLE lot_files DROP CONSTRAINT IF EXISTS lot_files_type_check;

ALTER TABLE lot_files ADD CONSTRAINT lot_files_type_check
  CHECK (type IN (
    'application/pdf',
    'image/jpeg',
    'image/tiff',
    'image/png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ));
