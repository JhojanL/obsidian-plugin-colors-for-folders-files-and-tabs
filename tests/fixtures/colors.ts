import type { ColorResolver } from '../../src/adapters/contracts';
import { resolveColorIdentity } from '../../src/model/resolve';
import { readSettings } from '../../src/model/settings';

export const projectsSettings = readSettings({
	schemaVersion: 1,
	palette: [{ id: 'purple', name: 'Purple', seed: '#8b6cef' }],
	assignments: { Projects: 'purple' },
}).settings;

/** Resolve target using the real model and explicit synthetic assignments for adapter regressions. */
export const resolveTestColor: ColorResolver = (target) =>
	resolveColorIdentity(projectsSettings, target);
