import { describe, it, expect } from "vitest";
import {
  ApiError,
  RateLimitedError,
  NotFoundError,
  GoneError,
  BadRequestError,
} from "./errors";

describe("ApiError", () => {
  it("stores status and message", () => {
    const err = new ApiError(418, "I'm a teapot");
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(418);
    expect(err.message).toBe("I'm a teapot");
    expect(err.name).toBe("ApiError");
  });
});

describe("RateLimitedError", () => {
  it("has status 429", () => {
    const err = new RateLimitedError();
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(429);
    expect(err.message).toMatch(/too many requests/i);
    expect(err.name).toBe("RateLimitedError");
  });

  it("accepts custom message", () => {
    const err = new RateLimitedError("custom");
    expect(err.message).toBe("custom");
  });
});

describe("NotFoundError", () => {
  it("has status 404", () => {
    const err = new NotFoundError();
    expect(err.status).toBe(404);
    expect(err.message).toMatch(/not found/i);
    expect(err.name).toBe("NotFoundError");
  });
});

describe("GoneError", () => {
  it("has status 410", () => {
    const err = new GoneError();
    expect(err.status).toBe(410);
    expect(err.message).toMatch(/deleted/i);
    expect(err.name).toBe("GoneError");
  });
});

describe("BadRequestError", () => {
  it("has status 400", () => {
    const err = new BadRequestError("invalid DOI");
    expect(err.status).toBe(400);
    expect(err.message).toBe("invalid DOI");
    expect(err.name).toBe("BadRequestError");
  });
});
