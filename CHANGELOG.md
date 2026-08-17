# Changelog

All notable changes to MQTTape are documented in this file.

## [Unreleased]

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

[Unreleased]: https://github.com/NickYCLin/MQTTape/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/NickYCLin/MQTTape/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/NickYCLin/MQTTape/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/NickYCLin/MQTTape/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/NickYCLin/MQTTape/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/NickYCLin/MQTTape/releases/tag/v0.1.0
