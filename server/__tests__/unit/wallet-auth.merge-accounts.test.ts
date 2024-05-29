import { createAccountWithAuthUser, withRootDb } from '../db/helpers';
import { PoolClient } from 'pg';
import {
  getTableColumnsWithForeignKey,
  mergeAccounts,
} from '../../routes/wallet-auth';
import {
  createNewUser,
  createWeb2Account,
  genSignature,
  setupTestAccountsWithData,
} from '../utils';
import { InvalidLoginParameter, UnauthorizedError } from '../../errors';
import { genArbitraryConnectWalletData } from '../../middleware/keplrStrategy';

const email = 'john@doe.com';
const nameWeb2 = 'web2';
const nameWeb3 = 'web3';

describe('wallet-auth merge accounts', () => {
  it('should merge the web3 account into the current account', async () => {
    await withRootDb(async (client: PoolClient) => {
      const {
        accountId,
        walletAccountId,
        userAddr,
        nonce,
        signature,
        web3AccountData,
      } = await setupTestAccountsWithData({
        client,
        email,
        nameWeb2,
        nameWeb3,
      });

      await mergeAccounts({
        signature,
        accountId,
        client,
        keepCurrentAccount: true,
      });

      const accountQuery = await client.query(
        'SELECT * FROM account WHERE id = $1',
        [accountId],
      );

      // account address and nonce have been updated
      expect(accountQuery.rowCount).toBe(1);
      expect(accountQuery.rows[0].addr).toEqual(userAddr);
      expect(accountQuery.rows[0].nonce).not.toEqual(nonce);

      await ensureAccountDataMigrated({
        client,
        fromAccountData: web3AccountData,
        toAccountName: nameWeb2,
        toAccountId: accountId,
        fromAccountId: walletAccountId,
      });
    });
  });
  it('should merge the current account into the web3 account', async () => {
    await withRootDb(async (client: PoolClient) => {
      const {
        accountId,
        walletAccountId,
        userAddr,
        signature,
        web2AccountData,
      } = await setupTestAccountsWithData({
        client,
        email,
        nameWeb2,
        nameWeb3,
      });

      await mergeAccounts({
        signature,
        accountId,
        client,
        keepCurrentAccount: false,
      });

      const accountQuery = await client.query(
        'SELECT * FROM account WHERE id = $1',
        [walletAccountId],
      );

      // kept account address
      expect(accountQuery.rowCount).toBe(1);
      expect(accountQuery.rows[0].addr).toEqual(userAddr);

      await ensureAccountDataMigrated({
        client,
        fromAccountData: web2AccountData,
        toAccountName: nameWeb3,
        toAccountId: walletAccountId,
        fromAccountId: accountId,
      });
    });
  });
  it('should throw an error if signature is not verified', async () => {
    await withRootDb(async (client: PoolClient) => {
      // generate signature with invalid nonce '123'
      const { accountId, signature } = await setupTestAccountsWithData({
        client,
        email,
        nonceOverride: '123',
        nameWeb2,
        nameWeb3,
      });

      await expect(
        mergeAccounts({
          client,
          signature,
          accountId,
          keepCurrentAccount: true,
        }),
      ).rejects.toThrow(new UnauthorizedError('Invalid signature'));
    });
  });
  it('should throw an error if signature is not provided', async () => {
    await withRootDb(async (client: PoolClient) => {
      const { accountId } = await setupTestAccountsWithData({
        client,
        email,
        nameWeb2,
        nameWeb3,
      });
      await expect(
        mergeAccounts({ client, accountId, keepCurrentAccount: true }),
      ).rejects.toThrow(
        new InvalidLoginParameter('Invalid signature parameter'),
      );
    });
  });
  it('should throw an error if the wallet address is not already used by another account', async () => {
    await withRootDb(async (client: PoolClient) => {
      // inserting some web2 account but no web3 account
      const accountId = await createWeb2Account({ client, email });
      const { userPrivKey, userPubKey, userAddr } = await createNewUser();
      const query = await client.query(
        'select nonce from account where id = $1',
        [accountId],
      );
      const [{ nonce }] = query.rows;

      // generate signature
      const signature = genSignature(
        userPrivKey,
        userPubKey,
        userAddr,
        nonce,
        genArbitraryConnectWalletData(nonce),
      );

      await expect(
        mergeAccounts({
          client,
          signature,
          accountId,
          keepCurrentAccount: true,
        }),
      ).rejects.toThrow(
        new UnauthorizedError('No account with the given wallet address'),
      );
    });
  });
  it('should throw an error if the account does not exist', async () => {
    await withRootDb(async (client: PoolClient) => {
      // inserting some account and delete it
      const accountId = await createWeb2Account({ client, email });
      const query = await client.query(
        'select nonce from account where id = $1',
        [accountId],
      );
      const [{ nonce }] = query.rows;
      await client.query('DELETE FROM private.account where id = $1', [
        accountId,
      ]);
      await client.query('DELETE FROM account where id = $1', [accountId]);

      // inserting some web3 account
      const { userPrivKey, userPubKey, userAddr } = await createNewUser();
      await createAccountWithAuthUser(client, userAddr);

      // generate signature
      const signature = genSignature(
        userPrivKey,
        userPubKey,
        userAddr,
        nonce,
        genArbitraryConnectWalletData(nonce),
      );

      await expect(
        mergeAccounts({
          client,
          signature,
          accountId,
          keepCurrentAccount: true,
        }),
      ).rejects.toThrow(
        new UnauthorizedError('Account not found for the given id'),
      );
    });
  });
  it('should throw an error if the web3 account also uses web2 login (email and/or google)', async () => {
    await withRootDb(async (client: PoolClient) => {
      const { accountId, signature, walletAccountId } =
        await setupTestAccountsWithData({
          client,
          email,
          nameWeb2,
          nameWeb3,
        });

      // set some email and google for the web3 account
      await client.query(
        'update private.account set email = $1, google_email = $2, google = $3 where id = $4',
        [
          'jane.doe@gmail.com',
          'jane.doe@gmail.com',
          'google123',
          walletAccountId,
        ],
      );

      await expect(
        mergeAccounts({
          client,
          signature,
          accountId,
          keepCurrentAccount: true,
        }),
      ).rejects.toThrow(
        new UnauthorizedError(
          'You cannot connect your account to this wallet address. This wallet address is already associated with another email address.',
        ),
      );
    });
  });
});

