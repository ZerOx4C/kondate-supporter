ALTER TABLE plans ADD COLUMN plan_type TEXT NOT NULL DEFAULT 'scheduled';
UPDATE plans SET plan_type = 'unscheduled' WHERE date IS NULL;
