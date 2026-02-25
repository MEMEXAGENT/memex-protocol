export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details ? { details: this.details } : {}),
      },
    };
  }
}

export function notFound(resource: string, id: string): AppError {
  return new AppError(404, "NOT_FOUND", `${resource} '${id}' not found`);
}

export function insufficientBalance(required: number, available: number): AppError {
  return new AppError(402, "INSUFFICIENT_BALANCE", "Insufficient MEMEX balance", {
    required,
    available,
  });
}

export function alreadyClaimed(resource: string): AppError {
  return new AppError(409, "ALREADY_CLAIMED", `${resource} already claimed`);
}

export function forbidden(message: string): AppError {
  return new AppError(403, "FORBIDDEN", message);
}

export function badRequest(message: string): AppError {
  return new AppError(400, "BAD_REQUEST", message);
}
