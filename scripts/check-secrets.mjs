#!/usr/bin/env node
import { execSync } from 'child_process';

// Matches potential secrets but excludes obvious placeholders:
// - <placeholder> angle-bracket style
// - ${VAR} / $VAR environment variable references
// - SCREAMING_SNAKE_CASE (documentation convention)
// - common safe words: CHANGE_ME, example, your-, test, dummy
const PATTERN =
	/(password\s*[=:]\s*['"]?(?![$<]|[A-Z_]{3,})[^$<\n]{4,}|api[_-]?key\s*[=:]\s*['"]?(?![$<]|[A-Z_]{3,})[^$<\n]{4,}|(client_|app_)?secret\s*[=:]\s*['"]?(?![$<]|[A-Z_]{3,})[^$<\n]{4,}|authorization:\s*(bearer|basic)\s+(?!<)[^\s]{8,}|whsec_[a-z0-9]{10,}|sk-[a-z0-9]{20,}|-----BEGIN (RSA|EC|OPENSSH|DSA|PGP) PRIVATE KEY-----)/i;

let diff;
try {
	diff = execSync('git diff --cached --unified=0 --no-color', { encoding: 'utf8' });
} catch {
	process.exit(0);
}

const matches = diff
	.split('\n')
	.filter((line) => /^\+[^+]/.test(line))
	.filter((line) => PATTERN.test(line));

if (matches.length > 0) {
	console.error('Potential secret detected in staged changes:');
	for (const line of matches) console.error(' ', line.trim());
	console.error('\nRemove or replace with runtime placeholders before committing.');
	process.exit(1);
}