async function ensureAccountDataMigrated({
  client,
  fromAccountData,
  toAccountName,
  toAccountId,
  fromAccountId,
}: {
  client: PoolClient;
  fromAccountData: Awaited<
    ReturnType<typeof setupTestAccountsWithData>
  >['web2AccountData'];
  toAccountName: string;
  toAccountId: string;
  fromAccountId: string;
}) {
  // const fkQueryRows = await getTableColumnsWithForeignKey({
  //   client,
  //   tableName: 'account',
  //   columnName: 'id',
  // });
  // for (const row of fkQueryRows) {
  //   const adminProjectQuery = await client.query(
  //     `SELECT  FROM ${row.table_schema}.${row.table_name} WHERE id = $1`,
  //     [fromAccountData.adminProjectId],
  //   );
  // }
  // fromAccountData transfered to toAccountId
  const adminProjectQuery = await client.query(
    'SELECT admin_account_id FROM project WHERE id = $1',
    [fromAccountData.adminProjectId],
  );
  const [{ admin_account_id }] = adminProjectQuery.rows;
  expect(admin_account_id).toEqual(toAccountId);

  const developerProjectQuery = await client.query(
    'SELECT developer_id FROM project WHERE id = $1',
    [fromAccountData.developerProjectId],
  );
  const [{ developer_id }] = developerProjectQuery.rows;
  expect(developer_id).toEqual(toAccountId);

  const projectVerifierQuery = await client.query(
    'SELECT verifier_id FROM project WHERE id = $1',
    [fromAccountData.verifierProjectId],
  );
  const [{ verifier_id }] = projectVerifierQuery.rows;
  expect(verifier_id).toEqual(toAccountId);

  const creatorPostQuery = await client.query(
    'SELECT creator_account_id FROM post WHERE iri = $1',
    [fromAccountData.creatorPostIri],
  );
  const [{ creator_account_id }] = creatorPostQuery.rows;
  expect(creator_account_id).toEqual(toAccountId);

  // fromAccount has been deleted
  const walletAccountQuery = await client.query(
    'SELECT * FROM account WHERE id = $1',
    [fromAccountId],
  );
  expect(walletAccountQuery.rows.length).toEqual(0);
  const walletPrivateAccountQuery = await client.query(
    'SELECT * FROM private.account WHERE id = $1',
    [fromAccountId],
  );
  expect(walletPrivateAccountQuery.rows.length).toEqual(0);

  // toAccount profile data remains
  const accountQuery = await client.query(
    'SELECT name FROM account WHERE id = $1',
    [toAccountId],
  );
  const [{ name }] = accountQuery.rows;
  expect(name).toEqual(toAccountName);
}
