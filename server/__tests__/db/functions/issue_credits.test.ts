import { PoolClient } from 'pg';

import {
  withAdminUserDb,
  becomeRoot,
  becomeUser,
  createProject,
  createUserOrganisation,
} from '../helpers';

export interface Distribution {
  'http://regen.network/projectDeveloperDistribution'?: number;
  'http://regen.network/landOwnerDistribution'?: number;
  'http://regen.network/landStewardDistribution'?: number;
}

export interface Metadata {
  'http://regen.network/bufferDistribution'?: {
    'http://regen.network/bufferPool'?: number;
    'http://regen.network/permanenceReversalBuffer'?: number;
  };
}

interface IssueCreditsRow {
  creditVintageId: string;
  accountBalances: any[];
}

interface IssueCredits {
  issue_credits: IssueCreditsRow;
}

export async function issueCredits(
  client: PoolClient,
  projectId: string | null,
  creditClassVersionId: string,
  creditClassVersionCreatedAt: string,
  methodologyVersionId: string,
  methodologyVersionCreatedAt: string,
  units: number | null,
  initialDistribution: Distribution | null,
  metadata: Metadata | null,
  issuerId: string | null,
  resellerId: string | null,
  batchDenom: string | null = null,
): Promise<IssueCredits> {
  const {
    rows: [row],
  } = await client.query(
    `
      select * from public.issue_credits(
        $1, $2, $3, $4, $5, $6, $7, now(), now(), $8, $9, $10, $11

      )
      `,
    [
      projectId,
      creditClassVersionId,
      creditClassVersionCreatedAt,
      methodologyVersionId,
      methodologyVersionCreatedAt,
      units,
      initialDistribution,
      metadata || {},
      issuerId || '00000000-0000-0000-0000-000000000000',
      resellerId || '00000000-0000-0000-0000-000000000000',
      batchDenom,
    ],
  );
  return row;
}

it('issues credits', () =>
  withAdminUserDb(async (client, user, party) => {
    const distribution: Distribution = {
      'http://regen.network/projectDeveloperDistribution': 0.6,
      'http://regen.network/landStewardDistribution': 0.4,
    };
    const units = 1000;

    await becomeRoot(client);
    const { project, creditClassVersion, methodologyVersion } =
      await createProject(client, party.wallet_id);
    expect(project).not.toBeNull();

    await becomeUser(client, user.auth0_sub);
    const result = await issueCredits(
      client,
      project.id,
      creditClassVersion.id,
      creditClassVersion.created_at,
      methodologyVersion.id,
      methodologyVersion.created_at,
      units,
      distribution,
      null,
      null,
      null,
      'C01-20190101-20200101-001',
    );

    expect(result).not.toBeNull();
    expect(result.issue_credits).not.toBeNull();
    expect(result.issue_credits.creditVintageId).not.toBeNull();
    expect(result.issue_credits.accountBalances).not.toBeNull();
    expect(result.issue_credits.accountBalances).toHaveLength(2);
    expect(result.issue_credits.accountBalances[0].name).toEqual(
      'http://regen.network/landStewardDistribution',
    );
    expect(result.issue_credits.accountBalances[0].percentage).toEqual(40);
    expect(result.issue_credits.accountBalances[0].amount).toEqual(400);
    expect(result.issue_credits.accountBalances[1].name).toEqual(
      'http://regen.network/projectDeveloperDistribution',
    );
    expect(result.issue_credits.accountBalances[1].percentage).toEqual(60);
    expect(result.issue_credits.accountBalances[1].amount).toEqual(600);

    // credit vintage created
    const { rows: vintages } = await client.query(
      'select * from credit_vintage where id=$1',
      [result.issue_credits.creditVintageId],
    );

    expect(vintages).toHaveLength(1);
    expect(vintages[0].credit_class_version_id).toEqual(creditClassVersion.id);
    expect(vintages[0].credit_class_version_created_at).toEqual(
      creditClassVersion.created_at,
    );
    expect(vintages[0].methodology_version_id).toEqual(methodologyVersion.id);
    expect(vintages[0].methodology_version_created_at).toEqual(
      methodologyVersion.created_at,
    );
    expect(vintages[0].project_id).toEqual(project.id);
    expect(vintages[0].tokenizer_id).toEqual(party.wallet_id);
    expect(parseInt(vintages[0].units)).toEqual(units);
    expect(vintages[0].initial_distribution).toEqual({
      '@type': 'http://regen.network/CreditVintage',
      ...distribution,
    });
    expect(vintages[0].batch_denom).toEqual('C01-20190101-20200101-001');

    // account balances created
    const { rows: balances } = await client.query(
      'select * from account_balance where credit_vintage_id=$1 ORDER BY liquid_balance DESC',
      [result.issue_credits.creditVintageId],
    );

    expect(balances).toHaveLength(2);
    const { rows: devParties } = await client.query(
      'select wallet_id from party where id=$1',
      [project.developer_id],
    );
    expect(devParties).toHaveLength(1);
    expect(devParties[0]).not.toBeNull();
    expect(devParties[0].wallet_id).not.toBeNull();
    expect(balances[0].wallet_id).toEqual(devParties[0].wallet_id);
    expect(parseFloat(balances[0].liquid_balance)).toEqual(600);
    expect(parseFloat(balances[0].burnt_balance)).toEqual(0);

    const { rows: stewardParties } = await client.query(
      'select wallet_id from party where id=$1',
      [project.steward_id],
    );
    expect(stewardParties).toHaveLength(1);
    expect(stewardParties[0]).not.toBeNull();
    expect(stewardParties[0].wallet_id).not.toBeNull();
    expect(balances[1].wallet_id).toEqual(stewardParties[0].wallet_id);
    expect(parseFloat(balances[1].liquid_balance)).toEqual(400);
    expect(parseFloat(balances[1].burnt_balance)).toEqual(0);
  }));

