CREATE INDEX tickets_visitor ON tickets (visitor, started) WHERE started IS NOT NULL;

CREATE TABLE runs (
	started INTEGER PRIMARY KEY
) STRICT;
