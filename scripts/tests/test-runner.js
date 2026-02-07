const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const TESTS_DIR = path.join(ROOT, 'tests');

const getArg = (name) => {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
};

const app = getArg('--app');
const feature = getArg('--feature');
const strict = process.argv.includes('--strict');

let pattern = 'tests/**/*.test.js';
if (app && feature) pattern = `tests/${app}/${feature}.test.js`;
else if (app) pattern = `tests/${app}/*.test.js`;

const jsonPath = path.join(ROOT, 'logs', 'test-results.json');
try {
  fs.mkdirSync(path.join(ROOT, 'logs'), { recursive: true });
} catch (e) {}

const env = { ...process.env };
if (strict) env.TEST_STRICT = 'true';

const args = ['--test', pattern, '--test-reporter', 'tap'];
const res = spawnSync(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'], env });

const raw = res.stdout.toString();
fs.writeFileSync(jsonPath, raw, 'utf8');

// Parser le format TAP
const lines = raw.split(/\r?\n/);
const events = [];

for (const line of lines) {
  // Parser les lignes de test TAP
  const testMatch = line.match(/^ok\s+\d+\s+-\s+(.+)$/);
  if (testMatch) {
    events.push({
      type: 'test:pass',
      data: {
        name: testMatch[1].trim(),
        file: null // Sera déterminé plus tard
      }
    });
  }
  
  // Parser les durées
  const durationMatch = line.match(/^\s+duration_ms:\s+(.+)$/);
  if (durationMatch && events.length > 0) {
    const lastEvent = events[events.length - 1];
    if (lastEvent && lastEvent.data) {
      lastEvent.data.duration = parseFloat(durationMatch[1]);
    }
  }
  
  // Parser le résumé final
  const summaryMatch = line.match(/^# (tests|pass|fail|cancelled|skipped|todo)\s+(\d+)$/);
  if (summaryMatch) {
    const key = summaryMatch[1];
    const value = parseInt(summaryMatch[2]);
    
    let summaryEvent = events.find(e => e.type === 'test:summary');
    if (!summaryEvent) {
      summaryEvent = { type: 'test:summary', data: {} };
      events.push(summaryEvent);
    }
    
    switch (key) {
      case 'tests': summaryEvent.data.total = value; break;
      case 'pass': summaryEvent.data.passed = value; break;
      case 'fail': summaryEvent.data.failed = value; break;
      case 'cancelled': summaryEvent.data.cancelled = value; break;
      case 'skipped': summaryEvent.data.skipped = value; break;
      case 'todo': summaryEvent.data.todo = value; break;
    }
  }
  
  // Parser la durée totale
  const totalDurationMatch = line.match(/^# duration_ms\s+(.+)$/);
  if (totalDurationMatch) {
    let summaryEvent = events.find(e => e.type === 'test:summary');
    if (!summaryEvent) {
      summaryEvent = { type: 'test:summary', data: {} };
      events.push(summaryEvent);
    }
    summaryEvent.data.duration = parseFloat(totalDurationMatch[1]);
  }
}

const summaryEvent = [...events].reverse().find((e) => e.type === 'test:summary');
if (!summaryEvent) {
  // Si pas de summary, on essaie de créer un résumé manuel
  const passEvents = events.filter(e => e.type === 'test:pass');
  const failEvents = events.filter(e => e.type === 'test:fail');
  const skipEvents = events.filter(e => e.type === 'test:skip');
  
  const mockSummary = {
    type: 'test:summary',
    data: {
      passed: passEvents.length,
      failed: failEvents.length,
      skipped: skipEvents.length,
      todo: 0,
      duration: events.reduce((sum, e) => sum + (e.data?.duration || 0), 0)
    }
  };
  
  // Utiliser le mock summary
  events.push(mockSummary);
}

const stats = (summaryEvent || events[events.length - 1]).data;
const pass = stats.passed || 0;
const fail = stats.failed || 0;
const skipped = stats.skipped || 0;
const todo = stats.todo || 0;
const durationMs = stats.duration || 0;

const color = (code, text) => `\x1b[${code}m${text}\x1b[0m`;
const bg = (code, text) => `\x1b[${code}m${text}\x1b[0m`;

const title = bg('46;97', ' 🧪 DRY API TEST REPORT ');
const ok = color('92', '✅ PASS');
const ko = color('91', '❌ FAIL');
const warn = color('93', '⚠️  SKIP');
const info = color('96', 'ℹ️  INFO');
const success = color('42;97', ' SUCCESS ');
const error = color('41;97', ' ERROR ');
const warning = color('43;97', ' WARNING ');

const buildTestNameMap = () => {
  const map = {};
  if (!fs.existsSync(TESTS_DIR)) return map;

  const entries = fs.readdirSync(TESTS_DIR);
  entries.forEach((entry) => {
    const dir = path.join(TESTS_DIR, entry);
    if (!fs.statSync(dir).isDirectory()) return;
    if (entry.startsWith('_') || entry === 'validation') return;

    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.test.js'));
    files.forEach((file) => {
      const fullPath = path.join(dir, file);
      const content = fs.readFileSync(fullPath, 'utf8');

      const appMatch = content.match(/const\s+APP\s*=\s*'([^']+)'/);
      const testMatch = content.match(/test\('([^']+)'/);

      if (appMatch && testMatch) {
        const appName = appMatch[1];
        const testName = testMatch[1];
        map[testName] = appName;
      }
    });
  });

  return map;
};

const testNameToApp = buildTestNameMap();

const getAppFromName = (name) => {
  if (!name) return 'unknown';
  if (testNameToApp[name]) return testNameToApp[name];
  return 'unknown';
};

const getFeatureFromName = (name) => {
  if (!name) return null;
  const m = name.match(/^CRUD\s+(.+?)\s*\(/i);
  if (!m) return null;
  return m[1].trim();
};

const appStats = {};
const featureStats = {};
const appFeatureStats = {};

for (const ev of events) {
  if (!ev || !ev.type || !ev.data) continue;
  const isPass = ev.type === 'test:pass';
  const isFail = ev.type === 'test:fail';
  const isSkip = ev.type === 'test:skip';
  if (!isPass && !isFail && !isSkip) continue;

  const app = getAppFromName(ev.data.name);
  if (!appStats[app]) appStats[app] = { pass: 0, fail: 0, skip: 0 };
  if (isPass) appStats[app].pass += 1;
  if (isFail) appStats[app].fail += 1;
  if (isSkip) appStats[app].skip += 1;

  const feature = getFeatureFromName(ev.data.name);
  if (feature) {
    if (!featureStats[feature]) featureStats[feature] = { pass: 0, fail: 0, skip: 0 };
    if (isPass) featureStats[feature].pass += 1;
    if (isFail) featureStats[feature].fail += 1;
    if (isSkip) featureStats[feature].skip += 1;

    if (!appFeatureStats[app]) appFeatureStats[app] = {};
    if (!appFeatureStats[app][feature]) appFeatureStats[app][feature] = { pass: 0, fail: 0, skip: 0 };
    if (isPass) appFeatureStats[app][feature].pass += 1;
    if (isFail) appFeatureStats[app][feature].fail += 1;
    if (isSkip) appFeatureStats[app][feature].skip += 1;
  }
}

const renderTable = (rows, header) => {
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => String(r[i]).length)));
  const line = (cells) =>
    cells
      .map((c, i) => String(c).padEnd(widths[i], ' '))
      .join(' │ ');
  
  const separator = widths.map((w) => '─'.repeat(w)).join('─┼─');
  const headerLine = widths.map((w) => '═'.repeat(w)).join('═╪═');
  
  console.log(color('96', `┌─${separator}─┐`));
  console.log(color('96', `│ ${line(header)} │`));
  console.log(color('96', `╞═${headerLine}═╡`));
  rows.forEach((r) => console.log(`│ ${line(r)} │`));
  console.log(color('96', `└─${separator}─┘`));
};

