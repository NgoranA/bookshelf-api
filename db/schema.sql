-- schema.sql — the database structure for the Bookshelf API.
--
-- "CREATE TABLE IF NOT EXISTS" makes this safe to run more than once, so we can
-- use it as a simple migration (see scripts/migrate.js).
--
-- The data model has THREE tables:
--   users   — people who can log in (each owns a private shelf)
--   books   — each book BELONGS TO a user   (books.owner_id → users.id)
--   reviews — each review BELONGS TO a book  (reviews.book_id → books.id)
--
-- Notice how much the DATABASE enforces, independent of the Node.js code:
-- required columns (NOT NULL), allowed values (CHECK), valid ratings, uniqueness
-- (UNIQUE), and the relationships (REFERENCES ... ON DELETE CASCADE).

-- Users come FIRST: books reference users, so the users table must exist before
-- the books table that points at it.
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         TEXT        NOT NULL UNIQUE,    -- no two accounts share an email
  password_hash TEXT        NOT NULL,           -- a scrypt hash, NEVER the raw password
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS books (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- Every book belongs to exactly one user. ON DELETE CASCADE means deleting a
  -- user takes their whole shelf with them.
  owner_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  author      TEXT        NOT NULL,
  genre       TEXT,
  status      TEXT        NOT NULL DEFAULT 'want_to_read'
                          CHECK (status IN ('want_to_read', 'reading', 'finished')),
  rating      INTEGER     CHECK (rating BETWEEN 1 AND 5),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Uniqueness is PER OWNER: two readers may each keep their own "Sapiens", but
  -- one reader can't add the same book twice. A duplicate raises error 23505,
  -- which our code maps to "409 Conflict".
  UNIQUE (owner_id, title, author)
);

-- Find "all of a user's books" quickly.
CREATE INDEX IF NOT EXISTS books_owner_id_idx ON books (owner_id);

CREATE TABLE IF NOT EXISTS reviews (
  id          INTEGER     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- ON DELETE CASCADE: deleting a book automatically deletes its reviews,
  -- so we never end up with "orphan" reviews pointing at nothing.
  book_id     INTEGER     NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  reviewer    TEXT        NOT NULL,
  rating      INTEGER     NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- An index on the foreign key makes "find all reviews for this book" fast.
CREATE INDEX IF NOT EXISTS reviews_book_id_idx ON reviews (book_id);
