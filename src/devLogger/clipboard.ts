import Devtool from '../NativeDevtool';

export const clipboard = {
  setString(text: string): void {
    try {
      Devtool.setClipboardString(text);
    } catch {
      // If the native module isn't linked (or not available), ignore in dev tool.
    }
  },
};
