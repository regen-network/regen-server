import { UserRequest } from '../types';

export function updateActiveAccounts(req: UserRequest, accountId?: string) {
  // optionally accepts accountId because some passport strategies, i.e. KeplrStrategy, have the express.request object available within them.
  // whereas other passport strategies, i.e. googleStrategy, do not have the express.request object available.
  // in the case where the express.request is not available within the strategy, can instead get the accountId of the user that just authenticated from the request.user.accountId that passport provides.
  if (req.session) {
    if (!('authenticatedAccountIds' in req.session)) {
      req.session.authenticatedAccountIds = [];
    }
    if (accountId) {
      req.session.activeAccountId = accountId;
      if (req.session.authenticatedAccountIds.includes(accountId)) {
      } else {
        req.session.authenticatedAccountIds.push(accountId);
      }
    } else {
      if (!req.user) {
        throw new Error('unable to update active account, req.user is falsy');
      }
      req.session.activeAccountId = req.user.accountId;
      if (req.session.authenticatedAccountIds.includes(req.user.accountId)) {
      } else {
        req.session.authenticatedAccountIds.push(req.user.accountId);
      }
    }
  }
}
