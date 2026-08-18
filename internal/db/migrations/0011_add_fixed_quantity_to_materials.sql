ALTER TABLE recipe_ingredients ADD COLUMN is_fixed_quantity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE recipe_seasonings ADD COLUMN is_fixed_quantity INTEGER NOT NULL DEFAULT 0;
