CREATE TABLE plan_seasoning_overrides (
    plan_id      INTEGER NOT NULL REFERENCES plans (id),
    seasoning_id INTEGER NOT NULL REFERENCES seasonings (id),
    quantity     REAL NOT NULL,
    PRIMARY KEY (plan_id, seasoning_id)
);
