-- BR-31: a Tenant-verified former owner retains its credentials without an email claim.
-- Existing values, the unique email constraint, and every user/token row are preserved.
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
