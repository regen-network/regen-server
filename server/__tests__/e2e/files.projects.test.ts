import fetch from 'node-fetch';
import {
  createNewUserAndLogin,
  dummyFilesSetup,
  dummyFilesTeardown,
  getMarketplaceURL,
  longerTestTimeout,
} from '../utils';

describe('files endpoint, projects auth...', () => {
  it(
    'allows a user to upload project media to a project they are an admin for...',
    async () => {
      const { authHeaders } = await createNewUserAndLogin();

      const accountIdQuery = await fetch(`${getMarketplaceURL()}/graphql`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          query: `{ getCurrentAccount { id } }`,
        }),
      });
      const accountIdResult = await accountIdQuery.json();
      const accountId = accountIdResult.data.getCurrentAccount.id;

      const createProjectQuery = await fetch(`${getMarketplaceURL()}/graphql`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          query:
            'mutation CreateProject($input: CreateProjectInput!) { createProject(input: $input) { project { id } } }',
          variables: `{"input":{"project":{"adminAccountId":"${accountId}"}}}`,
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
    },
    longerTestTimeout,
  );
  it(
    'disallows a user from uploading project media to a project they are not admin for...',
    async () => {
      // this can be a longer running test...
      const { authHeaders } = await createNewUserAndLogin();

      const { authHeaders: authHeaders1 } = await createNewUserAndLogin();

      const accountIdQuery = await fetch(`${getMarketplaceURL()}/graphql`, {
        method: 'POST',
        headers: authHeaders1,
        body: JSON.stringify({
          query: `{ getCurrentAccount { id } }`,
        }),
      });
      const accountIdResult = await accountIdQuery.json();
      const accountId1 = accountIdResult.data.getCurrentAccount.id;

      const createProjectQuery = await fetch(`${getMarketplaceURL()}/graphql`, {
        method: 'POST',
        headers: authHeaders1,
        body: JSON.stringify({
          query:
            'mutation CreateProject($input: CreateProjectInput!) { createProject(input: $input) { project { id } } }',
          variables: `{"input":{"project":{"adminAccountId": "${accountId1}"}}}`,
        }),
      });
      const createProjectResult = await createProjectQuery.json();
      const projectId = createProjectResult.data.createProject.project.id;

      const key = `projects-test/${projectId}`;
      const fname = `test-${projectId}.txt`;

      const { resp } = await dummyFilesSetup(
        key,
        fname,
        projectId,
        authHeaders,
      );
      expect(resp.status).toBe(401);
    },
    longerTestTimeout,
  );
});