declare module 'hpp' {
  import { RequestHandler } from 'express';
  function hpp(options?: Record<string, unknown>): RequestHandler;
  export = hpp;
}
