import { createServer } from "node:http";
import { createApp } from "./app.js";

const app = createApp();

const PORT = process.env.PORT || 3000;

const server = createServer(app);

server.listen(PORT, () => {
  console.log(`📚️ Bookshelf API is running on http://localhost:${PORT}`);
})

