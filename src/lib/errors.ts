export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class RateLimitedError extends ApiError {
  constructor(message = "Too many requests. Please try again later.") {
    super(429, message);
    this.name = "RateLimitedError";
  }
}

export class NotFoundError extends ApiError {
  constructor(message = "The requested resource was not found.") {
    super(404, message);
    this.name = "NotFoundError";
  }
}

export class GoneError extends ApiError {
  constructor(message = "This DOI has been deleted.") {
    super(410, message);
    this.name = "GoneError";
  }
}

export class BadRequestError extends ApiError {
  constructor(message: string) {
    super(400, message);
    this.name = "BadRequestError";
  }
}
