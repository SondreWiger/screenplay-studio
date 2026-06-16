-- ─────────────────────────────────────────────────────────────────────────────
-- Comic / Graphic Novel Support — Add element types to script_element_type enum
-- ─────────────────────────────────────────────────────────────────────────────

-- Run each ALTER TYPE outside a transaction (Supabase SQL Editor runs them individually)
ALTER TYPE public.script_element_type ADD VALUE IF NOT EXISTS 'comic_page';
ALTER TYPE public.script_element_type ADD VALUE IF NOT EXISTS 'comic_panel';
ALTER TYPE public.script_element_type ADD VALUE IF NOT EXISTS 'comic_panel_description';
ALTER TYPE public.script_element_type ADD VALUE IF NOT EXISTS 'comic_dialogue';
ALTER TYPE public.script_element_type ADD VALUE IF NOT EXISTS 'comic_sfx';
ALTER TYPE public.script_element_type ADD VALUE IF NOT EXISTS 'comic_caption';
