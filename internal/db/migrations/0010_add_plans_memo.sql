CREATE TABLE plans_new (
    id        INTEGER PRIMARY KEY,
    date      TEXT,
    meal      TEXT,
    position  INTEGER NOT NULL,
    recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
    memo      TEXT,
    CHECK ((recipe_id IS NULL) <> (memo IS NULL))
);
INSERT INTO plans_new (id, date, meal, position, recipe_id)
    SELECT id, date, meal, position, recipe_id FROM plans;
DROP TABLE plans;
ALTER TABLE plans_new RENAME TO plans;
CREATE INDEX plans_date_meal_position ON plans(date, meal, position);
