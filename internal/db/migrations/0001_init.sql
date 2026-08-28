CREATE TABLE ingredients (
    id   INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    unit TEXT NOT NULL
);

CREATE TABLE seasonings (
    id   INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE stocks (
    id            INTEGER PRIMARY KEY,
    ingredient_id INTEGER NOT NULL UNIQUE REFERENCES ingredients (id),
    quantity      REAL NOT NULL DEFAULT 0,
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE recipes (
    id        INTEGER PRIMARY KEY,
    name      TEXT NOT NULL,
    servings  INTEGER NOT NULL DEFAULT 1,
    url       TEXT NOT NULL DEFAULT '',
    image_ext TEXT NOT NULL DEFAULT ''
);

CREATE TABLE recipe_ingredients (
    id                INTEGER PRIMARY KEY,
    recipe_id         INTEGER NOT NULL REFERENCES recipes (id),
    ingredient_id     INTEGER NOT NULL REFERENCES ingredients (id),
    quantity          REAL NOT NULL,
    is_fixed_quantity INTEGER NOT NULL DEFAULT 0,
    note              TEXT NOT NULL DEFAULT ''
);

CREATE INDEX idx_recipe_ingredients_recipe_id ON recipe_ingredients (recipe_id);

CREATE TABLE recipe_seasonings (
    id                INTEGER PRIMARY KEY,
    recipe_id         INTEGER NOT NULL REFERENCES recipes (id),
    seasoning_id      INTEGER NOT NULL REFERENCES seasonings (id),
    quantity          REAL NOT NULL,
    is_fixed_quantity INTEGER NOT NULL DEFAULT 0,
    note              TEXT NOT NULL DEFAULT ''
);

CREATE INDEX idx_recipe_seasonings_recipe_id ON recipe_seasonings (recipe_id);

CREATE TABLE recipe_steps (
    id        INTEGER PRIMARY KEY,
    recipe_id INTEGER NOT NULL REFERENCES recipes (id),
    step_no   INTEGER NOT NULL,
    text      TEXT NOT NULL
);

CREATE INDEX idx_recipe_steps_recipe_id ON recipe_steps (recipe_id);

CREATE TABLE plans (
    id        INTEGER PRIMARY KEY,
    date      TEXT,
    plan_type TEXT NOT NULL DEFAULT 'scheduled',
    recipe_id INTEGER REFERENCES recipes (id),
    servings  INTEGER NOT NULL DEFAULT 0,
    meal_time TEXT NOT NULL DEFAULT 'other',
    note      TEXT NOT NULL DEFAULT ''
);

CREATE INDEX idx_plans_date ON plans (date);

CREATE TABLE plan_ingredient_overrides (
    plan_id       INTEGER NOT NULL REFERENCES plans (id),
    ingredient_id INTEGER NOT NULL REFERENCES ingredients (id),
    quantity      REAL NOT NULL,
    PRIMARY KEY (plan_id, ingredient_id)
);

CREATE TABLE plan_seasoning_overrides (
    plan_id      INTEGER NOT NULL REFERENCES plans (id),
    seasoning_id INTEGER NOT NULL REFERENCES seasonings (id),
    quantity     REAL NOT NULL,
    PRIMARY KEY (plan_id, seasoning_id)
);