console.log('');
console.log(title);
console.log(color('96', '╭─────────────────────────────────────────────────────╮'));
console.log(color('96', '│                     📊 STATISTICS                 │'));
console.log(color('96', '╰─────────────────────────────────────────────────────╯'));
console.log(`${info} 📁 Pattern: ${pattern}`);
console.log(`${info} 🔧 Strict:  ${strict ? 'ON' : 'OFF'}`);
console.log(color('96', '─────────────────────────────────────────────────────'));

const totalTests = pass + fail + skipped;
const passRate = totalTests > 0 ? ((pass / totalTests) * 100).toFixed(1) : '0.0';
const status = fail === 0 ? success : (fail > 0 ? error : warning);

console.log(`${status} Test Status: ${fail === 0 ? 'ALL TESTS PASSED' : `${fail} TEST(S) FAILED`}`);
console.log(`${ok} ✅ Passed:  ${pass} (${passRate}%)`);
console.log(`${ko} ❌ Failed:  ${fail}`);
console.log(`${warn} ⚠️  Skipped: ${skipped}`);
console.log(`${info} 📝 Todo:    ${todo}`);
console.log(`${info} ⏱️  Time:    ${(durationMs / 1000).toFixed(2)}s`);
console.log(color('96', '─────────────────────────────────────────────────────'));

