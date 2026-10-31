ALTER TABLE plan_entries RENAME TO plans;
DROP INDEX plan_entries_date_position;
CREATE INDEX plans_date_position ON plans(date, position);
