# Oh My Ink - Live AI Tattoo Experience 部署與現場操作

## 已交付的應用程式

專案使用 Expo Router、React Native、TypeScript 行動應用程式；同一套介面亦能在 iPad Safari 作為 Web App 使用。開發環境的 Metro／Web 固定使用 8081，Express API 使用 3000。iPad 支援橫向，手機支援直向；原生安裝檔需另行建置（例如 EAS Build），預覽成功不代表已有 APK 或 TestFlight 成品。

視覺沿用 Oh My Ink 官網的黑色、黃色 #F6CC11、Oswald 凝縮標題及 Cormorant Garamond 斜體。最新版本以紋身師即場手繪為主，風格顯示為 Fine Line、Bold Outline、Simple Shapes、Flowing Lines；使用目錄中的 Fine Line Tulip、Heart with Arrow、Heart-shaped Clip、Ribbon 作為簡單線條參考。已移除曼陀羅及繁複裝飾；靈感目錄精選 12 個簡單圖案。生成指示要求少量清晰輪廓線，但實際線條仍由紋身師確認，不保證固定繪製時間。完整保密 PDF 不在程式碼包內。Web 操作以 `docs/WEB-APP-GUIDE.md` 為準。

## 本機開發

以 `pnpm dev` 啟動後，在瀏覽器開啟 Web 介面。此版本使用 Expo Print 及 FileSystem；真正的 AirPrint 操作需要在實體 iPad 上確認。

伺服器環境變數見 `.env.example`：`DATABASE_URL` 及圖片服務設定（`AI_API_KEY`、`AI_BASE_URL`、`AI_IMAGE_MODEL` 等）。不需要在前端放圖片 API key。原生版本使用公開的 `EXPO_PUBLIC_API_BASE_URL` 連到 HTTPS 後端；正式建置前務必設為已部署且能由裝置存取的 API 位址，不要把開發預覽地址當作永久後端。

在專案目錄執行：

```bash
corepack enable
corepack prepare pnpm@9.12.0 --activate
pnpm install --frozen-lockfile
pnpm db:push
pnpm dev
```

`db:push` 會依 Drizzle migration 建立／同步 `users`、`stencil_jobs`、`stencil_options`。不要把這個命令視為可以隨意清空正式資料。此任務已執行初始 migration。只有 schema 有新增或有未套用 migration 時才需要再次執行。

原生正式版本可自行建置 Android APK/AAB 或 iOS/TestFlight。實際 iOS 發行仍需要相應的 Apple／Expo 簽署及發行設定；此交付包含原始碼與設定，沒有宣稱已產生或上架安裝檔。

## 正式 Web／API 部署

專案提供 `Dockerfile`：建置 Expo Web 靜態頁與後端，再由同一個 3000 連接埠提供介面及 `/api/*`。健康檢查是 `GET /api/health`。要讓活動 iPad 使用穩定地址，請部署此映像並開啟正式 HTTPS 地址。

獨立主機可使用以下流程：

```bash
cp .env.example .env
# 使用你的伺服器端服務憑證與 MySQL DSN 填寫 .env；不要把 .env 提交到 Git。
pnpm install --frozen-lockfile
pnpm db:push

docker build -t ohmyink-stencil .
docker run --env-file .env -p 3000:3000 ohmyink-stencil
```

`.env.example` 列出所需變數。部署需要圖片服務 API key 及 MySQL 資料庫。請在反向代理配置 HTTPS，並讓原生建置的公開 API 地址指向該 HTTPS 網址。Web 容器預設使用同源 `/api`，不需要額外的公開 API 地址。


## iPad 現場流程

1. 讓 iPad 與支援 AirPrint 的印表機連到同一 Wi-Fi；若热感轉印機沒有 AirPrint，需由供應商提供可列印的橋接／驅動方案。雲端伺服器不能直接看到你現場的區網印表機。
2. 在 Safari 開啟正式 Web 地址。可從「分享」選單選擇「加入主畫面」建立快速入口；此版本不提供離線 AI，生成仍需網路。
3. 在 Settings 設定作品寬度：40、60、80 或 100 mm。預設 60 mm。影像保持原生解析度及長寬比，實際驅動縮放以試印為準。
4. 輸入主題、選擇四種風格之一，以及三種媒材之一，按「✨ Generate My Tattoo Stencil」。進度畫面顯示生成、清理與鏡像準備；不要重複按提交。
5. 預覽四個已鏡像黑白轉印作品。可用「View original」查看未鏡像、保留媒材顏色的原始藝術作品；不論目前顯示哪種預覽，「Select & Print」始終使用已鏡像的純黑白 PNG。
6. 按「Select & Print」後，選擇系統列印介面的印表機並確認 Print。應用程式顯示「Sending to Printer... Please see your artist!」。Web 只能知道已開啟列印對話框，無法判斷使用者按了取消還是列印，也不能證實紙張已印出；iOS 原生版本可辨識取消／系統提交，但仍由刺青師確認實體結果。

