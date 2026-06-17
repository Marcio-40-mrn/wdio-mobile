# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# --- Android local (AVD-S24) ---

# Run all tests (app must already be installed)
npm run wdio
npm run wdio:android        # alias explícito de plataforma

# Download latest APK from EAS, install on AVD-S24, then run all tests
npm run wdio:fresh

# Download latest APK from EAS and install on the running AVD (sem rodar testes)
npm run install-apk

# --- iOS local (sessão remota Device Farm) ---
# Requer REMOTE_HOST, REMOTE_PORT, REMOTE_PATH_IOS no .env
# Instale o IPA manualmente na sessão antes de rodar

npm run wdio:ios

# --- Reports ---

# Generate and open Allure report (after local test run)
npm run report:allure

# View CTRF JSON report
npm run report:ctrf
```

There is no lint or build step — TypeScript is compiled on-the-fly by WebdriverIO's ts-node runner (`tsconfig.json` has `noEmit: true`).

To run a single spec file, temporarily edit `wdio.conf.ts` → `specs` to point to the desired file, or pass it via CLI:
```bash
npx wdio run ./wdio.conf.ts --spec ./test/specs/test.spec.ts
```

## Architecture

This is a **WebdriverIO + Appium** mobile end-to-end test suite targeting the app `com.aramis.ecomm` (Aramis e-commerce). Suporta quatro cenários de execução: Android local (AVD-S24), iOS local via Device Farm Remote Access, Android no Device Farm (CI), e iOS no Device Farm (CI).

### Environment Detection

`wdio.conf.ts` usa quatro flags derivadas de variáveis de ambiente:

| Flag | Derivada de | Quando ativa |
|---|---|---|
| `isDeviceFarm` | `DEVICEFARM_DEVICE_UDID` | Injetada automaticamente pelo AWS Device Farm (CI) |
| `isCI` | `CI` | Definida como `true` pelo GitHub Actions |
| `isIOS` | `PLATFORM=ios` | Setada pelo script `wdio:ios` ou `testspec-ios.yml` |
| `isRemote` | `isIOS && REMOTE_HOST` | iOS local conectando ao Device Farm Remote Access |

**Combinações de execução:**

| Cenário | `isDeviceFarm` | `isIOS` | `isRemote` | Comportamento |
|---|---|---|---|---|
| Android local | false | false | false | Appium local, AVD-S24, adb clear |
| iOS local | false | true | true | Conecta REMOTE_HOST:PORT/PATH, bundleId, clearApp |
| CI Android | true | false | false | Device Farm Appium, UiAutomator2, clearApp |
| CI iOS | true | true | false | Device Farm Appium, XCUITest, clearApp |

### Page Object Model

All page objects live in `test/pageobjects/` and extend `BasePage`:

- `BasePage` — shared base with `waitForElement()` (20 s default timeout), `elementVisible()` (assertion helper), `fechaBanner()` (dismisses promotional popup if present), app-launch permission helpers (`iniciaApp`, `ativaGps`, `permiteNotificacao`, `negaNotificacao`, `continua`, `termo1`, `termos2`), and exported scroll utilities
- `HomePage` — app launch sequence (`ativarApp`) and bottom-nav navigation
- `LoginPage` — login form interaction; credentials come from `.env` via `process.env.CLIENT_USER` / `CLIENT_PASSWORD`
- `CategoriasPage` — category browsing and product favoriting
- `PerfilPage` — profile screen, favorites navigation, logout
- `FavoritosPage` — favorites screen interactions

### Scroll utilities (exported from `BasePage`)

| Export | Purpose |
|---|---|
| `scrollFinger()` | Single swipe-up gesture using `driver.performActions` |
| `scrollUntilVisible(element, maxScrolls)` | Scrolls up to 14 times until element is displayed |
| `forceScrollBeforeSearching(n)` | Performs `n` mandatory scrolls before searching |
| `timewhait` | Shared 3000 ms pause constant used after most interactions |

### Debug utility (`BasePage`)

`debugContextAndSource()` — prints the current WebView context, all available contexts, and the first 3000 characters of the page source to the console. **Use this method inside a failing test to diagnose selector and context issues.** Call it at the point where the test breaks:

```typescript
await page.debugContextAndSource();
```

Do not leave calls to this method in committed test code; it is a temporary debugging aid only.

### Test lifecycle

- **`onPrepare`** hook in `wdio.conf.ts`: creates `allure-results/environment.properties` (includes `Environment=AWS Device Farm` or `Local`), `categories.json`, and `executor.json`
- **`before`** hook: pauses 10 s after app launch to let it fully load
- **`beforeTest`** hook: starts screen recording (no ffmpeg required), por cenário:
  - **Android no Device Farm**: `driver.execute('mobile: startMediaProjectionRecording', { maxDurationSec: 600, priority: 'high' })` — MediaProjection grava a sessão inteira em resolução nativa. **Não** usar `startRecordingScreen` aqui: o `screenrecord` nativo truncava o vídeo em ~37 s na troca de surface do app no Device Farm.
  - **Android local e iOS**: `driver.startRecordingScreen({ timeLimit: 180 })` (comportamento original — já grava completo)
- **`afterTest`** hook: stops recording (`mobile: stopMediaProjectionRecording` no Android Device Farm / `stopRecordingScreen` nos demais), attaches video as `video/mp4` to Allure, then clears app data:
  - iOS (local ou Device Farm): `driver.execute('mobile: clearApp', { bundleId: 'com.aramis.ecomm' })`
  - Android Device Farm: `driver.execute('mobile: clearApp', { appId: 'com.aramis.ecomm' })`
  - Android local: `adb shell pm clear com.aramis.ecomm`
- **`onComplete`** hook:
  - On Device Farm: returns immediately (testspec handles artifact collection)
  - In CI: copies history, generates Allure HTML, does NOT open browser
  - Locally: copies history, generates HTML, opens in browser

### Reporters

Three reporters run in parallel:
1. **spec** — terminal output
2. **allure** — results in `./allure-results/`; generate HTML with `npm run report:allure`
3. **ctrf-json** — machine-readable summary at `./ctrf/ctrf-report.json`

Video is captured via Appium and attached directly to the Allure result — no external tool or ffmpeg needed. Android no Device Farm usa MediaProjection (`mobile: startMediaProjectionRecording`/`stopMediaProjectionRecording`); local e iOS usam `startRecordingScreen`/`stopRecordingScreen`.

### Allure steps in test spec

Each method call in `test.spec.ts` is wrapped with a `step()` helper that calls `allure.startStep()` / `allure.endStep()`, making the report show meaningful step names (e.g. `homePage.ativarApp()`) with all WebDriver sub-calls nested inside.

### Allure Behaviors tab

The Behaviors (Features by Stories) tab is only populated when tests call `allure.addFeature()` and `allure.addStory()` inside each `it()` block. Without these annotations, the tab remains empty.

### Element selector conventions

Selectors follow UiAutomator2 patterns:
- `accessibility id:` / `~` — preferred for named UI elements
- `-android uiautomator:new UiSelector().text("…")` — text-based lookup
- `id:` — Android resource IDs (e.g. `com.aramis.ecomm:id/…`)
- `className:` with `.instance(n)` — SVG/vector elements that lack accessible names

### Environment

Credentials and tokens are read from `.env` at the project root (loaded via `dotenv` in `wdio.conf.ts`):
```
# Credenciais do app
CLIENT_USER=<email>
CLIENT_PASSWORD=<password>

