import { PoolClient } from 'pg';

import { withAdminUserDb, becomeRoot, becomeUser, createProject, User, Party, createUserOrganisation } from '../helpers';
import { issueCredits, setupPools, Distribution, Metadata } from './issue_credits.test';

async function transferCredits(
  client: PoolClient,
  vintageId: string | null,
  buyerWalletId: string | null,
  addressId: string | null,
  units: number | null,
  creditPrice: number | null,
  txState: string | null,
  autoRetire: boolean | null,
  partyId: string | null,
  userId: string | null,
) {
  const {
    rows: [row],
  } = await client.query(
    `
      select * from public.transfer_credits(
        $1, $2, $3, $4, $5, $6, uuid_nil(), '', 'offline'::purchase_type, 'USD', '', $7, '', '', false, $8, $9
      )
    `,
    [vintageId, buyerWalletId, addressId, units, creditPrice, txState, autoRetire, partyId, userId],
  );
  return row;
}

it('transfers credits', () => 
  withAdminUserDb(async (client, user, party) => {
    const { vintageId, buyerWalletId, addressId, project } = await setup(
      client, 1000, user, party, null, null,
    );

    const result = await transferCredits(client, vintageId,
      buyerWalletId, addressId, 100, 1, 'succeeded', false, party.id, user.id,
    );

    expect(result).not.toBeNull();
    expect(result.transfer_credits).not.toBeNull();
    expect(result.transfer_credits.purchaseId).not.toBeNull();

    // New purchase created
    const { rows: [purchase] } = await client.query(
      'select * from purchase where id=$1',
      [result.transfer_credits.purchaseId]
    );
    expect(purchase).not.toBeNull();
    expect(purchase.type).toEqual('offline');
    expect(purchase.buyer_wallet_id).toEqual(buyerWalletId);
    expect(purchase.address_id).toEqual(addressId);
    expect(purchase.credit_vintage_id).toEqual(vintageId);
    expect(purchase.party_id).toEqual(party.id);
    expect(purchase.user_id).toEqual(user.id);

    // Account balances updated
    const { rows: balances } = await client.query(
      'select * from account_balance where credit_vintage_id=$1 ORDER BY liquid_balance DESC',
      [vintageId]
    );

    expect(balances).toHaveLength(3);
    const { rows: devParties } = await client.query(
      'select wallet_id from party where id=$1',
      [project.developer_id]
    );
    expect(devParties).toHaveLength(1);
    expect(devParties[0]).not.toBeNull();
    expect(devParties[0].wallet_id).not.toBeNull();
    expect(balances[0].wallet_id).toEqual(devParties[0].wallet_id);
    expect(parseFloat(balances[0].liquid_balance)).toEqual(540);
    expect(parseFloat(balances[0].burnt_balance)).toEqual(0);

    const { rows: stewardParties } = await client.query(
      'select wallet_id from party where id=$1',
      [project.steward_id]
    );
    expect(stewardParties).toHaveLength(1);
    expect(stewardParties[0]).not.toBeNull();
    expect(stewardParties[0].wallet_id).not.toBeNull();
    expect(balances[1].wallet_id).toEqual(stewardParties[0].wallet_id);
    expect(parseFloat(balances[1].liquid_balance)).toEqual(360);
    expect(parseFloat(balances[1].burnt_balance)).toEqual(0);

    expect(balances[2].wallet_id).toEqual(buyerWalletId);
    expect(parseFloat(balances[2].liquid_balance)).toEqual(100);
    expect(parseFloat(balances[2].burnt_balance)).toEqual(0);

    // Transactions created
    const { rows: txs } = await client.query(
      'select * from transaction where purchase_id=$1 ORDER BY units DESC',
      [purchase.id]
    );

    expect(txs).toHaveLength(2);
    expect(txs[0].from_wallet_id).toEqual(devParties[0].wallet_id);
    expect(txs[0].to_wallet_id).toEqual(buyerWalletId);
    expect(parseFloat(txs[0].units)).toEqual(60);
    expect(txs[0].credit_vintage_id).toEqual(vintageId);
    expect(txs[0].broker_id).toEqual(party.id);
    expect(txs[1].from_wallet_id).toEqual(stewardParties[0].wallet_id);
    expect(txs[1].to_wallet_id).toEqual(buyerWalletId);
    expect(parseFloat(txs[1].units)).toEqual(40);
    expect(txs[1].credit_vintage_id).toEqual(vintageId);
    expect(txs[1].broker_id).toEqual(party.id);
  })
);

