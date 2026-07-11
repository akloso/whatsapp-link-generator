import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const filePath = 'icr-intelligence-dashboard.html';
const expected = {
  sha256: '9b5b80b6f3687c16dc6c17b40faba28e862cf1a14317fd8423101e0538040bde',
  byteSize: 130639,
  newlineCount: 506,
  endsWithNewline: true,
  logicalSplitlinesCount: 506,
};

const bytes = readFileSync(filePath);
const text = bytes.toString('utf8');
const actual = {
  sha256: createHash('sha256').update(bytes).digest('hex'),
  byteSize: bytes.byteLength,
  newlineCount: bytes.reduce((count, byte) => count + (byte === 0x0a ? 1 : 0), 0),
  endsWithNewline: bytes.at(-1) === 0x0a,
  logicalSplitlinesCount: text.endsWith('\n') ? text.split('\n').length - 1 : text.split('\n').length,
};

const failures = Object.entries(expected).filter(([key, value]) => actual[key] !== value);

if (failures.length > 0) {
  console.error(`ICR prototype verification failed for ${filePath}:`);
  for (const [key, value] of failures) {
    console.error(`- ${key}: expected ${value}, received ${actual[key]}`);
  }
  process.exit(1);
}

console.log(
  `ICR prototype verified: sha256=${actual.sha256}, bytes=${actual.byteSize}, newlines=${actual.newlineCount}, splitlines=${actual.logicalSplitlinesCount}, endsWithNewline=${actual.endsWithNewline}`,
);
