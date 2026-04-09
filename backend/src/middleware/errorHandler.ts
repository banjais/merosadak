// backend/src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from "express";
import { logError, logInfo } from "../logs/logs.js";
import { isProd, SENTRY_DSN } from "../config/index.js";

// Custom error class for operational errors
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public context?: any;

  constructor(message: string, statusCode: number, context?: any) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.context = context;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

// Custom error class for API errors
export class APIError extends AppError {
  public code: string;

  constructor(message: string, statusCode: number, code: string, context?: any) {
    super(message, statusCode, context);
    this.code = code;
  }
}

/**
 * Global error handler middleware
 * Catches all errors and formats them for the client
 */
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Determine if it's our custom error
  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const message = isAppError ? err.message : "Internal server error";

  // Log the error with full details
  logError("[ErrorHandler]", {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: (req as any).user?.id,
    statusCode,
    isOperational: isAppError ? (err as AppError).isOperational : false,
  });

  // Send to Sentry if configured
  if (SENTRY_DSN && statusCode >= 500) {
    try {
      const Sentry = require("@sentry/node");
      Sentry.captureException(err, {
        tags: {
          path: req.path,
          method: req.method,
        },
        user: {
          id: (req as any).user?.id,
          email: (req as any).user?.email,
        },
      });
    } catch {
      // Sentry not initialized
    }
  }

  // Build error response
  const errorResponse: any = {
    success: false,
    message,
    ...(isAppError && (err as AppError).code && { code: (err as AppError).code }),
  };

  // Include validation errors if present
  if ((err as any).errors) {
    errorResponse.errors = (err as any).errors;
  }

  // In development, include stack trace
  if (!isProd) {
    errorResponse.stack = err.stack;
    errorResponse.details = (err as AppError).context;
  }

  res.status(statusCode).json(errorResponse);
};

/**
 * 404 Not Found handler
 * Catches undefined routes
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  logInfo("[404] Route not found", {
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
    hint: `Available routes start with /api/v1/`,
  });
};

/**
 * Async route handler wrapper
 * Eliminates need for try/catch in every controller
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Catch unhandled promise rejections globally
 */
export const initializeGlobalErrorHandlers = (): void => {
  // Unhandled promise rejections
  process.on("unhandledRejection", (reason: any, promise) => {
    logError("[Global] Unhandled Promise Rejection", {
      reason: reason?.message || reason,
      stack: reason?.stack,
    });

    // Send to Sentry
    if (SENTRY_DSN) {
      try {
        const Sentry = require("@sentry/node");
        Sentry.captureException(reason);
      } catch {
        // Sentry not available
      }
    }
  });

  // Uncaught exceptions
  process.on("uncaughtException", (error: Error) => {
    logError("[Global] Uncaught Exception", {
      message: error.message,
      stack: error.stack,
    });

    // Send to Sentry
    if (SENTRY_DSN) {
      try {
        const Sentry = require("@sentry/node");
        Sentry.captureException(error);
      } catch {
        // Sentry not available
      }
    }

    // Graceful shutdown
    process.exit(1);
  });

  // SIGTERM handling
  process.on("SIGTERM", () => {
    logInfo("[Global] SIGTERM received. Shutting down gracefully...");
    process.exit(0);
  });

  // SIGINT handling
  process.on("SIGINT", () => {
    logInfo("[Global] SIGINT received. Shutting down gracefully...");
    process.exit(0);
  });
};
