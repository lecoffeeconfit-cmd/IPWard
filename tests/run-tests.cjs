const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'ipward-service-tests-'));
try {
  const roots = ['src/types/index.ts', 'src/data/demo.ts', 'src/services/analytics.ts', 'src/services/classifier.ts', 'src/services/capabilities.ts', 'src/services/estimation.ts', 'src/services/capture.ts', 'src/services/storage.ts', 'src/services/appleReport.ts', 'src/services/androidUsageCore.ts', 'src/services/eventStore.types.ts'].map(file => path.join(root, file));
  const program = ts.createProgram(roots, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, moduleResolution: ts.ModuleResolutionKind.Node10, strict: true, skipLibCheck: true, types: [], outDir: out, rootDir: path.join(root, 'src'), noEmitOnError: true, ignoreDeprecations: '6.0' });
  const result = program.emit();
  const diagnostics = [...ts.getPreEmitDiagnostics(program), ...result.diagnostics];
  if (diagnostics.length) {
    console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCanonicalFileName: file => file, getCurrentDirectory: () => root, getNewLine: () => '\n' }));
    process.exitCode = 1;
  } else {
    const result = spawnSync(process.execPath, ['--test', path.join(__dirname, 'services.test.cjs')], { stdio: 'inherit', env: { ...process.env, IPWARD_TEST_BUILD: out } });
    process.exitCode = result.status ?? 1;
  }
} finally { fs.rmSync(out, { recursive: true, force: true }); }
