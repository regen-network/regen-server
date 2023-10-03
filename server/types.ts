import { Request } from 'express';

export interface User {
  id?: number;
  sub?: string;
  address?: string;
  partyId?: string;
}

export interface UserRequest extends Request {
  user?: User;
}
