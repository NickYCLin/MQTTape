# MQTTape

**擷取、檢視並重播 MQTT 流量。**

MQTTape 是一套可在桌面與瀏覽器使用的開源 MQTT 除錯工具。它保留早期 Chrome MQTT 工具即開即用的便利性，並加入可搜尋的訊息時間軸、Topic 樹、可攜式擷取檔及 LoRaWAN 輔助功能。

## 目前功能

- 支援 MQTT 3.1.1 與 MQTT 5.0
- 桌面版支援 MQTT over TCP、TLS、WebSocket 與 Secure WebSocket
- Web Lite 支援 `ws://` 與 `wss://` Broker
- 支援 QoS 0、1、2 的發布與訂閱
- 支援 Retained Message、Clean Session 與自動重新連線
- 可搜尋傳入與傳出訊息的時間軸
- 依工作階段建立 Topic 階層、流量統計及最新 Payload
- Retained Value 快照，並能辨識空白 Retained Message Tombstone
- 自動以文字、格式化 JSON、Hex Offset／ASCII 檢視 Payload
- 偵測二進位 Payload，並可無損下載原始資料
- 自動辨識 The Things Stack 與 ChirpStack LoRaWAN Uplink
- 顯示 LoRaWAN 裝置、訊框、頻率、Data Rate、RSSI 與 SNR 摘要
- 解碼 LoRaWAN Base64 訊框，並可無損下載原始訊框
- 引導式 The Things Stack 與 ChirpStack MQTT Downlink 建立器
- 追蹤 Downlink 的提出、排入佇列、送出、裝置確認、未確認及失敗狀態
- 工作階段統計與以 Base64 儲存的二進位安全擷取格式
- 匯出前可依方向、Topic／Payload 及時間範圍裁切擷取內容
- 匯出不含密碼或本機 TLS 路徑的 MQTTape 擷取檔
- 重播前可預覽擷取內容、選擇訊息方向並控制速度
- 可儲存重播方向、速度與 Topic Remap 的本機預設
- 以變更前後預覽安全替換完整 Topic Prefix
- 重播期間可暫停、繼續或取消，並維持原始訊息順序
- 桌面版 Broker 設定檔會以作業系統加密機制保存秘密
- 桌面版支援自訂 CA 與 Client Certificate／Key 的 mTLS
- 可切換英文與繁體中文介面，並在本機記住偏好
- 已安裝的 Windows 與支援的 Linux 套件可在背景檢查及下載更新
- 提供 Windows 免安裝版，以及 Windows、macOS、Linux 安裝套件
- 提供跟隨系統、Midnight、Tape、Magenta、高對比、Daylight 與 Paper 外觀主題

> MQTTape 是 MQTT Client，不是 Broker。請將它連線至你管理的 Mosquitto、EMQX、HiveMQ 或其他 MQTT Broker；不要把帳號、密碼或敏感資料送到公開測試 Broker。

## 桌面版與 Web Lite

| 功能 | 桌面版 | Web Lite |
| --- | ---: | ---: |
| MQTT TCP（`mqtt://`） | 支援 | 不支援 |
| MQTT TLS（`mqtts://`） | 支援 | 不支援 |
| WebSocket（`ws://`） | 支援 | 支援 |
| Secure WebSocket（`wss://`） | 支援 | 支援 |
| 本機擷取匯出／重播 | 支援 | 支援 |
| 儲存連線設定檔 | 秘密會加密 | 不儲存秘密 |
| 自訂 CA 與 mTLS | 支援 | 不支援 |
| 應用程式自動更新 | 支援的安裝套件 | 由瀏覽器處理 |

瀏覽器無法開啟任意 TCP Socket，因此 Web Lite 的通訊協定選單只提供 WebSocket Transport。

Web Lite 發布於 <https://nickyclin.github.io/MQTTape/>。由於 GitHub Pages 使用 HTTPS，遠端 Broker 通常必須提供具有受信任憑證的 `wss://` Endpoint；瀏覽器會阻擋 HTTPS 頁面連線至不安全的 `ws://`。

## LoRaWAN MQTT

