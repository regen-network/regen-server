export class BaseHTTPError extends Error {
  status_code: number;
  constructor(message: string, status_code: number) {
    super(message);
    this.status_code = status_code;
  }
}

export class InvalidQueryParam extends BaseHTTPError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class NotFoundError extends BaseHTTPError {
  constructor(message: string) {
    super(message, 404);
  }
}

export class InvalidLoginParameter extends BaseHTTPError {
  constructor(message: string) {
    super(message, 400);
  }
}
