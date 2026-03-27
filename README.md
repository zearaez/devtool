# @zearaez/devtool

Development-only React Native network + console logger with a floating bubble UI.

## Installation

```sh
npm install @zearaez/devtool
```
OR
```sh
yarn add @zearaez/devtool
```

## Basic setup

`DevLogger` auto-initializes in React Native `__DEV__` builds and patches `fetch`/`XMLHttpRequest` (and console logging). In production builds it’s a no-op.

### 1) Mount the UI

```tsx
import { DevLogger } from '@zearaez/devtool';

export default function App() {
  return (
    <>
      {/* ... */}
      <DevLogger.UI />
    </>
  );
}
```

### 2) Configure (optional)

Call `DevLogger.init(options?)` to override defaults (safe to call unconditionally).

```ts
import { DevLogger } from '@zearaez/devtool';

DevLogger.init({
  maxLogs: 200,
  maxBodyBytes: 20_000,

  // Optional: enable Axios interception
  // interceptAxios: true,
  // axios,
});
```

---

## Configuration reference

### Defaults

- **Limits**
  - `maxLogs`: `200`
  - `maxBodyBytes`: `20000`
  - `maxHeaders`: `50`
- **Interceptors**
  - `interceptFetch`: `true`
  - `interceptXhr`: `true`
  - `interceptAxios`: `false` (if `true`, also provide `axios`)
- **Capture**
  - `captureRequestHeaders`: `true`
  - `captureResponseHeaders`: `true`
  - `captureRequestBody`: `true`
  - `captureResponseBody`: `true`
- **Redaction (recommended)**
  - `redactHeaders`: `['authorization','cookie','set-cookie','x-api-key']`
  - `redactQueryParams`: `['access_token','token','auth','api_key','apikey']`
  - `redactBodyPatterns`: `[]`
- **Persistence (optional)**
  - `persistence`: `undefined`
  - `persistenceDebounceMs`: `500`

### Common recipes

#### Disable redaction (allow everything)

```ts
DevLogger.init({
  redactHeaders: [],
  redactQueryParams: [],
  redactBodyPatterns: [],
});
```

#### Reduce captured data (safer)

```ts
DevLogger.init({
  captureRequestHeaders: false,
  captureResponseHeaders: false,
  captureRequestBody: false,
  captureResponseBody: false,
});
```

---

## Security note

Even in dev, logs can include sensitive data (tokens/cookies/PII). Keep redaction enabled and disable body/header capture when needed—especially if you enable persistence.

## Contributing

- [Development workflow](CONTRIBUTING.md#development-workflow)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)
- [Code of conduct](CODE_OF_CONDUCT.md)

## License

MIT

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
