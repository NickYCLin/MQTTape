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
- JSON payload formatting and session statistics
- Export sanitized MQTTape capture files without passwords
- Replay captures with the recorded ordering and bounded timing
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

Browsers cannot open arbitrary TCP sockets, so Web Lite intentionally limits the
protocol selector to WebSocket transports.

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

The initial replay engine preserves message order and relative delays. Each
delay is capped at two seconds and the complete timing window is compressed to
at most 30 seconds, preventing an old capture from unexpectedly waiting for
hours. Replay publishes every captured message to the currently connected
broker; review topics and retained flags before starting it.

## Security

- Electron renderer processes have no Node.js integration.
- MQTT operations run behind a narrow, context-isolated preload API.
- Broker passwords remain in memory and are excluded from capture exports.
- TLS certificate verification is enabled by default.

Please report vulnerabilities according to [SECURITY.md](SECURITY.md).

## Roadmap

- Client certificate selection for mTLS
- Saved broker profiles backed by the operating-system credential vault
- Topic tree and retained-message snapshots
- Capture speed controls, pause/cancel, and topic remapping
- Hex, CBOR, Protobuf, and Sparkplug B payload viewers
- MQTT 5 properties and QoS packet-flow inspection

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Commit
subjects use Traditional Chinese and the Conventional Commit structure used by
this project.

## License

[MIT](LICENSE) © 2026 NickYCLin