it('issues 3rd party credits with reseller and initial issuer', () =>
  withAdminUserDb(async (client, user, party) => {
    const distribution: Distribution = {
      'http://regen.network/projectDeveloperDistribution': 0.6,
      'http://regen.network/landStewardDistribution': 0.4,
    };
    const units = 1000;

    await becomeRoot(client);
    const { project, creditClassVersion, methodologyVersion } =
      await createProject(client, party.wallet_id);
    expect(project).not.toBeNull();
    const thirdPartyOrg = await createUserOrganisation(
      client,
      'third-party@gmail.com',
      '3rd party person',
      '3rd party image',
      '3rd party org',
      '',
      null,
      {},
    );
    expect(thirdPartyOrg).not.toBeNull();

    await becomeUser(client, user.auth0_sub);
    const result = await issueCredits(
      client,
      project.id,
      creditClassVersion.id,
      creditClassVersion.created_at,
      methodologyVersion.id,
      methodologyVersion.created_at,
      units,
      distribution,
      null,
      thirdPartyOrg.party_id,
      party.wallet_id,
      null,
    );

    expect(result).not.toBeNull();
    expect(result.issue_credits).not.toBeNull();
    expect(result.issue_credits.creditVintageId).not.toBeNull();
    expect(result.issue_credits.accountBalances).not.toBeNull();
    expect(result.issue_credits.accountBalances).toHaveLength(1);
    expect(result.issue_credits.accountBalances[0].name).toEqual(
      'http://regen.network/reseller',
    );
    expect(result.issue_credits.accountBalances[0].percentage).toEqual(100);
    expect(result.issue_credits.accountBalances[0].amount).toEqual(1000);

    // credit vintage created
    const { rows: vintages } = await client.query(
      'select * from credit_vintage where id=$1',
      [result.issue_credits.creditVintageId],
    );

    expect(vintages).toHaveLength(1);
    expect(vintages[0].credit_class_version_id).toEqual(creditClassVersion.id);
    expect(vintages[0].credit_class_version_created_at).toEqual(
      creditClassVersion.created_at,
    );
    expect(vintages[0].methodology_version_id).toEqual(methodologyVersion.id);
    expect(vintages[0].methodology_version_created_at).toEqual(
      methodologyVersion.created_at,
    );
    expect(vintages[0].project_id).toEqual(project.id);
    expect(vintages[0].tokenizer_id).toEqual(party.wallet_id);
    expect(vintages[0].reseller_id).toEqual(party.wallet_id);
    expect(vintages[0].issuer_id).toEqual(thirdPartyOrg.party_id);
    expect(parseInt(vintages[0].units)).toEqual(units);
    expect(vintages[0].initial_distribution).toEqual({
      '@type': 'http://regen.network/CreditVintage',
      ...distribution,
    });

    // account balances created
    const { rows: balances } = await client.query(
      'select * from account_balance where credit_vintage_id=$1 ORDER BY liquid_balance DESC',
      [result.issue_credits.creditVintageId],
    );

    expect(balances).toHaveLength(1);
    expect(balances[0].wallet_id).toEqual(party.wallet_id);
    expect(parseFloat(balances[0].liquid_balance)).toEqual(1000);
    expect(parseFloat(balances[0].burnt_balance)).toEqual(0);
  }));

