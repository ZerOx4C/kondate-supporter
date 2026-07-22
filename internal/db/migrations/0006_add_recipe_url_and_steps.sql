CREATE TABLE recipe_steps (
    id        INTEGER PRIMARY KEY,
    recipe_id INTEGER NOT NULL REFERENCES recipes (id),
    step_no   INTEGER NOT NULL,
    text      TEXT NOT NULL
);

CREATE INDEX idx_recipe_steps_recipe_id ON recipe_steps (recipe_id);

ALTER TABLE recipes ADD COLUMN url TEXT NOT NULL DEFAULT '';
ALTER TABLE recipes DROP COLUMN description;
