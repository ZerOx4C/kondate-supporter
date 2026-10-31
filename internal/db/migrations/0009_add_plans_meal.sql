ALTER TABLE plans ADD COLUMN meal TEXT;
UPDATE plans SET meal = 'dinner' WHERE date IS NOT NULL;
DROP INDEX plans_date_position;
CREATE INDEX plans_date_meal_position ON plans(date, meal, position);
