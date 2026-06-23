-- seed.sql — sample data so the API has something to return immediately.
--
-- There is one demo account that OWNS the sample shelf:
--   email:    demo@bookshelf.test
--   password: password123
-- (The password_hash below was produced by lib/passwords.js for "password123".
--  Log in via POST /auth/login to get a token, then browse the seeded books.)
--
-- After a reset, the demo user gets id 1 and the books get ids 1..6 in order.

INSERT INTO users (email, password_hash) VALUES
  ('demo@bookshelf.test',
   '2e6bcd877adb55488736e9efb2dc93c8:7f9a820b27eab840a25f9f858811bcce2e970c0d1a1fbb448497f7ba71ad9860deeac5d183ac4b0154ae75b6fdaa4c30c7cbc175bf1b13caf5a78a64af20a9d2');

-- All the sample books belong to the demo user. We look its id up by email so we
-- don't depend on it being exactly 1.
INSERT INTO books (owner_id, title, author, genre, status, rating) VALUES
  ((SELECT id FROM users WHERE email = 'demo@bookshelf.test'), 'The Pragmatic Programmer', 'Andrew Hunt',              'Software',  'finished',     5),
  ((SELECT id FROM users WHERE email = 'demo@bookshelf.test'), 'Clean Code',               'Robert C. Martin',         'Software',  'reading',      NULL),
  ((SELECT id FROM users WHERE email = 'demo@bookshelf.test'), 'Things Fall Apart',        'Chinua Achebe',            'Fiction',   'finished',     4),
  ((SELECT id FROM users WHERE email = 'demo@bookshelf.test'), 'Half of a Yellow Sun',     'Chimamanda Ngozi Adichie', 'Fiction',   'want_to_read', NULL),
  ((SELECT id FROM users WHERE email = 'demo@bookshelf.test'), 'Atomic Habits',            'James Clear',              'Self-help', 'reading',      NULL),
  ((SELECT id FROM users WHERE email = 'demo@bookshelf.test'), 'Sapiens',                  'Yuval Noah Harari',        'History',   'finished',     5);

INSERT INTO reviews (book_id, reviewer, rating, body) VALUES
  (1, 'Ada',   5, 'A must-read for every developer.'),
  (1, 'Kwame', 4, 'Timeless advice, still relevant.'),
  (3, 'Ngozi', 5, 'A powerful, unforgettable classic.');