it('issues 3rd party credits with reseller, initial issuer and metadata', () =>
  withAdminUserDb(async (client, user, party) => {
    const distribution: Distribution = {
      'http://regen.network/projectDeveloperDistribution': 0.6,
      'http://regen.network/landStewardDistribution': 0.4,
    };
    const units = 1000;
    const metadata: Metadata = {
      'http://regen.network/bufferDistribution': {
        'http://regen.network/bufferPool': 0.2,
        'http://regen.network/permanenceReversalBuffer': 0.05,
      },
    };

    await becomeRoot(client);
    const { project, creditClassVersion, methodologyVersion } =
      await createProject(client, party.wallet_id);
    expect(project).not.toBeNull();
    const thirdPartyOrg = await createUserOrganisation(
      client,
      'third-party@gmail.com',
      '3rd party person',
      '3rd party image',
      '3rd party org',
      '',
      null,
      {},
    );

    await becomeUser(client, user.auth0_sub);
    const result = await issueCredits(
      client,
      project.id,
      creditClassVersion.id,
      creditClassVersion.created_at,
      methodologyVersion.id,
      methodologyVersion.created_at,
      units,
      distribution,
      metadata,
      thirdPartyOrg.party_id,
      party.wallet_id,
      null,
    );

    expect(result).not.toBeNull();
    expect(result.issue_credits).not.toBeNull();
    expect(result.issue_credits.creditVintageId).not.toBeNull();
    expect(result.issue_credits.accountBalances).not.toBeNull();
    expect(result.issue_credits.accountBalances).toHaveLength(1);
    expect(result.issue_credits.accountBalances[0].name).toEqual(
      'http://regen.network/reseller',
    );
    expect(result.issue_credits.accountBalances[0].percentage).toEqual(100);
    expect(result.issue_credits.accountBalances[0].amount).toEqual(1000);

    // credit vintage created
    const { rows: vintages } = await client.query(
      'select * from credit_vintage where id=$1',
      [result.issue_credits.creditVintageId],
    );

    expect(vintages).toHaveLength(1);
    expect(vintages[0].credit_class_version_id).toEqual(creditClassVersion.id);
    expect(vintages[0].credit_class_version_created_at).toEqual(
      creditClassVersion.created_at,
    );
    expect(vintages[0].methodology_version_id).toEqual(methodologyVersion.id);
    expect(vintages[0].methodology_version_created_at).toEqual(
      methodologyVersion.created_at,
    );
    expect(vintages[0].project_id).toEqual(project.id);
    expect(vintages[0].tokenizer_id).toEqual(party.wallet_id);
    expect(vintages[0].reseller_id).toEqual(party.wallet_id);
    expect(vintages[0].issuer_id).toEqual(thirdPartyOrg.party_id);
    expect(parseInt(vintages[0].units)).toEqual(units);
    expect(vintages[0].initial_distribution).toEqual({
      '@type': 'http://regen.network/CreditVintage',
      ...distribution,
    });
    expect(vintages[0].metadata).toEqual(metadata);

    // account balances created
    const { rows: balances } = await client.query(
      'select * from account_balance where credit_vintage_id=$1 ORDER BY liquid_balance DESC',
      [result.issue_credits.creditVintageId],
    );

    expect(balances).toHaveLength(1);
    expect(balances[0].wallet_id).toEqual(party.wallet_id);
    expect(parseFloat(balances[0].liquid_balance)).toEqual(1000);
    expect(parseFloat(balances[0].burnt_balance)).toEqual(0);
  }));

