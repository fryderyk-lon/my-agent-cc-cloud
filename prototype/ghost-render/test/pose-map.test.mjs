// The renderer turns each ring about the model's eye axis (+X in the STL frame, pointing at the viewer;
// +Y is the viewer's right, +Z is up). These tests pin the direction rule to screen motion.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ringRotationX } from '../src/pose-map.js';

// Rotate the top point (0, 0, 1) about +X by `angle` and return where it lands on screen.
const topAfter = angle => ({ right: -Math.sin(angle), up: Math.cos(angle) });

test('a positive ringFront moves the top of the front ring to the right (clockwise)', () => {
  const p = topAfter(ringRotationX({ ringFront: 30 }).front);
  assert.ok(p.right > 0.49 && p.up > 0.8, JSON.stringify(p));
});

test('a positive ringBack moves the top of the back ring to the left (counter-clockwise)', () => {
  const p = topAfter(ringRotationX({ ringBack: 30 }).back);
  assert.ok(p.right < -0.49 && p.up > 0.8, JSON.stringify(p));
});

test('missing ring angles mean no rotation', () => {
  assert.deepEqual(ringRotationX({}), { front: -0, back: 0 });
});
