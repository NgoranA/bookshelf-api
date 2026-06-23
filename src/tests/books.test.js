import { once } from "node:events";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../app.js";
import { db } from "../config/db.js";

test('Bookshelf API', async (t) => {
  const app = createApp();
  const server = app.listen(0);
  await once(server, 'listening');
  const baseUrl = `http://localhost:${server.address().port}`;
  t.after(async () => { server.close(); db.end() });

  await t.test('GET /books/1 has review stats', async () => {
    const res = await fetch(`${baseUrl}/books/1`);
    assert.equal(res.status, 200);
    const book = await res.json();
    assert.equal(book.review_count, 1);
  })
})

