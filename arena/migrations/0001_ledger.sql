CREATE TABLE tickets (
	id TEXT PRIMARY KEY,
	visitor TEXT NOT NULL,
	ticket TEXT NOT NULL,
	issued INTEGER NOT NULL,
	started INTEGER,
	reported INTEGER,
	moves TEXT,
	judged INTEGER,
	won INTEGER,
	scores TEXT
) STRICT;

CREATE INDEX tickets_pending ON tickets (visitor, issued) WHERE started IS NULL;
CREATE INDEX tickets_open ON tickets (started) WHERE started IS NOT NULL AND judged IS NULL;

CREATE TABLE buckets (
	key TEXT PRIMARY KEY,
	tokens INTEGER NOT NULL,
	updated INTEGER NOT NULL
) STRICT;

CREATE TABLE standing (
	id INTEGER PRIMARY KEY CHECK (id = 1),
	humanity INTEGER NOT NULL,
	agent INTEGER NOT NULL
) STRICT;

INSERT INTO standing (id, humanity, agent) VALUES (1, 0, 0);

CREATE TRIGGER tickets_judged AFTER UPDATE OF judged ON tickets
WHEN OLD.judged IS NULL AND NEW.judged IS NOT NULL
BEGIN
	UPDATE standing SET humanity = humanity + NEW.won, agent = agent + 1 - NEW.won WHERE id = 1;
END;
