CREATE TABLE IF NOT EXISTS users (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


CREATE TABLE IF NOT EXISTS books (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  published_date DATE,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  genre TEXT,
  status TEXT NOT NULL DEFAULT 'want_to_read', CHECK (status IN ('want_to_read', 'reading', 'finished')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (title, author, owner_id)
);

CREATE INDEX IF NOT EXISTS books_owner_id_idx ON books(owner_id);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  reviewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (book_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS reviews_book_id_idx ON reviews(book_id);
