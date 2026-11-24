import type { NextFunction, Request, Response } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence for cookie auth. Browsers send Origin on every cross-origin request and on
 * every POST/PATCH/DELETE, so a write from a page outside FRONTEND_URL is refused. Requests
 * without Origin come from non-browser clients, which cannot ride a victim's cookies.
 */
export function originCheck(allowedOrigins: string[]) {
  const allowed = new Set(allowedOrigins);
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;
    if (SAFE_METHODS.has(req.method) || origin === undefined || allowed.has(origin)) {
      next();
      return;
    }
    res.status(403).json({
      statusCode: 403,
      message: 'Origin not allowed',
      error: 'Forbidden',
    });
  };
}
