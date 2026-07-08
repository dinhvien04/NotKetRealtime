-- Fix emoji column to be nullable to support Iconify icon reactions
ALTER TABLE message_reactions ALTER COLUMN emoji DROP NOT NULL;
