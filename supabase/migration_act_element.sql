-- Migration: Add 'act' element type to screenplay/stage play scripts
-- IMPORTANT: ALTER TYPE ADD VALUE cannot run inside a transaction block.
-- Run this file directly in your Supabase SQL editor (not inside BEGIN/COMMIT).

ALTER TYPE public.script_element_type ADD VALUE IF NOT EXISTS 'act';