it('transfers 3rd party credits with reseller and initial issuer', () => 
  withAdminUserDb(async (client, user, party) => {
    await becomeRoot(client);
    const thirdPartyOrg = await createUserOrganisation(client, 'third-party@gmail.com', '3rd party person', '3rd party image', '3rd party org', '', null, {});
    expect(thirdPartyOrg).not.toBeNull();

    await becomeUser(client, user.auth0_sub);
    const { vintageId, buyerWalletId, addressId, project } = await setup(
      client, 1000, user, party, thirdPartyOrg.party_id, party.wallet_id,
    );

    const result = await transferCredits(client, vintageId,
      buyerWalletId, addressId, 100, 1, 'succeeded', false, party.id, user.id,
    );

    expect(result).not.toBeNull();
    expect(result.transfer_credits).not.toBeNull();
    expect(result.transfer_credits.purchaseId).not.toBeNull();

    // New purchase created
    const { rows: [purchase] } = await client.query(
      'select * from purchase where id=$1',
      [result.transfer_credits.purchaseId]
    );
    expect(purchase).not.toBeNull();
    expect(purchase.type).toEqual('offline');
    expect(purchase.buyer_wallet_id).toEqual(buyerWalletId);
    expect(purchase.address_id).toEqual(addressId);
    expect(purchase.credit_vintage_id).toEqual(vintageId);
    expect(purchase.party_id).toEqual(party.id);
    expect(purchase.user_id).toEqual(user.id);

    // Account balances updated
    const { rows: balances } = await client.query(
      'select * from account_balance where credit_vintage_id=$1 ORDER BY liquid_balance DESC',
      [vintageId]
    );

    expect(balances).toHaveLength(2);
    expect(balances[0].wallet_id).toEqual(party.wallet_id);
    expect(parseFloat(balances[0].liquid_balance)).toEqual(900);
    expect(parseFloat(balances[0].burnt_balance)).toEqual(0);
    expect(balances[1].wallet_id).toEqual(buyerWalletId);
    expect(parseFloat(balances[1].liquid_balance)).toEqual(100);
    expect(parseFloat(balances[1].burnt_balance)).toEqual(0);

    // Transactions created
    const { rows: txs } = await client.query(
      'select * from transaction where purchase_id=$1 ORDER BY units DESC',
      [purchase.id]
    );

    expect(txs).toHaveLength(1);
    expect(txs[0].from_wallet_id).toEqual(party.wallet_id);
    expect(txs[0].to_wallet_id).toEqual(buyerWalletId);
    expect(parseFloat(txs[0].units)).toEqual(100);
    expect(txs[0].credit_vintage_id).toEqual(vintageId);
    expect(txs[0].broker_id).toEqual(party.id);
  })
);

