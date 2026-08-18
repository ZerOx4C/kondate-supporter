CREATE TABLE seasonings (
    id   INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE recipe_seasonings (
    id           INTEGER PRIMARY KEY,
    recipe_id    INTEGER NOT NULL REFERENCES recipes (id),
    seasoning_id INTEGER NOT NULL REFERENCES seasonings (id),
    quantity     REAL NOT NULL
);

CREATE INDEX idx_recipe_seasonings_recipe_id ON recipe_seasonings (recipe_id);
