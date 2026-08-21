# Changelog

All notable changes to MQTTape are documented in this file.

## [Unreleased]

### Added

- Native x64 and ARM64 release packages for Windows, macOS, and Linux using GitHub-hosted architecture-specific runners.
- A SignPath activation and verification runbook for safely wiring Windows signing after the OSS application is approved.
- Architecture-neutral CBOR packaging that uses the existing pure-JavaScript decoder without rebuilding or shipping the optional `cbor-extract` native accelerator.
- Desktop WebSocket handshake authentication with HTTP Basic, Bearer tokens, and validated custom headers, plus URL query parameters in both desktop and Web Lite.
- OS-encrypted desktop profile storage for WebSocket authentication values, Web Lite secret omission, and capture/status privacy guards.
- Up to eight simultaneous, tabbed Broker sessions with isolated MQTT clients, subscriptions, captures, packet flows, replay state, and background unread counts.
- Broker-scoped LoRaWAN downlink history plus live profile-list synchronization between open sessions.
- MQTT Last Will configuration for UTF-8, Hex, and Base64 payloads, QoS, Retain, and MQTT 5 Will Delay, Message Expiry, Content Type, and Payload Format properties.
- Encrypted desktop-profile storage for Last Will payloads, Web Lite payload omission, and capture-file privacy exclusion.
- Protobuf schema-bundle import, explicit message-type selection, CSP-safe wire decoding, local schema persistence, unknown-field diagnostics, and type-preserving trees.
- Automatic Sparkplug B topic recognition with the official Eclipse Tahu Payload schema, topic metadata, Metric summaries, and complete payload trees.
- CBOR and CBOR Sequence payload inspection with Content-Type detection, guarded heuristic detection, type-preserving trees, and bounded previews.
- Session-only QoS 0/1/2 packet-flow inspection with TX/RX direction, Packet ID, DUP retransmission, MQTT 5 Reason Code, duration, and pending-handshake diagnostics.
- Local LoRaWAN downlink history that retains up to 1,000 parsed events across restarts without storing raw MQTT payloads or broker credentials.
- Versioned downlink-history JSON export plus an in-app action to clear saved events.
- Playwright UI smoke tests for Web Lite language and downlink-history flows plus the Electron preload bridge.
- MQTT 5 Publish Properties capture and inspection in both the desktop app and Web Lite, including duplicate User Properties and binary Correlation Data.
- Protocol-specific port guidance that distinguishes registered MQTT TCP ports from common Broker WebSocket defaults.
- MQTT 5 Publish Properties editor and lossless replay for publish-safe metadata in both the desktop app and Web Lite.
- MQTT 3.1.1 compatibility guards plus replay omission of connection-scoped Topic Alias and Broker-issued Subscription Identifier metadata.

### Changed

- ARM64 packages use explicit manual downloads until per-architecture updater metadata is available, preventing cross-architecture automatic updates.

### Fixed

- Closing a session tab while its connection was still starting no longer leaks a hidden MQTT client or permanently occupies one of the eight session slots.
- Failed connection attempts — missing TLS files, TLS files on a non-TLS protocol, or an invalid Last Will in Web Lite — now end in an error state instead of leaving the session stuck on "Connecting".
- An orphaned client from a failed or superseded connection no longer pushes its errors into the session's live status.
- Quitting the desktop app now waits for MQTT DISCONNECT packets to flush, so brokers no longer publish every session's Last Will on normal exit.
- Unread tab badges keep counting after a background session's 5,000-message buffer fills.
- The message buffer now also caps retained payload bytes, so a stream of large payloads cannot exhaust renderer memory.
- Typing a broker host no longer forks the LoRaWAN downlink history into per-keystroke storage entries; the history now follows the connected endpoint or the selected profile.
- Clearing the downlink history now persists across view switches and app restarts instead of silently re-importing the cleared events.
- Two sessions watching the same broker no longer overwrite each other's stored downlink events.
- Removing a WebSocket header or query-parameter row no longer moves keyboard focus and input state onto the row below it.
- Importing a Protobuf schema in one open inspector is no longer wiped when another inspector with a stale list saves.
- A completed replay now shows a green state badge instead of a neutral one.
- Apple Silicon macOS builds now explain manual updates with the unsigned-macOS reason instead of claiming the architecture is unsupported.
- Message re-renders no longer cascade through every open session's hidden workspace.

## [0.11.0] - 2026-08-17

### Added

- Six appearance themes — Midnight, Tape, Magenta, High contrast, Daylight, and Paper — plus a follow-system option.
- Top-bar theme picker with colour swatches, grouped by colour scheme, persisted per device.
- Session-derived LoRaWAN downlink status tracking for The Things Stack and ChirpStack.
- Exact The Things Stack correlation IDs plus ChirpStack `queueItemId` event linking.

### Changed

