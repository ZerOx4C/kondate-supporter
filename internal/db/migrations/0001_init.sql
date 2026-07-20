CREATE TABLE ingredients (
    id   INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    unit TEXT NOT NULL
);

CREATE TABLE stocks (
    id            INTEGER PRIMARY KEY,
    ingredient_id INTEGER NOT NULL UNIQUE REFERENCES ingredients (id),
    quantity      REAL NOT NULL DEFAULT 0,
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE recipes (
    id          INTEGER PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE recipe_ingredients (
    id            INTEGER PRIMARY KEY,
    recipe_id     INTEGER NOT NULL REFERENCES recipes (id),
    ingredient_id INTEGER NOT NULL REFERENCES ingredients (id),
    quantity      REAL NOT NULL
);

CREATE TABLE plans (
    id        INTEGER PRIMARY KEY,
    date      TEXT NOT NULL,
    recipe_id INTEGER NOT NULL REFERENCES recipes (id),
    servings  INTEGER NOT NULL
);

CREATE INDEX idx_recipe_ingredients_recipe_id ON recipe_ingredients (recipe_id);
CREATE INDEX idx_plans_date ON plans (date);
