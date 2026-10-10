// Export numeric JSON weights without requiring browser JSON-module support.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const source = fs.readFileSync(new URL('../../spades-web/play-policy-model.json',import.meta.url),'utf8');
JSON.parse(source);
const hash = createHash('sha256').update(source).digest('hex');
fs.writeFileSync(new URL('../../spades-web/play-model.js',import.meta.url),`// Generated from frozen play-policy-model.json; SHA256 ${hash}.\nexport const PLAY_MODEL = ${source.trim()};\n`);
console.log(`Exported checkpoint ${hash}`);
