-- ============================================================
-- Migration: Add YouTube / Audio-Drama element types to
-- the script_element_type enum.
--
-- Each ALTER TYPE ADD VALUE must be committed on its own before
-- it can be used in queries — run this file once, no transaction wrapping.
-- ============================================================

-- YouTube / Content-Creator element types
ALTER TYPE public.script_element_type ADD VALUE IF NOT EXISTS 'hook';
ALTER TYPE public.script_element_type ADD VALUE IF NOT EXISTS 'talking_point';
ALTER TYPE public.script_element_type ADD VALUE IF NOT EXISTS 'broll_note';
ALTER TYPE public.script_element_type ADD VALUE IF NOT EXISTS 'cta';
ALTER TYPE public.script_element_type ADD VALUE IF NOT EXISTS 'sponsor_read';
ALTER TYPE public.script_element_type ADD VALUE IF NOT EXISTS 'chapter_marker';

-- Audio-Drama element types (BBC Scene / US Radio / STARC Standard)
ALTER TYPE public.script_element_type ADD VALUE IF NOT EXISTS 'sfx_cue';
ALTER TYPE public.script_element_type ADD VALUE IF NOT EXISTS 'music_cue';
ALTER TYPE public.script_element_type ADD VALUE IF NOT EXISTS 'ambience_cue';
ALTER TYPE public.script_element_type ADD VALUE IF NOT EXISTS 'sound_cue';
ALTER TYPE public.script_element_type ADD VALUE IF NOT EXISTS 'act_break';
ALTER TYPE public.script_element_type ADD VALUE IF NOT EXISTS 'announcer';
