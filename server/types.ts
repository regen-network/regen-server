import { Request } from 'express';

export interface User {
  sub?: string;
  accountId?: string;
  state?: { route?: string };
}

export interface UserRequest extends Request {
  user?: User;
}
