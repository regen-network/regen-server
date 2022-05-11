import { withRootDb, createUserOrganisation } from '../helpers';

const email = 'johndoe@gmail.com';
const name = 'john doe';
const image = 'image';
const orgName = 'john doe ltd';
const roles = null;
const walletAddr = 'addr123';
const orgAddress: object = { some: 'address' };

it('creates user and org successfully', () =>
  withRootDb(async client => {
    // Action
    const org = await createUserOrganisation(
      client,
      email,
      name,
      image,
      orgName,
      walletAddr,
      roles,
      orgAddress,
    );

    // Assertions
    // Creates org, org party, wallet and address
    expect(org).not.toBeNull();
    expect(org.party_id).not.toBeNull();
    expect(org.legal_name).toEqual(orgName);

    const { rows: orgParties } = await client.query(
      'select * from party where id=$1',
      [org.party_id],
    );

    expect(orgParties).toHaveLength(1);
    const orgParty = orgParties[0];

    expect(orgParty.name).toEqual(orgName);
    expect(orgParty.type).toEqual('organization');
    expect(orgParty.roles).toEqual(roles);
    expect(orgParty.address_id).not.toBeNull();

    const { rows: wallets } = await client.query(
      'select * from wallet where party_id=$1',
      [orgParty.id],
    );

    expect(wallets).toHaveLength(1);
    expect(wallets[0].addr).not.toBeNull();

    const { rows: addresses } = await client.query(
      'select * from address where id=$1',
      [orgParty.address_id],
    );

    expect(addresses).toHaveLength(1);
    expect(addresses[0].feature).toEqual(orgAddress);

    // Creates organization member and user
    const { rows: members } = await client.query(
      'select * from organization_member where organization_id=$1',
      [org.id],
    );

    expect(members).toHaveLength(1);
    expect(members[0].is_owner).toEqual(true);

    const { rows: users } = await client.query(
      'select * from "user" where id=$1',
      [members[0].member_id],
    );

    expect(users).toHaveLength(1);
    expect(users[0].email).toEqual(email);

    const { rows: userParties } = await client.query(
      'select * from party where id=$1',
      [users[0].party_id],
    );

    expect(userParties).toHaveLength(1);
    const party = userParties[0];

    expect(party.image).toEqual(image);
    expect(party.name).toEqual(name);
    expect(party.type).toEqual('user');
    expect(party.roles).toBeNull();
    const { rows: userWallets } = await client.query(
      'select * from wallet where party_id=$1',
      [users[0].party_id],
    );
    expect(userWallets).toHaveLength(0);
  }));
