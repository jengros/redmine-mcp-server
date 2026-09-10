import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const entry = fileURLToPath(new URL('../dist/server.mjs', import.meta.url));

test('updateIssue through the built MCP server', async (t) => {
  const requests = [];
  let mode = 204;
  const http = createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    requests.push({ method: req.method, url: req.url, body: JSON.parse(raw) });
    if (mode === 'disconnect') { req.socket.destroy(); return; }
    res.writeHead(mode, { 'Content-Type': 'application/json' });
    res.end(mode === 204 ? undefined : JSON.stringify({ errors: ['Time entry rejected'] }));
  });
  http.listen(0, '127.0.0.1');
  await once(http, 'listening');
  t.after(() => new Promise(resolve => http.close(resolve)));
  const connect = async (env = {}) => {
    const client = new Client({ name: 'local-contract-test', version: '1.0.0' });
    const transport = new StdioClientTransport({
      command: process.execPath, args: [entry], stderr: 'pipe',
      env: {
        REDMINE_URL: `http://127.0.0.1:${http.address().port}/redmine`,
        REDMINE_API_KEY: 'not-a-real-key', REDMINE_MCP_READ_ONLY: 'false',
        ...env,
      },
    });
    transport.stderr?.on('data', () => {});
    await client.connect(transport);
    t.after(() => client.close());
    return client;
  };
  const client = await connect();
  const args = bodyParams => ({ pathParams: { format: 'json', issueId: 123 }, bodyParams });
  const body = {
    issue: { notes: '작업 완료\n\n속도 개선 확인.', status_id: 3, assigned_to_id: 7 },
    time_entry: { hours: 1, activity_id: 9, spent_on: '2026-09-10', comments: '개선 작업',
      custom_field_values: { '2': 'test' } },
  };
  await t.test('advertises optional time_entry without removing existing tools', async () => {
    const { tools } = await client.listTools();
    const update = tools.find(x => x.name === 'updateIssue');
    assert.ok(update.inputSchema.properties.bodyParams.properties.time_entry);
    assert.equal(update.annotations.readOnlyHint, false);
    assert.ok(tools.some(x => x.name === 'createTimeEntry'));
  });
  await t.test('sends one PUT containing issue and time_entry siblings', async () => {
    requests.length = 0;
    const result = await client.callTool({ name: 'updateIssue', arguments: args(body) });
    assert.ok(!result.isError);
    assert.equal(JSON.parse(result.content[0].text).status, 204);
    assert.deepEqual(requests, [{ method: 'PUT', url: '/redmine/issues/123.json', body }]);
  });
  await t.test('issue-only calls retain their original payload', async () => {
    requests.length = 0;
    const legacy = { issue: { notes: 'Comment only' } };
    await client.callTool({ name: 'updateIssue', arguments: args(legacy) });
    assert.deepEqual(requests.map(r => r.body), [legacy]);
  });
  await t.test('minimal time entry does not invent date, activity or comments', async () => {
    requests.length = 0;
    const minimal = { issue: { notes: 'Done' }, time_entry: { hours: 0.5 } };
    await client.callTool({ name: 'updateIssue', arguments: args(minimal) });
    assert.deepEqual(requests.map(r => r.body), [minimal]);
  });
  await t.test('invalid time entries are rejected before HTTP', async () => {
    for (const time_entry of [{}, null, { hours: -1 }, { hours: '1' }, { hours: 1, spent_on: 'invalid' }]) {
      requests.length = 0;
      let rejected = false;
      try { rejected = Boolean((await client.callTool({ name: 'updateIssue', arguments: args({ time_entry }) })).isError); }
      catch { rejected = true; }
      assert.ok(rejected);
      assert.equal(requests.length, 0);
    }
  });
  await t.test('HTTP validation/permission failures are errors without a second write', async () => {
    for (const status of [422, 403]) {
      mode = status; requests.length = 0;
      const result = await client.callTool({ name: 'updateIssue', arguments: args(body) });
      assert.equal(result.isError, true);
      assert.equal(JSON.parse(result.content[0].text).status, status);
      assert.equal(requests.length, 1);
    }
  });
  await t.test('lost response is not retried', async () => {
    mode = 'disconnect'; requests.length = 0;
    let rejected = false;
    try { rejected = Boolean((await client.callTool({ name: 'updateIssue', arguments: args(body) })).isError); }
    catch { rejected = true; }
    assert.ok(rejected);
    assert.equal(requests.length, 1);
  });
  await t.test('read-only and deny filters still hide updateIssue', async () => {
    for (const env of [{ REDMINE_MCP_READ_ONLY: 'true' }, { REDMINE_MCP_TOOLS_DENY_PATTERN: '^updateIssue$' }]) {
      const restricted = await connect(env);
      const { tools } = await restricted.listTools();
      assert.ok(!tools.some(x => x.name === 'updateIssue'));
    }
  });
});