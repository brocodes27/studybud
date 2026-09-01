import assert from 'node:assert/strict';
import { isStudentRole } from './consumerAccess';

// Students (and legacy accounts with no role recorded) get in.
assert.equal(isStudentRole('student'), true);
assert.equal(isStudentRole('STUDENT'), true);
assert.equal(isStudentRole(' student '), true);
assert.equal(isStudentRole(null), true);
assert.equal(isStudentRole(undefined), true);
assert.equal(isStudentRole(''), true);

// Staff do not.
assert.equal(isStudentRole('teacher'), false);
assert.equal(isStudentRole('Teacher'), false);
assert.equal(isStudentRole('principal'), false);
assert.equal(isStudentRole('org_admin'), false);
assert.equal(isStudentRole('chain_admin'), false);
assert.equal(isStudentRole('chain_head'), false);
assert.equal(isStudentRole('parent'), false);

console.log('consumerAccess: all assertions passed');