// Tableau par application
const appRows = Object.keys(appStats)
  .sort()
  .map((app) => {
    const s = appStats[app];
    const total = s.pass + s.fail + s.skip;
    const rate = total > 0 ? ((s.pass / total) * 100).toFixed(0) : '0';
    return [
      `📱 ${app}`,
      color('92', String(s.pass)),
      color('91', String(s.fail)),
      color('93', String(s.skip)),
      `${rate}%`
    ];
  });

if (appRows.length) {
  console.log(color('96', '\n╭─────────────────────────────────────────────────────╮'));
  console.log(color('96', '│                   📱 RESULTS BY APP                │'));
  console.log(color('96', '╰─────────────────────────────────────────────────────╯'));
  renderTable(appRows, ['Application', 'Reussite', 'Echec', 'Ignore', 'Taux']);
}

// Resume par feature
const featureRows = Object.keys(featureStats)
  .sort()
  .map((feature) => {
    const s = featureStats[feature];
    const total = s.pass + s.fail + s.skip;
    const rate = total > 0 ? ((s.pass / total) * 100).toFixed(0) : '0';
    return [
      `⚙️ ${feature}`,
      color('92', String(s.pass)),
      color('91', String(s.fail)),
      color('93', String(s.skip)),
      `${rate}%`
    ];
  });

if (featureRows.length) {
  console.log(color('96', '\n╭─────────────────────────────────────────────────────╮'));
  console.log(color('96', '│                   ⚙️ RESULTS BY FEATURE              │'));
  console.log(color('96', '╰─────────────────────────────────────────────────────╯'));
  renderTable(featureRows, ['Fonction', 'Reussite', 'Echec', 'Ignore', 'Taux']);
}

// Features par application
const appsOrdered = Object.keys(appFeatureStats).sort();
appsOrdered.forEach((app) => {
  const features = appFeatureStats[app] || {};
  const rows = Object.keys(features)
    .sort()
    .map((feature) => {
      const s = features[feature];
      const total = s.pass + s.fail + s.skip;
      const rate = total > 0 ? ((s.pass / total) * 100).toFixed(0) : '0';
      return [
        `⚙️ ${feature}`,
        color('92', String(s.pass)),
        color('91', String(s.fail)),
        color('93', String(s.skip)),
        `${rate}%`
      ];
    });

  if (rows.length) {
    console.log(color('96', '\n╭─────────────────────────────────────────────────────╮'));
    console.log(color('96', `│         ⚙️ FEATURES FOR APP: ${app.padEnd(18, ' ')}│`));
    console.log(color('96', '╰─────────────────────────────────────────────────────╯'));
    renderTable(rows, ['Fonction', 'Reussite', 'Echec', 'Ignore', 'Taux']);
  }
});

// Footer
console.log(color('96', '─────────────────────────────────────────────────────'));
const timestamp = new Date().toLocaleString('fr-FR', { 
  weekday: 'short', 
  year: 'numeric', 
  month: 'short', 
  day: 'numeric', 
  hour: '2-digit', 
  minute: '2-digit', 
  second: '2-digit' 
});
console.log(`${info} 🕐 Generated: ${timestamp}`);
console.log(color('96', '─────────────────────────────────────────────────────'));

if (fail > 0) {
  console.log(`\n${error} 🚨 TESTS FAILED - Exit code 1`);
  process.exit(1);
} else {
  console.log(`\n${success} 🎉 ALL TESTS PASSED SUCCESSFULLY!`);
}
