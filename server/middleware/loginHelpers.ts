import { Request } from 'express';

export function updateActiveAccounts(req: Request, accountId: string) {
  if (req.session) {
    req.session.activeAccountId = accountId;
    if (!('activeAccountIds' in req.session)) {
      console.log('setting activeAccountIds...');
      req.session.activeAccountIds = [];
    }
    if (req.session.activeAccountIds.includes(accountId)) {
    } else {
      req.session.activeAccountIds.push(accountId);
    }
  }
}
