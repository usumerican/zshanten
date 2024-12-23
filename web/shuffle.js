export function randomInt(n) {
  return Math.floor(Math.random() * n);
}

export function shuffleArray(arr, randomIntFn = randomInt) {
  for (let i = arr.length; i > 1; ) {
    const r = randomIntFn(i--);
    [arr[i], arr[r]] = [arr[r], arr[i]];
  }
  return arr;
}

export function sampleArray(arr, len, randomIntFn = randomInt) {
  if (len >= arr.length) {
    return shuffleArray(arr, randomIntFn);
  }
  for (let i = 0; i < len; i++) {
    const r = i + randomIntFn(arr.length - i);
    [arr[i], arr[r]] = [arr[r], arr[i]];
  }
  arr.length = len;
  return arr;
}
