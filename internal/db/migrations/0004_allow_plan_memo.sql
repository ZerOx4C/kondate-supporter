CREATE TABLE plans_new (
    id        INTEGER PRIMARY KEY,
    date      TEXT NOT NULL,
    recipe_id INTEGER REFERENCES recipes (id),
    servings  INTEGER NOT NULL DEFAULT 0,
    meal_time TEXT NOT NULL DEFAULT 'other',
    note      TEXT NOT NULL DEFAULT ''
);

INSERT INTO plans_new (id, date, recipe_id, servings, meal_time, note)
SELECT id, date, recipe_id, servings, meal_time, '' FROM plans;

DROP TABLE plans;
ALTER TABLE plans_new RENAME TO plans;

CREATE INDEX idx_plans_date ON plans (date);
