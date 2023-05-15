import fetch from 'node-fetch';
import {
  createNewUserAndLogin,
  dummyFilesSetup,
  dummyFilesTeardown,
} from '../utils';

describe('files endpoint, projects auth...', () => {
  it('allows a user to upload project media to a project they are an admin for...', async () => {
    const { authHeaders, userAddr } = await createNewUserAndLogin();

    const walletIdQuery = await fetch('http://localhost:5000/graphql', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        query: `{ walletByAddr(addr: "${userAddr}") { id } }`,
      }),
    });
    const walletIdResult = await walletIdQuery.json();
    const walletId = walletIdResult.data.walletByAddr.id;

    const createProjectQuery = await fetch('http://localhost:5000/graphql', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        query:
          'mutation CreateProject($input: CreateProjectInput!) { createProject(input: $input) { project { id } } }',
        variables: `{"input":{"project":{"adminWalletId":"${walletId}"}}}`,
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

    const { authHeaders: authHeaders1, userAddr: userAddr1 } =
      await createNewUserAndLogin();

    const walletIdQuery = await fetch('http://localhost:5000/graphql', {
      method: 'POST',
      headers: authHeaders1,
      body: JSON.stringify({
        query: `{ walletByAddr(addr: "${userAddr1}") { id } }`,
      }),
    });
    const walletIdResult = await walletIdQuery.json();
    const walletId1 = walletIdResult.data.walletByAddr.id;

    const createProjectQuery = await fetch('http://localhost:5000/graphql', {
      method: 'POST',
      headers: authHeaders1,
      body: JSON.stringify({
        query:
          'mutation CreateProject($input: CreateProjectInput!) { createProject(input: $input) { project { id } } }',
        variables: `{"input":{"project":{"adminWalletId": "${walletId1}"}}}`,
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
