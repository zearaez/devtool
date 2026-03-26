# @zearaez/devtool

A react native plugin for network logs

## Installation


```sh
npm install @zearaez/devtool
```


## Usage


```js
import { DevLogger } from '@zearaez/devtool';
```

## DevLogger (network monitoring, dev only)

```tsx
import { DevLogger } from '@zearaez/devtool';

export default function App() {
  // Optional: customize bounds / persistence / axios patching in dev.
  // DevLogger is dev-guarded, so this is safe to call unconditionally.
  DevLogger.init({
    maxLogs: 200,
    maxBodyBytes: 20_000,
    interceptAxios: false,
  });

  return (
    <>
      {/* ... */}
      <DevLogger.UI />
    </>
  );
}
```

`DevLogger` auto-initializes and monkey-patches `fetch`/`XMLHttpRequest` in React Native `__DEV__` builds.

Key options:
- `maxLogs`: bounded number of captured network calls (ring-buffer).
- `maxBodyBytes`: maximum request/response body bytes stored (truncates).
- `interceptAxios` + `axios`: optional Axios interception (only when explicitly enabled).
- `persistence`: optional persistence adapter (dev-only) if you want to reload logs after reloads.


## Contributing

- [Development workflow](CONTRIBUTING.md#development-workflow)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)
- [Code of conduct](CODE_OF_CONDUCT.md)

## License

MIT

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
