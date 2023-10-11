import fetch from 'node-fetch';
import {
  createNewUserAndLogin,
  dummyFilesSetup,
  dummyFilesTeardown,
  getMarketplaceURL,
} from '../utils';

describe('files endpoint, projects auth...', () => {
  it('allows a user to upload project media to a project they are an admin for...', async () => {
    const { authHeaders } = await createNewUserAndLogin();

    const partyIdQuery = await fetch(`${getMarketplaceURL()}/graphql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        query: `{ getCurrentParty { id } }`,
      }),
    });
    const partyIdResult = await partyIdQuery.json();
    const partyId = partyIdResult.data.getCurrentParty.id;

    const createProjectQuery = await fetch(`${getMarketplaceURL()}/graphql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        query:
          'mutation CreateProject($input: CreateProjectInput!) { createProject(input: $input) { project { id } } }',
        variables: `{"input":{"project":{"adminPartyId":"${partyId}"}}}`,
      }),
    });
    const createProjectResult = await createProjectQuery.json();
    const projectId = createProjectResult.data.createProject.project.id;

    const key = `projects-test/${projectId}`;
    const fname = `test-${projectId}.txt`;

    try {
      const { resp } = await dummyFilesSetup(
        key,
        fname,
        projectId,
        authHeaders,
      );
      expect(resp.status).toBe(200);
    } finally {
      await dummyFilesTeardown(key, fname);
    }
  });
  it('disallows a user from uploading project media to a project they are not admin for...', async () => {
    const { authHeaders } = await createNewUserAndLogin();

    const { authHeaders: authHeaders1 } = await createNewUserAndLogin();

    const partyIdQuery = await fetch(`${getMarketplaceURL()}/graphql`, {
      method: 'POST',
      headers: authHeaders1,
      body: JSON.stringify({
        query: `{ getCurrentParty { id } }`,
      }),
    });
    const partyIdResult = await partyIdQuery.json();
    const partyId1 = partyIdResult.data.getCurrentParty.id;

    const createProjectQuery = await fetch(`${getMarketplaceURL()}/graphql`, {
      method: 'POST',
      headers: authHeaders1,
      body: JSON.stringify({
        query:
          'mutation CreateProject($input: CreateProjectInput!) { createProject(input: $input) { project { id } } }',
        variables: `{"input":{"project":{"adminPartyId": "${partyId1}"}}}`,
      }),
    });
    const createProjectResult = await createProjectQuery.json();
    const projectId = createProjectResult.data.createProject.project.id;

    const key = `projects-test/${projectId}`;
    const fname = `test-${projectId}.txt`;

    const { resp } = await dummyFilesSetup(key, fname, projectId, authHeaders);
    expect(resp.status).toBe(401);
  });
});
