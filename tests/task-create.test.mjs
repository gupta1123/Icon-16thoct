import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTaskCreatePayload } from '../lib/task-create.ts';

const task = {
  taskTitle: ' Actual complaint title ',
  taskDesciption: ' Complaint description ',
  taskType: 'complaint',
  dueDate: '2026-11-05T00:00:00',
  assignedToId: 2,
  assignedById: 10000,
  storeId: 16994,
  status: 'Assigned',
  priority: 'high',
};

test('store complaint payload retains the title, uses the backend description key, and excludes display fields', () => {
  const payload = buildTaskCreatePayload({
    ...task,
    assignedToName: 'Employee',
    storeName: 'Dealer',
    category: 'Complaint',
    taskDescription: 'UI-only alias',
  });
  assert.deepEqual(payload, {
    taskTitle: 'Actual complaint title',
    taskDesciption: 'Complaint description',
    taskType: 'complaint',
    dueDate: '2026-11-05',
    assignedToId: 2,
    assignedById: 10000,
    storeId: 16994,
    status: 'Assigned',
    priority: 'high',
  });
});

test('requirements retain their type and visit complaints and requirements keep their visit association', () => {
  const requirement = buildTaskCreatePayload({ ...task, taskType: 'requirement', taskTitle: ' Need steel ' });
  assert.equal(requirement.taskTitle, 'Need steel');
  assert.equal(requirement.taskType, 'requirement');
  assert.ok(!('visitId' in requirement));
  for (const taskType of ['complaint', 'requirement']) {
    const payload = buildTaskCreatePayload({ ...task, taskType, visitId: 42 });
    assert.equal(payload.visitId, 42);
    assert.equal(payload.taskType, taskType);
    assert.equal(payload.taskDesciption, 'Complaint description');
  }
});

test('blank titles and invalid record associations never produce create payloads', () => {
  assert.throws(() => buildTaskCreatePayload({ ...task, taskTitle: '  ' }), /title/);
  for (const field of ['assignedToId', 'assignedById', 'storeId', 'visitId']) {
    for (const value of [0, -1, NaN, Infinity, 1.5]) {
      assert.throws(() => buildTaskCreatePayload({ ...task, [field]: value }));
    }
  }
});

test('missing or invalid dates and categories are blocked before a create request', () => {
  for (const dueDate of ['', '2026-02-30', 'invalid']) {
    assert.throws(() => buildTaskCreatePayload({ ...task, dueDate }), /due date/);
  }
  assert.throws(() => buildTaskCreatePayload({ ...task, priority: '' }), /type/);
});
