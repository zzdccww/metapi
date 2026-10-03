import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, normalize, sep } from 'node:path';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import ts from 'typescript';

// Exercise the production callbacks with the installed plugin, without starting DBs or schedulers.
const source = await readFile('src/server/index.ts', 'utf8');
const ast = ts.createSourceFile('index.ts', source, ts.ScriptTarget.Latest, true);
let headers;
let fallback;
function visit(node) {
  if (ts.isPropertyAssignment(node) && node.name.getText(ast) === 'setHeaders') {
    headers = node.initializer.getText(ast);
  }
  if (ts.isCallExpression(node) && node.expression.getText(ast) === 'app.setNotFoundHandler') {
    fallback = node.arguments[0].getText(ast);
  }
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(headers && fallback, 'Production callbacks must be present');
function compileCallback(code) {
  const compiled = ts.transpileModule(`const callback = ${code}`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  return new Function('normalize', 'sep', `${compiled}; return callback;`)(normalize, sep);
}
const dir = await mkdtemp(join(tmpdir(), 'metapi-static-regression-'));
const app = Fastify();
try {
  await mkdir(join(dir, 'assets'));
  await writeFile(join(dir, 'index.html'), '<html>static-regression</html>');
  await writeFile(join(dir, 'assets', 'app.js'), 'console.log("asset");');
  await writeFile(join(dir, 'favicon.png'), 'test-icon');
  await app.register(fastifyStatic, {
    root: dir, prefix: '/', wildcard: false, setHeaders: compileCallback(headers),
  });
  app.setNotFoundHandler(compileCallback(fallback));
  const checks = [];
  for (const url of ['/', '/index.html', '/dashboard', '/favicon.ico']) {
    const response = await app.inject({ method: 'GET', url });
    assert.equal(response.statusCode, 200, url);
    assert.equal(response.headers['cache-control'], 'no-cache', url);
    assert.match(response.body, /static-regression/, url);
    checks.push(`${url}: 200, no-cache`);
  }
  const asset = await app.inject('/assets/app.js');
  assert.equal(asset.statusCode, 200);
  assert.equal(asset.headers['cache-control'], 'public, max-age=31536000, immutable');
  checks.push('/assets/app.js: 200, immutable');
  const icon = await app.inject('/favicon.png');
  assert.equal(icon.statusCode, 200);
  assert.equal(icon.body, 'test-icon');
  checks.push('/favicon.png: 200');
  for (const url of ['/api/nonexistent', '/v1/nonexistent']) {
    const response = await app.inject(url);
    assert.equal(response.statusCode, 404, url);
    assert.deepEqual(response.json(), { error: 'Not found' });
    checks.push(`${url}: 404 JSON`);
  }
  console.log(JSON.stringify({ result: 'PASS', node: process.version, checks }, null, 2));
} finally {
  await app.close();
  await rm(dir, { recursive: true, force: true });
}
