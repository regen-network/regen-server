import { UserRequest } from '../types';

export function updateActiveAccounts(req: UserRequest, accountId?: string) {
  // optionally accepts accountId because some passport strategies, i.e. KeplrStrategy, have the express.request object available within them.
  // whereas other passport strategies, i.e. googleStrategy, do not have the express.request object available.
  // in the case where the express.request is not available within the strategy, can instead get the accountId of the user that just authenticated from the request.user.accountId that passport provides.
  if (req.session) {
    if (!('activeAccountIds' in req.session)) {
      console.log('setting activeAccountIds...');
      req.session.activeAccountIds = [];
    }
    if (accountId) {
      req.session.activeAccountId = accountId;
      if (req.session.activeAccountIds.includes(accountId)) {
      } else {
        req.session.activeAccountIds.push(accountId);
      }
    } else {
      if (!req.user) {
        throw new Error('unable to update active account, req.user is falsy');
      }
      req.session.activeAccountId = req.user.accountId;
      if (req.session.activeAccountIds.includes(req.user.accountId)) {
      } else {
        req.session.activeAccountIds.push(req.user.accountId);
      }
    }
  }
}