it('transfers credits with buffer pool and permanence reversal pool', () => 
  withAdminUserDb(async (client, user, party) => {
    const { vintageId, buyerWalletId, addressId, project } = await setup(
      client, 1000, user, party, null, null, true, true,
    );

    const result = await transferCredits(client, vintageId,
      buyerWalletId, addressId, 100, 1, 'succeeded', false, party.id, user.id,
    );

    expect(result).not.toBeNull();
    expect(result.transfer_credits).not.toBeNull();
    expect(result.transfer_credits.purchaseId).not.toBeNull();

    // New purchase created
    const { rows: [purchase] } = await client.query(
      'select * from purchase where id=$1',
      [result.transfer_credits.purchaseId]
    );
    expect(purchase).not.toBeNull();
    expect(purchase.type).toEqual('offline');
    expect(purchase.buyer_wallet_id).toEqual(buyerWalletId);
    expect(purchase.address_id).toEqual(addressId);
    expect(purchase.credit_vintage_id).toEqual(vintageId);
    expect(purchase.party_id).toEqual(party.id);
    expect(purchase.user_id).toEqual(user.id);

    // Account balances updated
    const { rows: balances } = await client.query(
      'select * from account_balance where credit_vintage_id=$1 ORDER BY liquid_balance DESC',
      [vintageId]
    );

    expect(balances).toHaveLength(5);
    const { rows: devParties } = await client.query(
      'select wallet_id from party where id=$1',
      [project.developer_id]
    );
    expect(devParties).toHaveLength(1);
    expect(devParties[0]).not.toBeNull();
    expect(devParties[0].wallet_id).not.toBeNull();
    expect(balances[0].wallet_id).toEqual(devParties[0].wallet_id);
    expect(parseFloat(balances[0].liquid_balance)).toEqual(390);
    expect(parseFloat(balances[0].burnt_balance)).toEqual(0);

    const { rows: stewardParties } = await client.query(
      'select wallet_id from party where id=$1',
      [project.steward_id]
    );
    expect(stewardParties).toHaveLength(1);
    expect(stewardParties[0]).not.toBeNull();
    expect(stewardParties[0].wallet_id).not.toBeNull();
    expect(balances[1].wallet_id).toEqual(stewardParties[0].wallet_id);
    expect(parseFloat(balances[1].liquid_balance)).toEqual(260);
    expect(parseFloat(balances[1].burnt_balance)).toEqual(0);

    const { rows: bufferParties } = await client.query(
      `select wallet_id from party
      inner join "user" on "user".email = 'bufferpool-registry@regen.network'
      where party.id = "user".party_id`
    );
    expect(bufferParties).toHaveLength(1);
    expect(bufferParties[0]).not.toBeNull();
    expect(bufferParties[0].wallet_id).not.toBeNull();
    expect(balances[2].wallet_id).toEqual(bufferParties[0].wallet_id);
    expect(parseFloat(balances[2].liquid_balance)).toEqual(200);
    expect(parseFloat(balances[2].burnt_balance)).toEqual(0);

    expect(balances[3].wallet_id).toEqual(buyerWalletId);
    expect(parseFloat(balances[3].liquid_balance)).toEqual(100);
    expect(parseFloat(balances[3].burnt_balance)).toEqual(0);

    const { rows: permanenceParties } = await client.query(
      `select wallet_id from party
      inner join "user" on "user".email = 'permanence-registry@regen.network'
      where party.id = "user".party_id`
    );
    expect(permanenceParties).toHaveLength(1);
    expect(permanenceParties[0]).not.toBeNull();
    expect(permanenceParties[0].wallet_id).not.toBeNull();
    expect(balances[4].wallet_id).toEqual(permanenceParties[0].wallet_id);
    expect(parseFloat(balances[4].liquid_balance)).toEqual(50);
    expect(parseFloat(balances[4].burnt_balance)).toEqual(0);
  })
);

it('transfers credits and auto-retires', () => 
  withAdminUserDb(async (client, user, party) => {
    const { vintageId, buyerWalletId, addressId, project } = await setup(
      client, 1000, user, party, null, null,
    );

    const result = await transferCredits(client, vintageId,
      buyerWalletId, addressId, 100, 1, 'succeeded', true, party.id, user.id,
    );

    expect(result).not.toBeNull();
    expect(result.transfer_credits).not.toBeNull();
    expect(result.transfer_credits.purchaseId).not.toBeNull();

    // New purchase created
    const { rows: [purchase] } = await client.query(
      'select * from purchase where id=$1',
      [result.transfer_credits.purchaseId]
    );
    expect(purchase).not.toBeNull();
    expect(purchase.type).toEqual('offline');
    expect(purchase.buyer_wallet_id).toEqual(buyerWalletId);
    expect(purchase.address_id).toEqual(addressId);
    expect(purchase.credit_vintage_id).toEqual(vintageId);

    // New retirement created
    const { rows: retirements } = await client.query(
      'select * from retirement where wallet_id=$1 and address_id=$2 and credit_vintage_id=$3 and units=$4',
      [buyerWalletId, addressId, vintageId, 100]
    );
    expect(retirements).toHaveLength(1);

    // Account balances updated
    const { rows: balances } = await client.query(
      'select * from account_balance where credit_vintage_id=$1 ORDER BY liquid_balance DESC',
      [vintageId]
    );

    expect(balances).toHaveLength(3);
    const { rows: devParties } = await client.query(
      'select wallet_id from party where id=$1',
      [project.developer_id]
    );
    expect(devParties).toHaveLength(1);
    expect(devParties[0]).not.toBeNull();
    expect(devParties[0].wallet_id).not.toBeNull();
    expect(balances[0].wallet_id).toEqual(devParties[0].wallet_id);
    expect(parseFloat(balances[0].liquid_balance)).toEqual(540);
    expect(parseFloat(balances[0].burnt_balance)).toEqual(0);

    const { rows: stewardParties } = await client.query(
      'select wallet_id from party where id=$1',
      [project.steward_id]
    );
    expect(stewardParties).toHaveLength(1);
    expect(stewardParties[0]).not.toBeNull();
    expect(stewardParties[0].wallet_id).not.toBeNull();
    expect(balances[1].wallet_id).toEqual(stewardParties[0].wallet_id);
    expect(parseFloat(balances[1].liquid_balance)).toEqual(360);
    expect(parseFloat(balances[1].burnt_balance)).toEqual(0);

    expect(balances[2].wallet_id).toEqual(buyerWalletId);
    expect(parseFloat(balances[2].liquid_balance)).toEqual(0);
    expect(parseFloat(balances[2].burnt_balance)).toEqual(100);
  })
);

