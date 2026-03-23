import { Request, Response, NextFunction } from 'express';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const { method, url } = req;

  // Skip health checks and static files
  if (url === '/health' || url === '/api/auth/health' || url.startsWith('/assets/')) {
    return next();
  }

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const color = status >= 500 ? '\x1b[31m' : status >= 400 ? '\x1b[33m' : '\x1b[32m';
    const reset = '\x1b[0m';

    // Only log API requests
    if (url.startsWith('/api/')) {
      console.log(`${color}${method} ${url} ${status}${reset} ${duration}ms`);
    }

    // Log slow requests (>2s)
    if (duration > 2000) {
      console.warn(`[SLOW] ${method} ${url} took ${duration}ms`);
    }
  });

  next();
}
