import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDuration, filterVisitHistory, normalizeVisitTask } from '../lib/visit-detail.ts';

test('history search is case-insensitive, trimmed, and handles missing purposes', () => {
  const visits = [{ id: 1, purpose: 'Monthly Visit' }, { id: 2, purpose: 'Order' }, { id: 3 }];
  assert.deepEqual(filterVisitHistory(visits, ' monthly '), [visits[0]]);
  assert.deepEqual(filterVisitHistory(visits, 'unknown'), []);
  assert.equal(filterVisitHistory(visits, '  '), visits);
});

test('duration handles same-day, overnight, and invalid clock values', () => {
  assert.equal(calculateDuration('09:19:00', '09:20:45'), '1m');
  assert.equal(calculateDuration('23:30:00', '00:45:00'), '1h 15m');
  assert.equal(calculateDuration('09:00', '09:00'), '0m');
  assert.equal(calculateDuration('25:00', '10:00'), 'Duration unavailable');
  assert.equal(calculateDuration('bad', '10:00'), 'Duration unavailable');
});

test('task DTO retains actual descriptions, categories, and assignees', () => {
  const task = normalizeVisitTask({ id: 5, taskTitle: ' Sample ', taskDesciption: 'Delivery', priority: ' HIGH ', assignedToName: 'Employee', storeCity: 'Pune', createdAt: '2026-09-03' }, 'requirement', 10);
  assert.equal(task.id, 5);
  assert.equal(task.title, 'Sample');
  assert.equal(task.description, 'Delivery');
  assert.equal(task.priority, 'high');
  assert.equal(task.assignedTo, 'Employee');
  assert.equal(task.storeCity, 'Pune');
  assert.equal(task.visitId, 10);
});

test('normalized task fields remain intact and missing values are not invented', () => {
  const task = normalizeVisitTask({ id: 2, title: 'Title', description: 'Text', assignedTo: 'Manager', visitId: 3 }, 'complaint', 10);
  assert.equal(task.description, 'Text');
  assert.equal(task.assignedTo, 'Manager');
  assert.equal(task.visitId, 3);
  assert.equal(task.priority, '');
  assert.equal(task.status, '');
});
