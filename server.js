const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';  // Cloud Runは0.0.0.0でリッスンする必要がある
const port = parseInt(process.env.PORT || '8080', 10);

console.log(`[Server] Initializing...`);
console.log(`[Server] NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`[Server] HOSTNAME: ${hostname}`);
console.log(`[Server] PORT: ${port}`);

const app = next({ 
  dev, 
  hostname, 
  port,
  dir: __dirname  // 明示的にディレクトリを指定
});

const handle = app.getRequestHandler();

app.prepare()
  .then(() => {
    const server = createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error('[Server] Error handling request:', req.url, err);
        res.statusCode = 500;
        res.end('internal server error');
      }
    });

    server.listen(port, hostname, () => {
      console.log(`[Server] Ready and listening on http://${hostname}:${port}`);
      console.log(`[Server] Server is accepting connections`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('[Server] SIGTERM signal received: closing HTTP server');
      server.close(() => {
        console.log('[Server] HTTP server closed');
        process.exit(0);
      });
    });

    server.on('error', (err) => {
      console.error('[Server] Fatal error:', err);
      process.exit(1);
    });
  })
  .catch((err) => {
    console.error('[Server] Failed to initialize:', err);
    process.exit(1);
  });