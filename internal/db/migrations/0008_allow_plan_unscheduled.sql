-- plan_ingredient_overrides.plan_id が plans(id) を参照しているため、
-- 外部キー制約が有効な状態では plans を直接DROPできない。
-- 一時テーブルに退避してから plans を再構築し、最後に復元する。
CREATE TABLE plan_ingredient_overrides_tmp (
    plan_id       INTEGER NOT NULL,
    ingredient_id INTEGER NOT NULL,
    quantity      REAL NOT NULL,
    PRIMARY KEY (plan_id, ingredient_id)
);

INSERT INTO plan_ingredient_overrides_tmp (plan_id, ingredient_id, quantity)
SELECT plan_id, ingredient_id, quantity FROM plan_ingredient_overrides;

DROP TABLE plan_ingredient_overrides;

CREATE TABLE plans_new (
    id        INTEGER PRIMARY KEY,
    date      TEXT,
    recipe_id INTEGER REFERENCES recipes (id),
    servings  INTEGER NOT NULL DEFAULT 0,
    meal_time TEXT NOT NULL DEFAULT 'other',
    note      TEXT NOT NULL DEFAULT ''
);

INSERT INTO plans_new (id, date, recipe_id, servings, meal_time, note)
SELECT id, date, recipe_id, servings, meal_time, note FROM plans;

DROP TABLE plans;
ALTER TABLE plans_new RENAME TO plans;

CREATE INDEX idx_plans_date ON plans (date);

CREATE TABLE plan_ingredient_overrides (
    plan_id       INTEGER NOT NULL REFERENCES plans (id),
    ingredient_id INTEGER NOT NULL REFERENCES ingredients (id),
    quantity      REAL NOT NULL,
    PRIMARY KEY (plan_id, ingredient_id)
);

INSERT INTO plan_ingredient_overrides (plan_id, ingredient_id, quantity)
SELECT plan_id, ingredient_id, quantity FROM plan_ingredient_overrides_tmp;

DROP TABLE plan_ingredient_overrides_tmp;
