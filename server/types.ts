import { Request } from 'express';

export interface User {
  sub?: string;
  accountId?: string;
}

export interface UserRequest extends Request {
  user?: User;
}
