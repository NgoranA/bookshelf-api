INSERT INTO users (email, password) VALUES
('demo@bookshelf.test', '2e6bcd877adb55488736e9efb2dc93c8:7f9a820b27eab840a25f9f858811bcce2e970c0d1a1fbb448497f7ba71ad9860deeac5d183ac4b0154ae75b6fdaa4c30c7cbc175bf1b13caf5a78a64af20a9d2');

INSERT INTO books (title, author, owner_id, genre, status) VALUES
('The Great Gatsby', 'F. Scott Fitzgerald', 1, 'Classic', 'want_to_read'),
('To Kill a Mockingbird', 'Harper Lee', 1, 'Classic', 'reading'),
('1984', 'George Orwell', 1, 'Dystopian', 'finished'),
('Pride and Prejudice', 'Jane Austen', 1, 'Romance', 'want_to_read'),
('The Catcher in the Rye', 'J.D. Salinger', 1, 'Classic', 'reading'),
('The Hobbit', 'J.R.R. Tolkien', 1, 'Fantasy', 'finished');

INSERT INTO reviews (book_id, reviewer_id, rating, comment) VALUES
(1, 1, 5, 'A timeless classic that captures the essence of the Jazz Age.'),
(2, 1, 4, 'A powerful exploration of racial injustice and moral growth.'),
(3, 1, 5, 'A chilling dystopian novel that remains relevant today.'),
(4, 1, 4, 'A delightful romance with sharp social commentary.'),
(5, 1, 3, 'An iconic coming-of-age story with a complex protagonist.'),
(6, 1, 5, 'A magical adventure that transports readers to another world.');
