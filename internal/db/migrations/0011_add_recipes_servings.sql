ALTER TABLE recipes ADD COLUMN servings INTEGER NOT NULL DEFAULT 0;
ALTER TABLE recipes RENAME COLUMN image TO image_old;
ALTER TABLE recipes ADD COLUMN image BLOB;
UPDATE recipes SET image = image_old WHERE image_old IS NOT NULL;
ALTER TABLE recipes DROP COLUMN image_old;
