import { expect, test } from 'vitest';
import { sampleArray, shuffleArray } from '../shuffle';

test('shuffleArray', () => {
  const arr = [3, 1, 4, 1, 5];
  let count = 0;
  expect(shuffleArray(arr, () => (count++, 0))).toEqual(arr);
  expect(arr).toEqual([1, 4, 1, 5, 3]);
  expect(count).toEqual(4);
});

test('sampleArray', () => {
  const arr = [3, 1, 4, 1, 5];
  let count = 0;
  expect(sampleArray(arr, 4, () => (count++, 1))).toEqual(arr);
  expect(arr).toEqual([1, 4, 1, 5]);
  expect(count).toEqual(4);
});
