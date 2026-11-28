// Prints the API's current record of a Word as JSON: node tsx dup-record.ts <id>
import { apiFromEnv } from '../tools/content/src/api';
const api = apiFromEnv((l) => console.error(l));
if (api === undefined) process.exit(1);
const rec = await api.admin.content.record({ editionId: 'uk', kind: 'word', id: process.argv[2] ?? '' });
console.log(JSON.stringify(rec));
