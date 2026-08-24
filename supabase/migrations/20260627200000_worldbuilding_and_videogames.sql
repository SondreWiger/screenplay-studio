-- Add stats and abilities to characters
ALTER TABLE characters 
ADD COLUMN IF NOT EXISTS stats JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS abilities TEXT[] DEFAULT '{}'::text[];

-- Add beta feature flag for worldbuilding
INSERT INTO feature_flags (key, name, description, tier, category)
VALUES (
    'worldbuilding',
    'Worldbuilding Hub',
    'A dedicated page for worldbuilding: environments, magic systems, character abilities, and lore.',
    'beta',
    'editor'
)
ON CONFLICT (key) DO UPDATE 
SET 
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    tier = EXCLUDED.tier,
    category = EXCLUDED.category;
