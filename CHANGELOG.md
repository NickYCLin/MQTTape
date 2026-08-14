# Changelog

All notable changes to MQTTape are documented in this file.

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

[0.2.0]: https://github.com/NickYCLin/MQTTape/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/NickYCLin/MQTTape/releases/tag/v0.1.0
