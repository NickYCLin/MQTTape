# 貢獻指南

感謝你協助改善 MQTTape。請讓每個 Pull Request 保持單一目的，並在送出前執行：

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
npm run build:web
```

## Commit Message 規範

本專案採用以下格式：

```text
<type>(<scope>): <subject>

<body>

<footer>
```

- `type` 必填，可使用 `feat`、`fix`、`docs`、`style`、`refactor`、`perf`、
  `test`、`chore` 或 `revert`。
- `scope` 選填，用來描述影響範圍，例如 `mqtt`、`ui`、`capture`、`ci`。
- `subject` 必填，使用繁體中文、祈使語氣、50 個字元內，結尾不加句號。
- 標題與內文之間保留一行空白。
- `body` 說明變更的原因與內容（Why / What），每行最多 72 個字元。
- 有對應 Issue 時，在 `footer` 加上 `issue #123`。
- 不相干的異動應拆成不同 Commit。

範例：

```text
feat(mqtt): 新增桌面版 TCP 與 TLS 連線

因瀏覽器無法直接開啟 TCP socket，將桌面版 MQTT 連線移至
Electron 主程序，並透過受限 IPC 提供給操作介面。

調整項目：
1. 支援 MQTT 3.1.1 與 5.0。
2. 加入重新連線與訂閱處理。
3. 避免將 Broker 密碼寫入紀錄檔。
```

規範參考：[Git Commit Message 這樣寫會更好](https://ithelp.ithome.com.tw/articles/10228738)。

## Pull Request

- 說明問題、原因與解法。
- UI 變更請附上畫面。
- 新功能需補上適當測試與 README 說明。
- 不要提交 Broker 密碼、憑證、封包中的個人資料或其他機密資訊。
