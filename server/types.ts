import { Request } from 'express';
import { IncomingMessage } from 'http';

export interface User {
  id?: number;
  sub?: string;
  address?: string;
}

export interface UserRequest extends Request {
  user?: User;
}

export interface UserIncomingMessage extends IncomingMessage {
  user?: User;
}