MQTTape 連接的是 LoRaWAN 平台的 MQTT 介面，不會直接接收 LoRa 無線電訊號。當 Uplink 符合 [The Things Stack](https://www.thethingsindustries.com/docs/integrations/data-formats/) 或 [ChirpStack](https://www.chirpstack.io/docs/chirpstack/integrations/events/) 的官方 JSON Envelope 時，Payload Inspector 會自動顯示裝置識別資料、FPort、Frame Counter、頻率、Data Rate、Gateway RSSI／SNR、已解碼的應用資料與內嵌二進位訊框。

常見 Uplink 訂閱 Topic：

```text
The Things Stack: v3/<application-id>/devices/+/up
ChirpStack:      application/<application-id>/device/+/event/up
```

Broker Host、認證資料、Tenant 後綴與 Topic 結構可能因部署方式而不同，請以 LoRaWAN Network Operator 提供的值為準。

引導式 Downlink 建立器遵循 [The Things Stack MQTT](https://www.thethingsindustries.com/docs/integrations/other-integrations/mqtt/) 與 [ChirpStack MQTT](https://www.chirpstack.io/docs/chirpstack/integrations/mqtt.html) 的預設格式。你可以輸入 UTF-8 文字、Hex 位元組、Base64 或已解碼 JSON；MQTTape 會先產生並顯示平台 Topic 與 JSON Envelope，再讓你發布。Downlink 命令一律使用非 Retained MQTT Message；自訂伺服器 Topic Template 仍可使用一般發布工具送出。

### Downlink 狀態追蹤

在「Downlinks」頁籤中，MQTTape 會整理實際觀察到的 Downlink 要求與平台回報，並將最多 1,000 筆解析後事件保存在這台裝置，讓要求與後續 ACK 可以跨程式重啟繼續關聯。請同時訂閱狀態 Topic：

```text
The Things Stack: v3/<application-id>/devices/+/down/#
ChirpStack:      application/<application-id>/device/+/event/+
```

- The Things Stack：MQTTape 建立的命令會加入唯一 `correlation_ids`，用來精確關聯 `queued`、`sent`、`ack`、`nack` 與 `failed`。
- ChirpStack：`txack` 與 `ack` 會以 `queueItemId` 精確關聯；由於原始 MQTT Downlink 命令不含平台產生的 Queue Item ID，首次把命令連到 `txack` 時只能依同一裝置的事件順序推定，畫面會明確標示。
- 本機歷史只包含解析後的狀態中繼資料，不會保存原始 MQTT Payload 或 Broker 憑證；可以隨時在 Downlinks 頁籤匯出版本化 JSON 或清除。
- 狀態追蹤只使用 MQTTape 實際看見的訊息，不會查詢 LoRaWAN 平台的完整佇列，也不會在缺少回報事件時自行判定無線傳送成功。

匯出的 Downlink 歷史格式識別碼為 `mqttape-downlink-history`、版本為 `1`。它適合保存與檢查狀態事件，但不包含可重新發布的完整 Downlink Payload；需要無損重播時仍應使用 MQTTape 擷取檔。

## 下載

請從 [GitHub Releases](https://github.com/NickYCLin/MQTTape/releases/latest) 下載最新版桌面套件與 Checksum Manifest。Windows 使用者可選擇 `Setup` 安裝程式以使用應用程式自動更新，或選擇需要手動更新的 Portable 執行檔。

## 程式碼簽章政策

免費程式碼簽章由 [SignPath.io](https://about.signpath.io/) 提供，憑證由 [SignPath Foundation](https://signpath.org/) 提供。

- Committer 與 Reviewer：[NickYCLin](https://github.com/NickYCLin)
- Approver：[NickYCLin](https://github.com/NickYCLin)
- 每次 Release 的簽章要求都必須由 Approver 手動核准
- 隱私權政策：[PRIVACY.md](PRIVACY.md)

在 SignPath 申請與簽章流程完成之前發布的 Windows 套件仍未簽章。執行前請先使用 Release 中的 Checksum Manifest 驗證下載檔案。

## 設定檔與 mTLS

桌面版設定檔會存放在 Electron User Data 目錄。密碼與 Private Key Passphrase 會透過 Electron `safeStorage` 使用作業系統加密；MQTTape 不會退回以純文字儲存秘密。Web Lite 可以保存非敏感的連線設定，但會刻意捨棄密碼與憑證路徑。

TLS 檔案必須使用 MQTTape 的檔案選擇器指定。Client Certificate 與 Private Key 必須成對設定，自訂 CA 則可選填。擷取匯出不會包含密碼、Passphrase 或任何本機憑證路徑。

## 自動更新

Windows `Setup` 安裝版與支援的 Linux 套件會在啟動後及每六小時檢查 GitHub Releases。更新會在背景下載；準備完成後，可在標題列選擇「重新啟動以更新」。若正常關閉程式，已下載的更新也會在結束時套用。

Windows Portable 執行檔無法安全地自行取代，因此只會連到最新版手動下載頁。未簽章的 macOS Build 在設定程式碼簽章前也維持手動更新。若目前安裝的是導入自動更新之前的版本，需要最後一次手動安裝新版 `Setup`；之後即可直接更新，不必先解除安裝。

## 開發

環境需求：

- Node.js 20 以上
- npm 10 以上

```bash
npm install
npm run dev
```

只啟動 Web Lite：

```bash
npm run dev:web
```

若要在本機測試 Web Lite，可在另一個 Terminal 啟動內附的暫時性 Broker，接著以 MQTT 3.1.1 連線至 `ws://127.0.0.1:9001/mqtt`：

```bash
npm run broker:dev
```

品質檢查：

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
npm run build:web
```

`npm run test:e2e` 會建立桌面版與 Web Lite，接著以 Chromium 驗證 Web Lite 啟動、語系保存、Downlink 歷史匯出／清除，以及 Electron 限制型 Preload Bridge。第一次執行前若本機尚未安裝測試瀏覽器，請先執行 `npx playwright install chromium`。

建立本機桌面套件：

```bash
npm run package
```

未簽章的下載檔可能觸發 Windows SmartScreen 或 macOS Gatekeeper，請參考各版本的 Release Notes。

## 擷取格式

擷取檔是版本化 JSON 文件，格式識別碼為 `mqttape-capture`，且永遠不包含連線密碼。Payload 以 Base64 儲存，因此二進位資料也能無損重播。

重播預覽預設只選擇傳出訊息；你可以明確加入傳入訊息，並在發布前查看 Retained Message 數量。重播會維持訊息順序與相對延遲，提供 0.25x 到 4x 速度，且可暫停或取消。每段延遲最多兩秒，完整時序則壓縮在 30 秒內，避免舊擷取檔意外等待數小時。

Topic Prefix Remap 可以在重播前把擷取內容從 Production Topic 導向其他環境。MQTTape 只替換完整 Prefix Boundary，會預覽變更結果，並阻擋空白、包含萬用字元、Null Character 或超過長度限制的發布 Topic。

## Topic 檢視器

「Topics」頁籤會把本次工作階段觀察到的流量整理成 MQTT Topic 階層。每一層會顯示傳入／傳出數量、最新 Payload 與 Retained 狀態；點選 Topic 可開啟對應的時間軸訊息。

Retained 面板是刻意設計成「依工作階段產生的快照」，不是 Broker 的完整清單，因為 MQTT 沒有列出 Broker 所有 Topic 的標準指令。MQTTape 會加入它觀察或發布的 Retained Value，也會在看見空白 Retained Publish（MQTT Retained Message Tombstone）時移除該值。

## Payload Inspector

展開時間軸訊息即可檢視原始 Payload 位元組。MQTTape 會把有效 JSON 顯示成格式化 JSON、可列印 UTF-8 顯示成文字、二進位資料顯示成 Offset／ASCII Hex Dump；適用時也可在文字、JSON 與 Hex 間切換比較。

「Raw」會下載 `payloadBase64` 中儲存的原始位元組，不會重新編碼已解碼文字。為維持介面流暢，大型 Payload 的畫面預覽最多顯示前 256 KB，但原始下載仍保留完整資料。若匯入擷取檔的 Base64 格式錯誤，或解碼後長度與記錄的 Byte Size 不符，MQTTape 會拒絕匯入。

## 安全性

- Electron Renderer 不啟用 Node.js Integration
- MQTT 操作只能透過範圍受限且啟用 Context Isolation 的 Preload API
- Broker 密碼只保留在記憶體，且不會寫入擷取匯出
- 桌面版秘密使用作業系統支援的加密，不提供純文字備援
- TLS 檔案只能使用使用者明確選擇，或從設定檔載入的路徑
- 預設啟用 TLS 憑證驗證

若要回報安全性問題，請依照 [SECURITY.md](SECURITY.md) 說明處理。

## Roadmap

- CBOR、Protobuf 與 Sparkplug B Payload Viewer
- MQTT 5 Properties 與 QoS Packet Flow 檢視
- 同時連線多個 Broker 工作階段
- Last Will、自訂 WebSocket Header 與進階認證
- 已簽章安裝程式與更多 CPU 架構

## 參與貢獻

提出 Pull Request 前請先閱讀 [CONTRIBUTING.md](CONTRIBUTING.md)。Commit Subject 使用繁體中文，並遵循本專案的 Conventional Commits 格式。

## 授權

[MIT](LICENSE) © 2026 NickYCLin
