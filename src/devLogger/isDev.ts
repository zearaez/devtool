export function isDev(): boolean {
  // `__DEV__` exists in React Native, but not in plain Node/Jest environments.

  return typeof __DEV__ !== 'undefined' ? __DEV__ : false;
}
