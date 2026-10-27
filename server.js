// Custom entrypoint for cPanel's "Setup Node.js App" (Phusion Passenger).
// Passenger expects a plain Node http server listening on process.env.PORT —
// it does NOT run `next start` directly, so this wraps Next's request handler.
const { createServer } = require('http');
const next = require('next');

const app = next({ dev: false });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => handle(req, res)).listen(process.env.PORT || 3000, () => {
    console.log('Next.js app ready on port', process.env.PORT || 3000);
  });
});