it('issues credits with buffer pool and permanence reversal pool', () =>
  withAdminUserDb(async (client, user, party) => {
    const distribution: Distribution = {
      'http://regen.network/projectDeveloperDistribution': 0.6,
      'http://regen.network/landStewardDistribution': 0.4,
    };
    const metadata: Metadata = {
      'http://regen.network/bufferDistribution': {
        'http://regen.network/bufferPool': 0.2,
        'http://regen.network/permanenceReversalBuffer': 0.05,
      },
    };
    const units = 1000;

    await becomeRoot(client);
    const { project, creditClassVersion, methodologyVersion } =
      await createProject(client, party.wallet_id);
    expect(project).not.toBeNull();
    await setupPools(client);

    await becomeUser(client, user.auth0_sub);
    const result = await issueCredits(
      client,
      project.id,
      creditClassVersion.id,
      creditClassVersion.created_at,
      methodologyVersion.id,
      methodologyVersion.created_at,
      units,
      distribution,
      metadata,
      null,
      null,
      null,
    );

    expect(result).not.toBeNull();
    expect(result.issue_credits).not.toBeNull();
    expect(result.issue_credits.creditVintageId).not.toBeNull();
    expect(result.issue_credits.accountBalances).not.toBeNull();
    expect(result.issue_credits.accountBalances).toHaveLength(4);
    expect(result.issue_credits.accountBalances[0].name).toEqual(
      'http://regen.network/bufferPool',
    );
    expect(result.issue_credits.accountBalances[0].percentage).toEqual(20);
    expect(result.issue_credits.accountBalances[0].amount).toEqual(200);
    expect(result.issue_credits.accountBalances[1].name).toEqual(
      'http://regen.network/permanenceReversalBuffer',
    );
    expect(result.issue_credits.accountBalances[1].percentage).toEqual(5);
    expect(result.issue_credits.accountBalances[1].amount).toEqual(50);
    expect(result.issue_credits.accountBalances[2].name).toEqual(
      'http://regen.network/landStewardDistribution',
    );
    expect(result.issue_credits.accountBalances[2].percentage).toEqual(30);
    expect(result.issue_credits.accountBalances[2].amount).toEqual(300);
    expect(result.issue_credits.accountBalances[3].name).toEqual(
      'http://regen.network/projectDeveloperDistribution',
    );
    expect(result.issue_credits.accountBalances[3].percentage).toEqual(45);
    expect(result.issue_credits.accountBalances[3].amount).toEqual(450);

    // credit vintage created
    const { rows: vintages } = await client.query(
      'select * from credit_vintage where id=$1',
      [result.issue_credits.creditVintageId],
    );

    expect(vintages).toHaveLength(1);
    expect(vintages[0].credit_class_version_id).toEqual(creditClassVersion.id);
    expect(vintages[0].credit_class_version_created_at).toEqual(
      creditClassVersion.created_at,
    );
    expect(vintages[0].methodology_version_id).toEqual(methodologyVersion.id);
    expect(vintages[0].methodology_version_created_at).toEqual(
      methodologyVersion.created_at,
    );
    expect(vintages[0].project_id).toEqual(project.id);
    expect(vintages[0].tokenizer_id).toEqual(party.wallet_id);
    expect(parseInt(vintages[0].units)).toEqual(units);
    expect(vintages[0].initial_distribution).toEqual({
      '@type': 'http://regen.network/CreditVintage',
      ...distribution,
    });
    expect(vintages[0].metadata).toEqual(metadata);
    expect(vintages[0].batch_denom).toBeNull();

    // account balances created
    const { rows: balances } = await client.query(
      'select * from account_balance where credit_vintage_id=$1 ORDER BY liquid_balance DESC',
      [result.issue_credits.creditVintageId],
    );

    expect(balances).toHaveLength(4);

    const { rows: devParties } = await client.query(
      'select wallet_id from party where id=$1',
      [project.developer_id],
    );
    expect(devParties).toHaveLength(1);
    expect(devParties[0]).not.toBeNull();
    expect(devParties[0].wallet_id).not.toBeNull();
    expect(balances[0].wallet_id).toEqual(devParties[0].wallet_id);
    expect(parseFloat(balances[0].liquid_balance)).toEqual(450);
    expect(parseFloat(balances[0].burnt_balance)).toEqual(0);

    const { rows: stewardParties } = await client.query(
      'select wallet_id from party where id=$1',
      [project.steward_id],
    );
    expect(stewardParties).toHaveLength(1);
    expect(stewardParties[0]).not.toBeNull();
    expect(stewardParties[0].wallet_id).not.toBeNull();
    expect(balances[1].wallet_id).toEqual(stewardParties[0].wallet_id);
    expect(parseFloat(balances[1].liquid_balance)).toEqual(300);
    expect(parseFloat(balances[1].burnt_balance)).toEqual(0);

    const { rows: bufferParties } = await client.query(
      `select wallet_id from party
      inner join "user" on "user".email = 'bufferpool-registry@regen.network'
      where party.id = "user".party_id`,
    );
    expect(bufferParties).toHaveLength(1);
    expect(bufferParties[0]).not.toBeNull();
    expect(bufferParties[0].wallet_id).not.toBeNull();
    expect(balances[2].wallet_id).toEqual(bufferParties[0].wallet_id);
    expect(parseFloat(balances[2].liquid_balance)).toEqual(200);
    expect(parseFloat(balances[2].burnt_balance)).toEqual(0);

    const { rows: permanenceParties } = await client.query(
      `select wallet_id from party
      inner join "user" on "user".email = 'permanence-registry@regen.network'
      where party.id = "user".party_id`,
    );
    expect(permanenceParties).toHaveLength(1);
    expect(permanenceParties[0]).not.toBeNull();
    expect(permanenceParties[0].wallet_id).not.toBeNull();
    expect(balances[3].wallet_id).toEqual(permanenceParties[0].wallet_id);
    expect(parseFloat(balances[3].liquid_balance)).toEqual(50);
    expect(parseFloat(balances[3].burnt_balance)).toEqual(0);
  }));