it('fails if current user is not an admin', () => 
  withAdminUserDb(async (client, user, party) => {
    const { vintageId, buyerWalletId, addressId, project } = await setup(
      client, 1000, user, party, null, null,
    );

    await becomeRoot(client);
    await client.query(
      'delete from admin where auth0_sub=$1',
      [user.auth0_sub]
    );

    await becomeUser(client, user.auth0_sub);

    const promise = transferCredits(client, vintageId,
      buyerWalletId, addressId, 1001, 1, 'succeeded', true, party.id, user.id,
    );
    await expect(promise).rejects.toMatchInlineSnapshot(
      `[error: new row violates row-level security policy for table "transaction"]`
    );
  })
);

it('fails if not enough credits left', () => 
  withAdminUserDb(async (client, user, party) => {
    const { vintageId, buyerWalletId, addressId, project } = await setup(
      client, 1000, user, party, null, null,
    );

    const promise = transferCredits(client, vintageId,
      buyerWalletId, addressId, 1001, 1, 'succeeded', true, party.id, user.id,
    );

    await expect(promise).rejects.toMatchInlineSnapshot(
      `[error: Not enough available credits left to transfer]`
    );
    await expect(promise).rejects.toHaveProperty('code', 'DNIED');
  })
);

it('fails if not enough credits left with buffer pool and permanence reversal pool', () => 
  withAdminUserDb(async (client, user, party) => {
    const { vintageId, buyerWalletId, addressId, project } = await setup(
      client, 1000, user, party, null, null, true, true,
    );

    const promise = transferCredits(client, vintageId,
      buyerWalletId, addressId, 751, 1, 'succeeded', true, party.id, user.id,
    );

    await expect(promise).rejects.toMatchInlineSnapshot(
      `[error: Not enough available credits left to transfer]`
    );
    await expect(promise).rejects.toHaveProperty('code', 'DNIED');
  })
);

async function setup(
  client: PoolClient,
  units: number,
  user: User,
  party: Party,
  issuerId: string | null,
  resellerId: string | null,
  pools: boolean | undefined = false,
  withPools: boolean | undefined = false,
) {
    await becomeRoot(client);
    // Create buyer
    const { rows: [buyer] } = await client.query(
      `select * from really_create_user_if_needed('buyer-test@test.com',
      'Buyer Test', null, null, '{"buyer"}', '{"some": "address"}'::jsonb, 'buyer', false)`
    );
    expect(buyer).not.toBeNull();
    expect(buyer.party_id).not.toBeNull();
    const { rows: parties } = await client.query(
      `select wallet_id, address_id from party where id=$1`,
      [buyer.party_id]
    );
    expect(parties).toHaveLength(1);
    const buyerWalletId: string = parties[0].wallet_id;
    const addressId: string = parties[0].address_id;

    // Create project
    const { project, creditClassVersion, methodologyVersion } = await createProject(client, party.wallet_id);
    expect(project).not.toBeNull();

    if (pools) {
      await setupPools(client, project.credit_class_id);  
    }

    // Issue credits
    await becomeUser(client, user.auth0_sub);
    const distribution: Distribution = { 'http://regen.network/projectDeveloperDistribution': 0.6, 'http://regen.network/landStewardDistribution': 0.4 };
    const metadata: Metadata = {
      'http://regen.network/bufferDistribution': {
        'http://regen.network/bufferPool': 0.2,
        'http://regen.network/permanenceReversalBuffer': 0.05,
      },
    };
    const issueResult =  await issueCredits(
      client,
      project.id,
      creditClassVersion.id,
      creditClassVersion.created_at,
      methodologyVersion.id,
      methodologyVersion.created_at,
      units,
      distribution,
      withPools ? metadata : null,
      issuerId || '00000000-0000-0000-0000-000000000000',
      resellerId || '00000000-0000-0000-0000-000000000000',
    );
    expect(issueResult).not.toBeNull();
    expect(issueResult.issue_credits).not.toBeNull();
    const vintageId: string = issueResult.issue_credits.creditVintageId;
    expect(vintageId).not.toBeNull();

    return { vintageId, project, buyerWalletId, addressId };
}