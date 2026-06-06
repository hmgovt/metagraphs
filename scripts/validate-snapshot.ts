/**
 * Validates static/network.json against static/network.schema.json
 * using ajv (draft 2020-12 + format extensions). Exits non-zero on a
 * schema-invalid snapshot so the workflow aborts before committing —
 * better to leave yesterday's snapshot on the data branch than serve a
 * malformed one.
 *
 * Usage: npx tsx scripts/validate-snapshot.ts
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const NETWORK_JSON_PATH = join(ROOT, 'static', 'network.json');
const SCHEMA_PATH = join(ROOT, 'static', 'network.schema.json');

function main(): number {
	console.log('=== validate-snapshot ===');

	if (!existsSync(SCHEMA_PATH)) {
		console.error(`  schema not found at ${SCHEMA_PATH}`);
		return 1;
	}
	if (!existsSync(NETWORK_JSON_PATH)) {
		console.error(`  network.json not found at ${NETWORK_JSON_PATH}`);
		return 1;
	}

	const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf-8'));
	const data = JSON.parse(readFileSync(NETWORK_JSON_PATH, 'utf-8'));

	const ajv = new Ajv2020({ allErrors: true, strict: false });
	addFormats(ajv);
	const validate = ajv.compile(schema);
	const ok = validate(data);

	if (!ok) {
		console.error(`  ✗ network.json failed schema validation:`);
		for (const err of validate.errors ?? []) {
			console.error(`    ${err.instancePath || '/'} ${err.message}`);
		}
		return 1;
	}

	console.log(
		`  ✓ network.json valid: schemaVersion=${data.schemaVersion} epoch=${data.epoch} subnets=${data.subnets.length} stale=${data.stale}`
	);
	return 0;
}

process.exit(main());
