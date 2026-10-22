CREATE TABLE recipe_bookmarks (
    recipe_id INTEGER PRIMARY KEY REFERENCES recipes(id) ON DELETE CASCADE
);