- Rebuilt the interface on a single design-token system covering colour, type, spacing, and radius.
- Raised the base type scale from 8–10 px to 11–20 px and reserved the monospace face for MQTT data.
- Replaced the statistics cards, session toolbar, message rows, and dialogs with a shared component layer.
- Redrew the application icon, favicon, and brand mark so the cassette reads as a cassette rather than a face, and matched them to the accent palette.
- Corrected misleading action icons: replay, disconnect, update checks, and the LoRaWAN downlink builder no longer borrow icons from unrelated actions.
- Rewrote the project README in Traditional Chinese and documented downlink feedback subscriptions and correlation limits.

## [0.10.0] - 2026-08-17

### Added

- Guided The Things Stack and ChirpStack LoRaWAN MQTT downlink builder.
- UTF-8, Hex, Base64, and decoded-JSON input with exact topic and envelope previews.
- Platform-aware identifier, FPort, payload, and non-retained publish safeguards.

## [0.9.0] - 2026-08-17

### Added

- Automatic LoRaWAN uplink recognition for The Things Stack and ChirpStack JSON events.
- Device, application, frame, data-rate, frequency, RSSI, and SNR inspection.
- Embedded Base64 frame previews and lossless raw LoRaWAN frame downloads.

## [0.8.0] - 2026-08-17

### Added

- Background update checks, downloads, progress, and restart-to-install controls for supported desktop packages.
- GitHub Release metadata and differential-update artifacts for `electron-updater`.

## [0.7.0] - 2026-08-17

### Added

- Runtime interface switching between English and Traditional Chinese with a persisted local preference.

## [0.6.0] - 2026-08-17

### Added

- Reusable local replay presets for message directions, speed, and topic-prefix remapping.

## [0.5.0] - 2026-08-17

### Added

- Capture trimming by message direction, topic or payload query, and inclusive time range.
- Export previews with selected message counts, payload size, retained counts, and sample topics.

### Changed

- Updated the Electron, test, lint, and TypeScript type-definition toolchain.
- Major Dependabot updates now remain isolated for explicit compatibility review.

### Fixed

- Web Lite development mode now loads Vite-injected styles without weakening production CSP.

## [0.4.0] - 2026-08-15

### Added

- Automatic empty, JSON, text, and binary payload classification.
- Text, formatted JSON, and offset/ASCII Hex views in the message timeline.
- Lossless raw-payload downloads with topic- and timestamp-derived filenames.
- 256 KB display limits for large payloads while preserving complete downloads.
- TCP and WebSocket integration coverage for binary payload byte preservation.
- Weekly Dependabot updates for GitHub Actions.

### Changed

- Binary timeline previews now use a clear placeholder instead of decoded noise.
- Capture validation rejects malformed Base64 and mismatched payload byte sizes.
- GitHub workflows now use Node 24-based action majors for CI, Pages, and releases.
- Release notes no longer contain version-specific text from an older release.

## [0.3.0] - 2026-08-14

### Added

- Session-derived Topic Explorer with hierarchical topic navigation.
- Incoming/outgoing traffic counts, latest payloads, and natural topic sorting.
- Retained-value snapshots with empty retained-message tombstone handling.
- Replay topic-prefix remapping with before/after previews and changed-message counts.
- Shared MQTT publish-topic validation for normal publishes and replay plans.
- Unit and real-broker coverage for topic trees, remapping, and retained deletion.

### Changed

- Topic rows and retained cards can open the corresponding filtered timeline.
- Replay blocks invalid remapped destinations before publishing any message.

## [0.2.0] - 2026-08-14

### Added

- Capture preview with incoming/outgoing selection and retained-message warnings.
- Replay speed controls plus pause, resume, cancel, and live progress.
- Saved desktop broker profiles with operating-system-backed secret encryption.
- Non-secret Web Lite profiles stored locally in the browser.
- Desktop custom CA and mTLS client certificate/private-key selection.
- MQTT 5, WebSocket, QoS 2, retained-message, unsubscribe, and reconnect tests.
- Automated GitHub Pages deployment for Web Lite.
- Intel and Apple Silicon macOS release packages.
- SHA-256 checksum files for GitHub Release assets.

### Security

- TLS file access is restricted to files selected through MQTTape or trusted profiles.
- Capture exports remove passwords, private-key passphrases, and TLS file paths.
- Secrets are never written as plaintext when operating-system encryption is unavailable.

## [0.1.0] - 2026-08-14

### Added

- Initial Electron and Web Lite MQTT client.
- TCP, TLS, WebSocket, MQTT 3.1.1/5.0, QoS 0/1/2, and retained publishing.
- Searchable message timeline, JSON formatting, capture export, and replay.
- Cross-platform packaging, CI, and automated GitHub Releases.

[Unreleased]: https://github.com/NickYCLin/MQTTape/compare/v0.11.0...HEAD
[0.11.0]: https://github.com/NickYCLin/MQTTape/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/NickYCLin/MQTTape/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/NickYCLin/MQTTape/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/NickYCLin/MQTTape/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/NickYCLin/MQTTape/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/NickYCLin/MQTTape/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/NickYCLin/MQTTape/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/NickYCLin/MQTTape/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/NickYCLin/MQTTape/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/NickYCLin/MQTTape/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/NickYCLin/MQTTape/releases/tag/v0.1.0
