import { Request } from 'express';
import { IncomingMessage } from 'http';

interface User {
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
