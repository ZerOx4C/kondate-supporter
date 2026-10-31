CREATE TABLE plan_entries (
    id        INTEGER PRIMARY KEY,
    date      TEXT,
    position  INTEGER NOT NULL,
    recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE
);
CREATE INDEX plan_entries_date_position ON plan_entries(date, position);