所有轉印 PNG 已自動水平鏡像一次。**關閉印表機或驅動的再次鏡像設定**，避免雙重鏡像。列印後由刺青師檢查細線、文字方向、尺寸及轉印位置。Jagua／Two-Tone 的顏色只在原始 artwork 保留；熱感轉印圖一律純黑白，不能把轉印圖當作彩色成品。

## 工作流程設定與 API

`workflows/stencil.config.json` 說明目前併發、四象限拆圖、閾值及鏡像處理順序。實際處理預設在 `server/stencils/imageProcessor.ts`：`STENCIL_THRESHOLD` 預設 180，`STENCIL_MIN_COMPONENT_PIXELS` 預設 3，可透過伺服器環境變數調整；線條閾值範圍 0–255，最小元件大小範圍 1–10000。JSON 是流程描述，修改它本身不會覆蓋這些執行參數。調整後請重啟／部署後端。鏡像步驟不要移除或在前端重做。

`POST /api/stencils` 接收 `concept`、`style`、`medium`、`clientId`，以及可選 `requestId`／`capabilityToken`，回傳 202 及 `{id, token}`。App 會先在裝置保存用安全亂數產生的 256-bit token 及 requestId，再送出請求。如果送出後回覆遺失，可用相同 requestId／token 重送來找回原任務；後端驗證 token 雜湊，不會重複生成，也不會向無憑證者重新發出秘密。重新開啟 App 時也會提示恢復未完成提交。

`GET /api/stencils/:id?token=...` 取得狀態及四個選項。圖檔端點也需要相同 capability token。這些 token 是客人作品的存取憑證，不要分享或放入公開日誌。裝置的 My designs 保存任務與 token，清除裝置歷史會失去本機存取，不會刪除伺服器的圖檔。

後端保留使用者要求的五行精確 compiled prompt，另追加 2×2 版面指示及品牌参考指示。圖片模型生成一張含四個独立作品的 sheet，後端按原始解析度拆成四象限，分別保存原圖、二值化／去雜訊／水平鏡像 PNG，以及可用時由 potrace 產生的真正 SVG。PNG 本身是點陣圖，SVG 才是向量檔；300 DPI 是輸出標記，不會憑空增加模型原始細節。

## 可靠性與重試界線

此版本使用單一 API process 的工作佇列，process 內總併發為 2，每個 client 最多 2 個 active 任務。任務狀態及已完成作品永久保存在資料庫／物件儲存；重新部署不會清空完成作品。此設定不是多實例共享的全域付費限流，也不是獨立耐久 worker，活動前請維持單一 worker instance。

單一 worker 啟動時，在接受 HTTP 請求前將上一個 process 遺留的 generating／processing 任務標成明確失敗，再重排 queued 任務。不能繼續的模型生成不會自動重新付費呼叫；客人可看見失敗並明確選擇重新生成。這個啟動恢復方法不適合新舊 instance 同時處理工作的多實例／滾動部署；活動正式環境請先停舊 worker，或改用具租約的耐久 worker 系統。

生成付費請求不會自動重試，以免網路不確定時產生重複生成。相同 clientId/requestId 不會重複建立任務。失敗狀態提供明確重新生成的動作；有網路中斷而任務已存在時，應優先回到 My designs 重新連線查詢，避免建立另一份作品。

若需大型活動的無人值守、多實例自動擴縮或斷線不中斷生成，正式上線前應改為獨立耐久佇列與具租約／心跳的 worker，並配置操作員授權、服務用量限制及監控。本交付沒有把 process 內佇列宣稱為這些基礎設施。

## 可重現檢查

```bash
pnpm check
pnpm test
pnpm build
npx expo export --platform web --output-dir web-build
curl http://127.0.0.1:3000/api/health
```

`scripts/verify-runtime.mjs` 會透過真實 API 建立一個新生成任務、等候四個結果、讀回 PNG 並確認純黑白像素。它**會產生一次真實 AI 生成**，不要當作每次健康檢查反覆執行。

來源目錄：`app/` 畫面與導覽、`components/studio-*` 表單／預覽／品牌介面、`lib/stencil-*` 裝置歷史及 Web／原生列印、`server/stencils/` 提示詞／模型／圖像／任務 API、`drizzle/` 資料表與 migration、`assets/catalog/` 授權品牌參考、`workflows/` 後端流程描述。