it('fails if sum of initial distribution not equal to 100%', () =>
  withAdminUserDb(async (client, user, party) => {
    const distribution: Distribution = {
      'http://regen.network/projectDeveloperDistribution': 0.6,
      'http://regen.network/landStewardDistribution': 0.5,
    };
    const units = 1000;

    await becomeRoot(client);
    const { project, creditClassVersion, methodologyVersion } =
      await createProject(client, party.wallet_id);
    expect(project).not.toBeNull();

    await becomeUser(client, user.auth0_sub);
    const promise = issueCredits(
      client,
      project.id,
      creditClassVersion.id,
      creditClassVersion.created_at,
      methodologyVersion.id,
      methodologyVersion.created_at,
      units,
      distribution,
      null,
      null,
      null,
      null,
    );

    await expect(promise).rejects.toMatchInlineSnapshot(
      `[error: Sum of ownership breakdown not equal to 100]`,
    );
    await expect(promise).rejects.toHaveProperty('code', 'DNIED');
  }));

it('fails if current user does not exist', () =>
  withAdminUserDb(async (client, user, party) => {
    const distribution: Distribution = {
      'http://regen.network/projectDeveloperDistribution': 0.6,
      'http://regen.network/landStewardDistribution': 0.4,
    };
    const units = 1000;

    await becomeRoot(client);
    const { project, creditClassVersion, methodologyVersion } =
      await createProject(client, party.wallet_id);
    expect(project).not.toBeNull();

    const promise = issueCredits(
      client,
      project.id,
      creditClassVersion.id,
      creditClassVersion.created_at,
      methodologyVersion.id,
      methodologyVersion.created_at,
      units,
      distribution,
      null,
      null,
      null,
      null,
    );

    await expect(promise).rejects.toMatchInlineSnapshot(
      `[error: User not found]`,
    );
    await expect(promise).rejects.toHaveProperty('code', 'NTFND');
  }));

