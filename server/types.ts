import { Request } from 'express';

export interface User {
  sub?: string;
  accountId?: string;
  state?: { createProject?: string };
}

export interface UserRequest extends Request {
  user?: User;
}
