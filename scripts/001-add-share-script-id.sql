-- Add script_id to project_share_links to allow sharing specific script versions
ALTER TABLE project_share_links 
ADD COLUMN IF NOT EXISTS script_id UUID REFERENCES scripts(id) ON DELETE SET NULL;
