/**
 * Tests — MCP Client Manager
 */

const assert = require('assert');
let passed = 0;
let failed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try { fn(); passed++; console.log(`  ✅ ${name}`); }
  catch (err) { failed++; console.log(`  ❌ ${name}: ${err.message}`); }
}
function assertEqual(a, b, msg = '') { if (a !== b) throw new Error(`${msg}: Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
function assertOk(v, msg = '') { if (!v) throw new Error(`${msg}: Expected truthy, got ${JSON.stringify(v)}`); }

const {
  MCPClientManager, MCPServer, mcpClient,
  TransportType, ServerStatus, ToolPermission,
} = require('../core/services/mcpClient.js');

// Reset singleton state between tests
function freshManager() { return new MCPClientManager(); }

console.log('\n── MCP Server ──');

test('MCPServer creates with defaults', () => {
  const s = new MCPServer({ name: 'test' });
  assertOk(s.id);
  assertEqual(s.name, 'test');
  assertEqual(s.status, ServerStatus.DISCONNECTED);
  assertEqual(s.tools.length, 0);
});

test('MCPServer rate limit works', () => {
  const s = new MCPServer({ name: 'test', requestsPerMinute: 2 });
  assertOk(s.checkRateLimit());
  assertOk(s.checkRateLimit());
  assertEqual(s.checkRateLimit(), false, 'Should be rate limited');
});

test('MCPServer permission check', () => {
  const s = new MCPServer({
    name: 'test',
    toolPermissions: { dangerous_tool: ToolPermission.DENY },
  });
  assertOk(s.isToolAllowed('safe_tool'));
  assertEqual(s.isToolAllowed('dangerous_tool'), false);
});

test('MCPServer records metrics', () => {
  const s = new MCPServer({ name: 'test' });
  s.recordCall(true, 100);
  s.recordCall(true, 200);
  s.recordCall(false, 50);
  assertEqual(s.metrics.totalCalls, 3);
  assertEqual(s.metrics.successCalls, 2);
  assertEqual(s.metrics.failureCalls, 1);
  assertEqual(s.metrics.avgLatencyMs, 116.66666666666667);
});

test('MCPServer toJSON', () => {
  const s = new MCPServer({ name: 'test', url: 'http://localhost:3000' });
  const json = s.toJSON();
  assertOk(json.id);
  assertEqual(json.name, 'test');
  assertEqual(json.url, 'http://localhost:3000');
  assertEqual(json.status, 'disconnected');
});

console.log('\n── MCP Client Manager ──');

test('Add and remove server', () => {
  const mgr = new MCPClientManager();
  const s = mgr.addServer({ name: 'my-server' });
  assertOk(s.id);
  assertOk(mgr.servers.has(s.id));
  mgr.removeServer(s.id);
  assertEqual(mgr.servers.has(s.id), false);
});

test('Connect server (simulated)', async () => {
  const mgr = new MCPClientManager();
  const s = mgr.addServer({ name: 'test-server' });
  const result = await mgr.connectServer(s.id);
  assertOk(result.success);
  assertEqual(s.status, ServerStatus.CONNECTED);
});

test('Register tools on server', () => {
  const mgr = new MCPClientManager();
  const s = mgr.addServer({ name: 'test' });
  mgr.registerTools(s.id, [
    { name: 'my_tool', description: 'A test tool', inputSchema: { type: 'object', properties: {} } },
    { name: 'other_tool', description: 'Another tool' },
  ]);
  assertOk(mgr.tools.has('mcp.my_tool'));
  assertOk(mgr.tools.has('mcp.other_tool'));
  assertEqual(s.tools.length, 2);
});

test('Call tool with permission', async () => {
  const mgr = new MCPClientManager();
  const s = mgr.addServer({ name: 'test', defaultPermission: ToolPermission.ALLOW });
  await mgr.connectServer(s.id);
  mgr.registerTools(s.id, [{ name: 'hello', description: 'Say hello' }]);
  const result = await mgr.callTool('hello', { name: 'World' });
  assertOk(result.success);
  assertOk(result.result);
  assertOk(typeof result.latencyMs === 'number');
});

test('Call tool with denied permission', async () => {
  const mgr = new MCPClientManager();
  const s = mgr.addServer({
    name: 'test',
    toolPermissions: { secret_tool: ToolPermission.DENY },
  });
  await mgr.connectServer(s.id);
  mgr.registerTools(s.id, [{ name: 'secret_tool' }]);
  const result = await mgr.callTool('secret_tool', {});
  assertEqual(result.success, false);
  assertOk(result.error.includes('Permission denied'));
});

test('Call tool that does not exist', async () => {
  const mgr = new MCPClientManager();
  const result = await mgr.callTool('nonexistent', {});
  assertEqual(result.success, false);
  assertOk(result.error.includes('not found'));
});

test('getToolsAsOpenAIFormat', () => {
  const mgr = new MCPClientManager();
  const s = mgr.addServer({ name: 'test' });
  mgr.registerTools(s.id, [{ name: 'search', description: 'Search stuff', inputSchema: { type: 'object' } }]);
  // Must connect first — only connected servers' tools are exposed
  mgr.connectServer(s.id);
  const tools = mgr.getToolsAsOpenAIFormat();
  assertEqual(tools.length, 1);
  assertEqual(tools[0].type, 'function');
  assertOk(tools[0].function.description.includes('[MCP:test]'));
  assertOk(tools[0]._mcp);
});

test('getToolsForRuntime', () => {
  const mgr = new MCPClientManager();
  const s = mgr.addServer({ name: 'test' });
  mgr.registerTools(s.id, [{ name: 'tool_a' }, { name: 'tool_b' }]);
  mgr.connectServer(s.id);
  const names = mgr.getToolsForRuntime();
  assertOk(names.includes('tool_a'));
  assertOk(names.includes('tool_b'));
});

test('getStatus returns complete info', () => {
  const mgr = new MCPClientManager();
  mgr.addServer({ name: 's1' });
  mgr.addServer({ name: 's2' });
  const status = mgr.getStatus();
  assertEqual(status.serverCount, 2);
  assertOk(Array.isArray(status.servers));
});

test('Audit log tracks calls', async () => {
  const mgr = new MCPClientManager();
  const s = mgr.addServer({ name: 'test' });
  await mgr.connectServer(s.id);
  mgr.registerTools(s.id, [{ name: 'log_tool' }]);
  await mgr.callTool('log_tool', {});
  await mgr.callTool('nonexistent', {});
  const audit = mgr.getAuditLog();
  assertOk(audit.length >= 2);
  assertOk(audit.some(e => e.action === 'success'));
  assertOk(audit.some(e => e.action === 'error'));
});

test('Disconnect server', async () => {
  const mgr = new MCPClientManager();
  const s = mgr.addServer({ name: 'test' });
  await mgr.connectServer(s.id);
  assertEqual(s.status, ServerStatus.CONNECTED);
  mgr.disconnectServer(s.id);
  assertEqual(s.status, ServerStatus.DISCONNECTED);
});

test('Connect non-existent server throws', async () => {
  const mgr = new MCPClientManager();
  try {
    await mgr.connectServer('fake-id');
    assertOk(false, 'Should have thrown');
  } catch (err) {
    assertOk(err.message.includes('not found'));
  }
});

// ═══════════════════════════════════════════════════════════════

console.log(`\n══════════════════════════════════════════════════════════════`);
console.log(`  MCP Tests — ${passed}/${total} passed, ${failed} failed`);
console.log(`══════════════════════════════════════════════════════════════\n`);

if (failed > 0) process.exit(1);
