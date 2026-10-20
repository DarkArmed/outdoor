// JS 对象 <-> 源码/JSON 转换 helper，供 emit.py 通过 subprocess 调用。
// 用法：
//   node jsfmt.js parse <data-file>   vm 执行 data 文件，把 PLANS 数组以 JSON 输出
//   node jsfmt.js fmt                 从 stdin 读 JSON 对象，输出 JS 字面量
// 输出风格与 data/*.js 一致：2 空格缩进、单引号、多行结构尾随逗号、中文不转义。
const fs = require('fs');
const vm = require('vm');

const INLINE_MAX = 100;

function quote(s) {
  return "'" + s
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n') + "'";
}

function isScalar(v) {
  return v === null || typeof v !== 'object';
}

function scalar(v) {
  if (v === null) return 'null';
  if (typeof v === 'string') return quote(v);
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return String(v);
  throw new Error('unsupported value type: ' + typeof v);
}

function key(k) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : quote(k);
}

// 短结构（纯标量、长度可控）压成一行，贴近 data/*.js 现有手写风格。
function tryInline(v) {
  if (isScalar(v)) return scalar(v);
  if (Array.isArray(v)) {
    if (!v.length) return '[]';
    if (!v.every(isScalar)) return null;
    const inner = v.map(scalar).join(', ');
    return inner.length <= INLINE_MAX ? '[' + inner + ']' : null;
  }
  const keys = Object.keys(v);
  if (!keys.length) return '{}';
  const parts = [];
  for (const k of keys) {
    if (!isScalar(v[k])) return null;
    parts.push(key(k) + ': ' + scalar(v[k]));
  }
  const inner = parts.join(', ');
  return inner.length <= INLINE_MAX ? '{ ' + inner + ' }' : null;
}

function fmt(v, ind) {
  const inl = tryInline(v);
  if (inl !== null) return inl;
  const pad = '  '.repeat(ind + 1);
  const close = '  '.repeat(ind);
  if (Array.isArray(v)) {
    return '[\n' + v.map((x) => pad + fmt(x, ind + 1) + ',').join('\n') + '\n' + close + ']';
  }
  return '{\n' + Object.keys(v).map((k) => pad + key(k) + ': ' + fmt(v[k], ind + 1) + ',').join('\n') + '\n' + close + '}';
}

function main() {
  const mode = process.argv[2];
  if (mode === 'parse') {
    const file = process.argv[3];
    const ctx = { PLANS: [] };
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
    process.stdout.write(JSON.stringify(ctx.PLANS));
  } else if (mode === 'fmt') {
    const input = fs.readFileSync(0, 'utf8');
    process.stdout.write(fmt(JSON.parse(input), 0));
  } else {
    console.error('usage: node jsfmt.js parse <data-file> | node jsfmt.js fmt < input.json');
    process.exit(2);
  }
}

main();