# EAS / Expo
EXPO_TOKEN=<eas-access-token>
EXPO_PROJECT_ID=<uuid-do-projeto-ecomm>

# iOS local via Device Farm Remote Access
REMOTE_HOST=<hostname da sessão remota Device Farm>
REMOTE_PORT=<porta, ex: 4723>
REMOTE_PATH_IOS=<campo Remote Path do Appium Inspector, ex: /wd/hub>
```

- `EXPO_TOKEN` — autenticação com o EAS CLI. Obtenha em expo.dev → Account Settings → Access Tokens.
- `EXPO_PROJECT_ID` — UUID do projeto `com.aramis.ecomm` no EAS; necessário para que o CLI identifique o projeto quando executado fora do diretório do app Expo. Encontre em expo.dev → projeto ecomm → Project Settings → Project ID.
- `REMOTE_HOST` / `REMOTE_PORT` / `REMOTE_PATH_IOS` — usados **somente** para `npm run wdio:ios` (iOS local via Remote Access). Não afetam execuções Android.

On AWS Device Farm, credentials are passed as `environmentVariables` in the `schedule-run` call and written to `.env` by `testspec.yml` in the `pre_test` phase.

## CI/CD — AWS Device Farm

The GitHub Actions workflow (`.github/workflows/mobile_test.yml`) runs on `workflow_dispatch` and `pull_request`. Executa **dois jobs paralelos** — um para Android e um para iOS — e depois publica um relatório Allure unificado:

```
trigger
├─ Job Android (run-on-device-farm)
│   Baixa APK do EAS → upload Device Farm → schedule-run no pool Android
│   testspec.yml: npm run wdio  (PLATFORM não setado → isIOS=false → caps Android)
│
├─ Job iOS (run-ios-on-device-farm)
│   Baixa IPA do EAS → upload Device Farm → schedule-run no pool iOS
│   testspec-ios.yml: export PLATFORM=ios && npm run wdio  (isIOS=true → caps iOS)
│
└─ Job publish-report (aguarda ambos)
    Gera DOIS relatórios Allure separados (Android e iOS) → publica ambos no branch reports
