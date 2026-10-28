CREATE TABLE recipe_ingredients (
    recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    position  INTEGER NOT NULL,
    name      TEXT NOT NULL,
    quantity  REAL,
    format    TEXT NOT NULL,
    PRIMARY KEY (recipe_id, position)
);
