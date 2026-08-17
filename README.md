# MQTTape

**Capture, inspect, and replay MQTT traffic.**

MQTTape is an open-source MQTT debugging client for desktop and the web. It keeps
the immediacy of the original Chrome-based MQTT tools while adding a searchable
message timeline and portable capture files.

## Current features

- MQTT 3.1.1 and MQTT 5.0
- MQTT over TCP, TLS, WebSocket, and secure WebSocket on desktop
- Web Lite build for `ws://` and `wss://` brokers
- QoS 0, 1, and 2 publish/subscribe
- Retained messages, clean sessions, and automatic reconnect
- Searchable inbound/outbound message timeline
- Session-derived topic tree with hierarchy, traffic counts, and latest payloads
- Retained-value snapshot that recognizes empty retained-message tombstones
- Automatic Text, formatted JSON, and offset/ASCII Hex payload inspection
- Binary payload detection plus lossless raw-payload downloads
- Session statistics and binary-safe Base64 capture storage
- Trim captures by direction, topic or payload, and time range before export
- Export sanitized MQTTape capture files without passwords or local TLS paths
- Preview captures before replay, select message directions, and control speed
- Save reusable local replay presets for directions, speed, and topic remapping
- Safely remap a complete topic prefix with a before/after preview
- Pause, resume, or cancel a replay while preserving recorded ordering
- Saved broker profiles with encrypted desktop secrets
- Custom CA and client certificate/key selection for desktop mTLS
- Switchable English and Traditional Chinese interfaces with a saved local preference
- Background update checks and downloads for installed Windows and supported Linux builds
- Portable Windows build plus installers for Windows, macOS, and Linux

> MQTTape is a client, not a broker. Connect it to Mosquitto, EMQX, HiveMQ, or
> another MQTT broker you control. Do not send secrets to public test brokers.

## Desktop and Web Lite

| Capability | Desktop | Web Lite |
| --- | ---: | ---: |
| MQTT TCP (`mqtt://`) | Yes | No |
| MQTT TLS (`mqtts://`) | Yes | No |
| WebSocket (`ws://`) | Yes | Yes |
| Secure WebSocket (`wss://`) | Yes | Yes |
| Local capture export/replay | Yes | Yes |
| Saved connection profiles | Encrypted secrets | No stored secrets |
| Custom CA and mTLS | Yes | No |
| Automatic application updates | Supported packages | Browser-managed |

Browsers cannot open arbitrary TCP sockets, so Web Lite intentionally limits the
protocol selector to WebSocket transports.

Web Lite is published at <https://nickyclin.github.io/MQTTape/>. Because GitHub
Pages uses HTTPS, remote brokers must normally expose a trusted `wss://` endpoint;
browsers block insecure `ws://` connections from an HTTPS page.

## Profiles and mTLS

Desktop profiles are stored in the Electron user-data directory. Passwords and
private-key passphrases are encrypted with the operating system through Electron
`safeStorage`; MQTTape never falls back to plaintext secret storage. Web Lite can
save non-secret connection settings in browser storage but intentionally drops
passwords and certificate paths.

TLS files must be selected with MQTTape's file picker. A client certificate and
private key must be configured together, while a custom CA is optional. Capture
exports omit passwords, passphrases, and every local certificate path.

## Automatic updates

The Windows `Setup` installer and supported Linux packages check GitHub Releases
after launch and every six hours. Updates download in the background; once ready,
choose **Restart to update** in the header. A downloaded update is also applied on
a normal application exit.

The Windows portable executable cannot safely replace itself, so it links to the
latest manual download. Unsigned macOS builds also remain manual until code
signing is configured. Builds released before automatic updating was introduced
need one final manual installation of a newer `Setup` package; later releases can
update in place without uninstalling first.

## Development

Requirements:

- Node.js 20 or newer
- npm 10 or newer

```bash
npm install
npm run dev
```

Run Web Lite only:

```bash
npm run dev:web
```

For local Web Lite testing, start the included ephemeral broker in another
terminal and connect with MQTT 3.1.1 to `ws://127.0.0.1:9001/mqtt`:

```bash
npm run broker:dev
```

Quality checks:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run build:web
```

Create a local desktop package:

```bash
npm run package
```

Unsigned downloads may trigger Windows SmartScreen or macOS Gatekeeper. See the
release notes for platform-specific installation guidance.

## Capture format

Capture files are versioned JSON documents with the format identifier
`mqttape-capture`. Connection passwords are never included. Payloads are stored
as Base64 so binary data can be replayed without loss.

The replay preview defaults to outgoing messages only. Incoming messages can be
included explicitly, and retained-message counts are shown before publishing.
Replay preserves message order and relative delays, offers 0.25x through 4x
speed, and can be paused or cancelled. Each delay is capped at two seconds and
the complete timing window is compressed to at most 30 seconds, preventing an
old capture from unexpectedly waiting for hours.

Topic prefix remapping can redirect a capture away from production topics before
replay. MQTTape replaces only complete prefix boundaries, previews the changed
topics, and blocks empty, wildcard, null-character, or oversized publish topics.

## Topic Explorer

The Topics view groups traffic observed during the current session into an MQTT
topic hierarchy. Each level shows aggregate incoming/outgoing counts, the latest
payload, and retained state. Clicking a topic opens its matching timeline.

The retained panel is intentionally a **session-derived snapshot**, not a full
broker inventory: MQTT has no standard command for enumerating every topic on a
broker. MQTTape adds retained values it observes or publishes and removes them
when it sees an empty retained publish (the MQTT retained-message tombstone).

## Payload Inspector

Expand any timeline message to inspect the original payload bytes. MQTTape opens
valid JSON in a formatted JSON view, printable UTF-8 as text, and binary data as
an offset/ASCII Hex dump. Text, JSON, and Hex remain available as applicable so
the same payload can be compared without leaving the timeline.

The **Raw** action downloads the exact bytes stored in `payloadBase64`; it does
not re-encode the decoded text. Large on-screen previews are limited to the first
256 KB to keep the UI responsive, while the raw download retains the complete
payload. Imported captures are rejected when Base64 is malformed or its decoded
length does not match the recorded byte size.

## Security

- Electron renderer processes have no Node.js integration.
- MQTT operations run behind a narrow, context-isolated preload API.
- Broker passwords remain in memory and are excluded from capture exports.
- Saved desktop secrets use operating-system-backed encryption with no plaintext fallback.
- TLS files are restricted to paths explicitly selected by the user or loaded from a profile.
- TLS certificate verification is enabled by default.

Please report vulnerabilities according to [SECURITY.md](SECURITY.md).

## Roadmap

- CBOR, Protobuf, and Sparkplug B payload viewers
- MQTT 5 properties and QoS packet-flow inspection
- Multiple simultaneous broker sessions
- Last Will, custom WebSocket headers, and advanced authentication
- Signed installers and additional CPU architectures

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Commit
subjects use Traditional Chinese and the Conventional Commit structure used by
this project.

## License

[MIT](LICENSE) © 2026 NickYCLin
