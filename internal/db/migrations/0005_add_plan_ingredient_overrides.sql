CREATE TABLE plan_ingredient_overrides (
    plan_id       INTEGER NOT NULL REFERENCES plans (id),
    ingredient_id INTEGER NOT NULL REFERENCES ingredients (id),
    quantity      REAL NOT NULL,
    PRIMARY KEY (plan_id, ingredient_id)
);
