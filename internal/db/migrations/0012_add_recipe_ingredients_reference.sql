ALTER TABLE recipe_ingredients ADD COLUMN reference_quantity REAL;
ALTER TABLE recipe_ingredients ADD COLUMN reference_format TEXT NOT NULL DEFAULT '';
