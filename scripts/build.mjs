#!/usr/bin/env node
/**
 * Build script that runs tsc and vite via Node directly.
 * Bypasses permission issues with node_modules/.bin on Vercel.
 */
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const tscPath = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
const vitePath = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');

console.log('Running TypeScript type check...');
execSync(`node "${tscPath}" -b`, { stdio: 'inherit', cwd: root });

console.log('Running Vite build...');
execSync(`node "${vitePath}" build`, { stdio: 'inherit', cwd: root });