it('fails if current user is not an admin', () =>
  withAdminUserDb(async (client, user, party) => {
    const distribution: Distribution = {
      'http://regen.network/projectDeveloperDistribution': 0.6,
      'http://regen.network/landStewardDistribution': 0.4,
    };
    const units = 1000;

    await becomeRoot(client);
    const { project, creditClassVersion, methodologyVersion } =
      await createProject(client, party.wallet_id);
    expect(project).not.toBeNull();
    await client.query('delete from admin where auth0_sub=$1', [
      user.auth0_sub,
    ]);

    await becomeUser(client, user.auth0_sub);
    const promise = issueCredits(
      client,
      project.id,
      creditClassVersion.id,
      creditClassVersion.created_at,
      methodologyVersion.id,
      methodologyVersion.created_at,
      units,
      distribution,
      null,
      null,
      null,
      null,
    );

    await expect(promise).rejects.toMatchInlineSnapshot(
      `[error: new row violates row-level security policy for table "credit_vintage"]`,
    );
  }));

it('fails if current user does not belong to an organization', () =>
  withAdminUserDb(async (client, user, party) => {
    const distribution: Distribution = {
      'http://regen.network/projectDeveloperDistribution': 0.6,
      'http://regen.network/landStewardDistribution': 0.4,
    };
    const units = 1000;

    await becomeRoot(client);
    const { project, creditClassVersion, methodologyVersion } =
      await createProject(client, party.wallet_id);
    expect(project).not.toBeNull();
    await client.query('delete from organization_member where member_id=$1', [
      user.id,
    ]);

    await becomeUser(client, user.auth0_sub);
    const promise = issueCredits(
      client,
      project.id,
      creditClassVersion.id,
      creditClassVersion.created_at,
      methodologyVersion.id,
      methodologyVersion.created_at,
      units,
      distribution,
      null,
      null,
      null,
      null,
    );

    await expect(promise).rejects.toMatchInlineSnapshot(
      `[error: User should be part of an organization to issue credits in the name of this organization]`,
    );
    await expect(promise).rejects.toHaveProperty('code', 'DNIED');
  }));

it('fails if current user is not credit class issuer', () =>
  withAdminUserDb(async (client, user) => {
    const distribution: Distribution = {
      'http://regen.network/projectDeveloperDistribution': 0.6,
      'http://regen.network/landStewardDistribution': 0.4,
    };
    const units = 1000;

    await becomeRoot(client);
    const { project, creditClassVersion, methodologyVersion } =
      await createProject(client, null);
    expect(project).not.toBeNull();

    await becomeUser(client, user.auth0_sub);
    const promise = issueCredits(
      client,
      project.id,
      creditClassVersion.id,
      creditClassVersion.created_at,
      methodologyVersion.id,
      methodologyVersion.created_at,
      units,
      distribution,
      null,
      null,
      null,
      null,
    );

    await expect(promise).rejects.toMatchInlineSnapshot(
      `[error: User not allowed to issue credits for this project]`,
    );
    await expect(promise).rejects.toHaveProperty('code', 'DNIED');
  }));

export async function setupPools(
  client: PoolClient,
): Promise<void> {
  await client.query(
    `select really_create_user_if_needed('permanence-registry@regen.network',
      'Permanence Reversal Buffer', null, null, '{"administrative", "buyer"}', '{}'::jsonb, 'permanence', false)`,
  );
  await client.query(
    `select really_create_user_if_needed('bufferpool-registry@regen.network',
      'Buffer Pool', null, null, '{"administrative", "buyer"}', '{}'::jsonb, 'bufferpool', false)`,
  );
}