```

**Device Farm ARNs (GitHub Secrets):**

| Secret | Job que usa | Propósito |
|---|---|---|
| `DEVICE_FARM_PROJECT_ARN` | Ambos | Identifica o projeto no Device Farm |
| `DEVICE_FARM_DEVICE_POOL_ARN` | Android apenas | Pool de devices Android |
| `DEVICE_FARM_IOS_DEVICE_POOL_ARN` | iOS apenas | Pool de devices iOS |

### `testspec.yml` / `testspec-ios.yml`

Device Farm test specs at the repo root:
- `testspec.yml` — usado pelo job Android: `npm run wdio`
- `testspec-ios.yml` — usado pelo job iOS: `export PLATFORM=ios && npm run wdio`

Ambos fazem:
- `pre_test`: `npm install`, escreve `.env` a partir das env vars do Device Farm
- `post_test`: copia `allure-results/` e `ctrf/` para `$DEVICEFARM_LOG_DIR`

**Appium 2 no Android (`testspec.yml`):** a fase `install` roda `devicefarm-cli use appium 2`. Por padrão o Device Farm sobe **Appium 1.x**, que não tem `mobile: startMediaProjectionRecording` (vídeo Android cai no `catch` do `afterTest`) nem o `releaseActions`/`DELETE` do W3C usado pelos scrolls (`driver.performActions` → `NoSuchElementError` na maioria dos devices). O Appium 2 selecionado já vem com o driver UiAutomator2 compatível — não precisa adicionar `appium` ao `package.json`. **`testspec-ios.yml` continua no Appium 1.x** (host legado): migrar o iOS exigiria `ios_test_host: macos_sequoia` + `DEVICEFARM_APPIUM_WDA_DERIVED_DATA_PATH_V9`; fica para quando o fluxo de teste iOS for implementado.

**Por que cada device mostra "3 testes" (Setup/Tests/Teardown Suite):** é a estrutura fixa que o Device Farm aplica a toda run — não vem da automação, não é configurável nem removível. Só a `Tests Suite` contém o teste real; o relatório Allure conta corretamente 1 teste.

### `scripts/install-apk.mjs`

Node ESM script that fetches the latest `development` build (`.apk` or `.aab`) for `com.aramis.ecomm` from EAS via GraphQL API. Reads `EXPO_TOKEN` and `EXPO_PROJECT_ID` from `.env`. Used by `npm run install-apk` and `npm run wdio:fresh`.

If the artifact is `.aab` (Android App Bundle):
1. Auto-downloads `bundletool.jar` from Google GitHub releases and caches it in `scripts/bundletool.jar`
2. Auto-generates `~/.android/debug.keystore` via `keytool` if not present
3. Converts AAB → universal APK using bundletool
4. Installs on the running AVD via `adb install -r`

Regardless of format (`.apk` or `.aab`), the final APK is always saved as `app.apk` in the project root after installation. Requires Java (JDK) to be installed.

### `scripts/generate-report-index.mjs`

Node ESM script that generates `reports/index.html` listing all `run-N-DATE/` directories in the `reports` branch, sorted newest-first.

### GitHub Secrets required

| Secret | Purpose |
|---|---|
| `AWS_ACCESS_KEY_ID` | IAM key with `devicefarm:*` permission |
| `AWS_SECRET_ACCESS_KEY` | IAM secret |
| `DEVICE_FARM_PROJECT_ARN` | ARN do projeto no Device Farm |
| `DEVICE_FARM_DEVICE_POOL_ARN` | ARN do device pool Android |
| `DEVICE_FARM_IOS_DEVICE_POOL_ARN` | ARN do device pool iOS |
| `CLIENT_USER` | App login email |
| `CLIENT_PASSWORD` | App login password |
| `EXPO_TOKEN` | EAS access token (expo.dev → Access Tokens) |
| `EXPO_PROJECT_ID` | UUID do projeto ecomm no EAS (expo.dev → projeto ecomm → Project Settings → Project ID) |

### Reports branch

The `reports` branch is an orphan branch served by GitHub Pages. Each CI run creates `reports/run-{RUN_NUMBER}-{DATE}/` with **two** Allure HTML reports in subfolders: `android/` and `ios/`. Each platform keeps its own Trend history (copied per-platform from the previous run's matching subfolder). The root index (`scripts/generate-report-index.mjs`) lists each run with separate **Android** and **iOS** columns; runs published before the split have a single "legado" link. Reports accumulate indefinitely — deletion is manual only. The index is at the root of the GitHub Pages URL.

**Seleção de device no relatório:** o pool roda vários devices por plataforma, mas o relatório traz **apenas um** — o **primeiro device cujo job resultou `PASSED`** (garante que o vídeo é de um teste que passou). Se nenhum passou, cai no **primeiro device** como fallback. O passo "Download artifacts" de cada job baixa só o `Customer Artifacts` (zip com o `allure-results` daquele device, incluindo o vídeo) do device escolhido — antes baixava o zip de todos com o mesmo nome, sobrescrevendo até sobrar um aleatório.

**Vídeo reproduzível (re-encode no `publish-report`):** antes do `allure generate`, o job re-encoda qualquer `.mp4` que não seja `h264` para H.264 + `+faststart` (mantendo o nome, para a referência no `*-result.json` seguir válida). O iOS (Appium 1.x) grava em MJPEG (`mp4v`), que o navegador não toca em `<video>`; o Android (MediaProjection sob Appium 2) já é h264 e é pulado.
