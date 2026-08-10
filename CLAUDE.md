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

# Só baixar o artefato, sem instalar (usado pelo CI). Salva app.apk + .build-info.json
node scripts/install-apk.mjs --no-install
node scripts/install-apk.mjs --no-install --platform ios   # baixa app.ipa

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

There is no lint or build step — TypeScript is transpiled on-the-fly pelo runner do WebdriverIO (`tsconfig.json` tem `noEmit: true`; não há `typescript`/`tsx` nas devDependencies do projeto). O `tsconfig.json` é estrito (`strict`, `noUnusedLocals`, `noUnusedParameters`) e cobre apenas `test/` e `wdio.conf.ts`.

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
| Android local | false | false | false | Appium local (service sobe o Appium), AVD-S24, `adb shell pm clear` |
| iOS local | false | true | true | Conecta em `REMOTE_HOST:PORT/PATH`, bundleId, **sem vídeo**, `terminateApp` no fim |
| CI Android | true | false | false | Appium do Device Farm (`127.0.0.1:4723/wd/hub`), UiAutomator2, `mobile: clearApp` |
| CI iOS | true | true | false | Appium do Device Farm, XCUITest com WDA pré-compilado, `mobile: clearApp` |

`buildServices()` só sobe o serviço `appium` local quando **não** é Device Farm nem remoto — nos dois últimos o WDIO apenas conecta num Appium já provido.

**Caps iOS no Device Farm:** usam `appium:usePrebuiltWDA: true` + `appium:derivedDataPath` (de `DEVICEFARM_WDA_DERIVED_DATA_PATH_V9` com fallback para `DEVICEFARM_WDA_DERIVED_DATA_PATH`). Sem isso o Appium tenta buildar o WebDriverAgent via `xcodebuild` e falha com "code 70" no host self-managed.

**Caps Android no Device Farm:** deliberadamente **sem** `autoGrantPermissions` — os diálogos de GPS/notificação precisam aparecer para a sequência `ativarApp()` tratá-los, como no fluxo local. Localmente `autoGrantPermissions: true` está ativo.

### Page Object Model

All page objects live in `test/pageobjects/` and extend `BasePage`:

- `BasePage` — shared base with `waitForElement()` (20 s default timeout), `elementVisible()` (assertion helper), `clickIfPresent()`, `fechaBanner()`, app-launch permission helpers (`iniciaApp`, `ativaGps`, `permiteNotificacao`, `negaNotificacao`, `continua`, `termo1`, `termos2`), and exported scroll utilities
- `HomePage` — app launch sequence (`ativarApp`) and bottom-nav navigation
- `LoginPage` — login form interaction; recebe email/senha como argumentos (a escolha da conta é de `test/utils/credentials.ts`, ver abaixo)
- `CategoriasPage` — category browsing and product favoriting
- `PerfilPage` — profile screen, favorites navigation, logout
- `FavoritosPage` — favorites screen interactions

**`ativarApp()` no iOS ainda é um TODO** (`HomePage.ts`: o branch `PLATFORM === 'ios'` está vazio). É por isso que o fluxo iOS quebra no onboarding tanto no Remote Access quanto no Device Farm — os resultados iOS chegam ao relatório, mas falhando. Todos os seletores dos page objects são UiAutomator2/Android.

**`clickIfPresent(selector, timeout = 8000)`** — clica só se o elemento aparecer no timeout; caso contrário loga `⏭️ Passo opcional pulado` e segue sem derrubar o teste. Todos os passos de onboarding/permissão (`iniciaApp`, `ativaGps`, `permiteNotificacao`, `negaNotificacao`, `continua`) usam isso, porque esses diálogos variam por device/versão de SO. `termo1`/`termos2` seguem a mesma ideia via `scrollUntilVisible` (pulam se não acharem).

**`fechaBanner()` — não clique no `closeBt`.** O banner do Insider renderiza o "X" real dentro de uma WebView não-debuggable, e o botão nativo `com.aramis.ecomm:id/closeBt` está **desalinhado** dele: clicar no `closeBt` cai na WebView e **abre** o promo. O método toca na coordenada derivada dos bounds do `closeBt` (`x − width`, `y + height/2`), que escala por device. É no-op quando o banner não está visível.

### Scroll utilities (exported from `BasePage`)

| Export | Purpose |
|---|---|
| `scrollFinger()` | Single swipe-up gesture using `driver.performActions` (o `releaseActions` que o segue é envolvido em `try/catch`: alguns hosts Appium não implementam `DELETE /actions` e lançam "unknown command" — o gesto já foi aplicado) |
| `scrollUntilVisible(element, maxScrolls)` | Scrolls up to 14 times until element is displayed |
| `forceScrollBeforeSearching(n)` | Performs `n` mandatory scrolls before searching |
| `timewhait` | Shared 3000 ms pause constant used after most interactions |

### Debug utility (`BasePage`)

`debugContextAndSource()` — prints the current WebView context, all available contexts, and the first 3000 characters of the page source to the console. **Use this method inside a failing test to diagnose selector and context issues.** Call it at the point where the test breaks:

```typescript
await page.debugContextAndSource();
```

Do not leave calls to this method in committed test code; it is a temporary debugging aid only.

### Conta distinta por device (`test/utils/`)

No Device Farm o pool roda vários devices **em paralelo contra o mesmo backend**. Se todos logarem com a mesma conta, eles disputam o mesmo produto na tela de Favoritos (um adiciona / outro remove) e o teste falha de forma intermitente. Por isso cada device usa uma conta distinta, escolhida **em runtime**:

- `test/utils/device-index.ts` — mapa fixo `prefixo do modelo → índice da conta`, por plataforma (Android: 6 modelos `SM-S9xx`; iOS: 5 modelos, ainda **não verificado** em runtime).
- `test/utils/credentials.ts` — `getCredentials()` casa `browser.capabilities.deviceModel` por `startsWith` contra o mapa e devolve `emails[índice]` da CSV `CLIENT_USERS_EMAILS`, com senha comum em `CLIENT_PASSWORD`. Loga `🔑 Device model "…" -> conta[N] = email`. Sem match, cai em `conta[0]` com `warn` — ajuste o mapa antes de confiar na unicidade.
- `test/utils/device-name.ts` — `friendlyDeviceName()`, mesmo casamento por prefixo, devolve o nome comercial do aparelho para rotular o relatório. Fallback: modelo cru → `DEVICEFARM_DEVICE_NAME` → `AVD-S24` (local).

Duas restrições que moldaram esse desenho (não desfazer sem motivo):
- **A identidade do device é o MODELO** (`deviceModel` das capabilities), **nunca `DEVICEFARM_DEVICE_NAME`** — essa env var é o número de série do aparelho (no iOS, o UDID) e muda a cada run, então nenhum mapa fixo casaria e todos cairiam em `conta[0]`.
- **A lista de contas viaja como CSV de emails em texto puro**, não base64 de JSON: o Device Farm limita cada variável de ambiente a 256 caracteres e o base64 estourava o limite. As env vars do Device Farm são globais ao run (todos os devices recebem as mesmas), por isso a escolha tem que acontecer no código, não no CI.

Fora do Device Farm (local/single device), `getCredentials()` cai em `CLIENT_USER` + `CLIENT_PASSWORD` do `.env`.

Como descobrir os modelos de um pool:
```bash
aws devicefarm list-jobs --arn <run-arn> --query "jobs[].{name:device.name, modelId:device.modelId}"
```

### Versão do app no relatório

`scripts/install-apk.mjs` grava `.build-info.json` (gitignored) com `appVersion`/`appBuildVersion` do build EAS. O `wdio.conf.ts` lê **primeiro** as env vars `APP_VERSION`/`APP_BUILD_VERSION` (o workflow as extrai do `.build-info.json` com `jq` e as passa como `environmentVariables` do `schedule-run`) e só cai no arquivo local quando elas não existem. O valor alimenta `environment.properties` do Allure e o `appVersion` do reporter CTRF; `'?'` significa que nenhuma das duas fontes estava disponível.

### Test lifecycle

- **`onPrepare`** hook in `wdio.conf.ts`: creates `allure-results/environment.properties` (includes `Environment=AWS Device Farm` or `Local`), `categories.json`, and `executor.json`
- **`before`** hook: pauses 10 s after app launch to let it fully load
- **`beforeTest`** hook: starts screen recording (no ffmpeg required), por cenário:
  - **`isRemote` (iOS local): não grava nada** — retorna logo no início do hook.
  - **Android no Device Farm**: `driver.execute('mobile: startMediaProjectionRecording', { resolution: '1280x720', maxDurationSec: 600, priority: 'high' })`. Dois motivos para cada parâmetro: **MediaProjection em vez de `startRecordingScreen`** porque o `screenrecord` nativo truncava o vídeo em ~37 s na troca de surface do app no Device Farm; **720p em vez da resolução nativa** porque o `.mp4` passava de 100 MB (limite por arquivo do GitHub), era apagado no `publish-report` e o vídeo virava 404 no relatório. `priority` é a prioridade da thread de captura (não afeta qualidade/tamanho).
  - **Android local e iOS (Device Farm)**: `driver.startRecordingScreen({ timeLimit: 180 })`
- **`afterTest`** hook: para a gravação (`mobile: stopMediaProjectionRecording` no Android Device Farm / `stopRecordingScreen` nos demais), anexa o vídeo como `video/mp4` ao Allure — tudo dentro de `try/catch`, uma falha de vídeo não derruba o teste — e então limpa o estado do app:
  - `isRemote` (iOS local): **sem vídeo e sem clear** — só `driver.terminateApp('com.aramis.ecomm')`
  - iOS no Device Farm: `driver.execute('mobile: clearApp', { bundleId: 'com.aramis.ecomm' })`
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

Each method call in `test.spec.ts` is wrapped with a `step()` helper that calls `allure.startStep()` / `allure.endStep()`, making the report show meaningful step names (e.g. `homePage.ativarApp()`) with all WebDriver sub-calls nested inside. Em falha, o step é fechado com `Status.FAILED` e o erro é re-lançado.

**O `step()` também tenta fechar o banner ANTES de cada passo** (`closeBannerIfPresent`, apontado para `homePage.fechaBanner()` no início do `it()`). O banner do Insider pode surgir a qualquer momento depois do login; em vez de espalhar chamadas manuais pelo teste, todo passo tenta dispensá-lo primeiro — é no-op quando não está visível. Ao adicionar passos novos, use `step()` em vez de chamar o page object direto, senão o passo perde essa proteção.

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

On AWS Device Farm, credentials are passed as `environmentVariables` in the `schedule-run` call and written to `.env` by `testspec.yml` in the `pre_test` phase. Lá entra também `CLIENT_USERS_EMAILS` (CSV de contas, uma por device — ver "Conta distinta por device") e `APP_VERSION`/`APP_BUILD_VERSION`. O workflow limpa whitespace do CSV com `tr -d '[:space:]'` antes de enviar, porque quebras de linha coladas no secret invalidariam os emails.

## CI/CD — AWS Device Farm

The GitHub Actions workflow (`.github/workflows/mobile_test.yml`) runs on `workflow_dispatch` and `pull_request`. Executa **dois jobs paralelos** — um para Android e um para iOS — e depois publica um relatório Allure unificado:

```
trigger
├─ Job Android (run-on-device-farm)
│   Baixa APK do EAS → npm ci → ZIP COM node_modules → upload → schedule-run (pool Android)
│   testspec.yml: node ./node_modules/@wdio/cli/bin/wdio.js run ./wdio.conf.ts
│                 (PLATFORM não setado → isIOS=false → caps Android)
│
├─ Job iOS (run-ios-on-device-farm)
│   Baixa IPA do EAS → ZIP SEM node_modules → upload → schedule-run (pool iOS)
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
- `testspec.yml` — usado pelo job Android: `node ./node_modules/@wdio/cli/bin/wdio.js run ./wdio.conf.ts` (bin real, não `npm run wdio` — ver "Armadilha dos symlinks" abaixo)
- `testspec-ios.yml` — usado pelo job iOS: `export PLATFORM=ios && npm run wdio`

Ambos fazem:
- `pre_test`: escreve `.env` (`CLIENT_USER`, `CLIENT_PASSWORD`, `CLIENT_USERS_EMAILS`) a partir das env vars do Device Farm, sobe o Appium em background com `--base-path=/wd/hub` (o ambiente customizado não sobe o Appium sozinho) e espera até 60 s pela linha "Appium REST http interface listener started" no log
- `post_test`: copia `allure-results/` e `ctrf/` para `$DEVICEFARM_LOG_DIR`

Só no `testspec-ios.yml`:
- **Node 18 via nvm** nas fases `install`, `pre_test` e `test` — o host iOS roda Node 14 por padrão, que quebra o WDIO 9. Cada fase roda num shell novo, por isso o `nvm use 18` se repete nas três.
- `npm install` com **até 3 tentativas**: o host derruba a conexão baixando pacotes (ECONNRESET) e, sem deps, o `npm run wdio` dá "command not found", o teste nem roda e o device some do relatório.

Diferença de instalação de deps entre os dois (ver "Otimização de tempo do CI" abaixo):
- **`testspec.yml` (Android): NÃO roda `npm install`** — `node_modules` já vem empacotado no ZIP do test package.
- **`testspec-ios.yml` (iOS): ainda roda `npm install`** no host macOS (decisão deliberada, ver abaixo).

**Appium 2 no Android (`testspec.yml`):** a fase `install` roda `devicefarm-cli use appium 2`. Por padrão o Device Farm sobe **Appium 1.x**, que não tem `mobile: startMediaProjectionRecording` (vídeo Android cai no `catch` do `afterTest`) nem o `releaseActions`/`DELETE` do W3C usado pelos scrolls (`driver.performActions` → `NoSuchElementError` na maioria dos devices). O Appium 2 selecionado já vem com o driver UiAutomator2 compatível — não precisa adicionar `appium` ao `package.json`. **`testspec-ios.yml` continua no Appium 1.x** (host legado): migrar o iOS exigiria `ios_test_host: macos_sequoia` + `DEVICEFARM_APPIUM_WDA_DERIVED_DATA_PATH_V9`; fica para quando o fluxo de teste iOS for implementado.

**Por que cada device mostra "3 testes" (Setup/Tests/Teardown Suite):** é a estrutura fixa que o Device Farm aplica a toda run — não vem da automação, não é configurável nem removível. Só a `Tests Suite` contém o teste real; o relatório Allure conta corretamente 1 teste.

**Esse agregado engana no console — não confie nele.** Como Setup e Teardown quase sempre passam, um run em que **todos** os devices falharam ainda aparece como "2 de 3 passed" por aparelho. Exemplo real (run #48, iOS): counters `15 total / 10 passed / 5 failed` com os 5 iPhones em `Tests Suite = FAILED` — os 10 "passed" eram só Setup+Teardown, e o console não indicava qual device teria funcionado (nenhum). Por isso o step `Download artifacts from Device Farm` (nos dois jobs) escreve no `$GITHUB_STEP_SUMMARY` uma tabela `Device | Teste | Detalhe` com o resultado da **`Tests Suite`** de cada aparelho. Sem custo de API: o `list-tests` já era chamado no mesmo loop para achar o `Customer Artifacts`; agora a resposta também alimenta a tabela. Para saber o que de fato aconteceu por aparelho, leia essa tabela ou o Allure — não os counters do run.

### Otimização de tempo do CI (decisão de projeto)

O workflow levava ~30 min. Duas frentes de aceleração foram aplicadas (mantendo cobertura, todos os devices, vídeo e Trend):

- **A — `node_modules` empacotado no ZIP (SOMENTE Android):** o job Android roda `npm ci` no runner e inclui `node_modules` no test package (o passo `Create test package ZIP` **não** exclui mais `node_modules/*`); em contrapartida, `testspec.yml` **não roda mais `npm install`**. Isso elimina o maior custo repetido do `pre_test` (uma instalação de deps por device, com retries de ECONNRESET). É seguro no Android porque, no Device Farm, `buildServices()` retorna `[]` — o WDIO só conecta no Appium já provido, então `node_modules` é só o runner WDIO/ts-node (JS puro).

  **Armadilha dos symlinks (o `testspec.yml` invoca o WDIO pelo caminho real, NÃO por `npm run wdio`):** `node_modules/.bin/wdio` é um symlink (`→ ../@wdio/cli/bin/wdio.js`). O **unzip do Device Farm não restaura symlinks** — materializa cada um como arquivo-texto com o caminho do alvo, então rodar `.bin/wdio` (via `npm run wdio`) quebra com `../@wdio/cli/bin/wdio.js: No such file or directory`. Zipar com `zip -ryq` (`-y`) também não salva: só troca o erro por esse mesmo "No such file or directory". **Fix definitivo:** na fase `test` do `testspec.yml`, chamar `node ./node_modules/@wdio/cli/bin/wdio.js run ./wdio.conf.ts` — o bin real faz `import('../build/index.js')` relativo à própria pasta (`@wdio/cli/build/index.js`, que existe) e não depende de symlink. (Diagnóstico das runs #44/#45 no artefato "Test spec output" do device via AWS CLI. O ZIP segue com `zip -ryq`, inofensivo.)

  **Por que A NÃO foi aplicado ao iOS (`testspec-ios.yml` mantém `npm install`):** (1) o `node_modules` é montado no runner **Ubuntu**; seguro para o host Linux do Android, mas o iOS roda o test package num **host macOS**, onde deps com binário nativo compilado no Linux podem não funcionar; (2) o teste iOS ainda quebra no onboarding (`ativarApp` TODO), então otimizar a instalação de um fluxo já quebrado adiciona risco sem ganho real. Alternativa segura pendente (item B, não implementado): trocar `npm install` por `npm ci --prefer-offline --no-audit --no-fund` no `testspec-ios.yml` (instalação continua no host macOS, ganho menor ~30–90s).

- **C — Uploads paralelos + polls curtos (AMBOS os jobs, em `mobile_test.yml`):** os 3 uploads S3 (app / test package / testspec), antes sequenciais, viraram um único step com os `curl` em paralelo + um loop de espera combinado (`90×5s`). O poll de conclusão do run passou de `sleep 60`/120 iterações para `sleep 20`/360 iterações (mesmo teto ~2h, detecta o fim mais cedo). Como essa lógica vive no GitHub Actions e é só velocidade, foi aplicada aos dois jobs.

### `scripts/install-apk.mjs`

Node ESM script that fetches the latest `development` build for `com.aramis.ecomm` from EAS via GraphQL API (o script **introspecciona o schema** antes de consultar, para tolerar mudanças na API do EAS). Reads `EXPO_TOKEN` and `EXPO_PROJECT_ID` from `.env`. Used by `npm run install-apk`, `npm run wdio:fresh` e pelos dois jobs do CI.

Flags de CLI:

| Flag | Efeito |
|---|---|
| `--no-install` | Só baixa o artefato (não chama `adb`) — é como o CI usa o script |
| `--platform ios` | Baixa o `.ipa` em vez do `.apk`/`.aab`; salva como `app.ipa` (default: `ANDROID`) |

Sempre grava `.build-info.json` (gitignored) na raiz com `appVersion`, `appBuildVersion` e `platform` do build — é daí que o workflow extrai `APP_VERSION`/`APP_BUILD_VERSION` (ver "Versão do app no relatório").

If the artifact is `.aab` (Android App Bundle):
1. Auto-downloads `bundletool.jar` from Google GitHub releases and caches it in `scripts/bundletool.jar`
2. Auto-generates `~/.android/debug.keystore` via `keytool` if not present
3. Converts AAB → universal APK using bundletool (`java -Xmx4g`: o heap padrão da JVM é ~1/4 da RAM, apertado no runner do CI)
4. Installs on the running AVD via `adb install -r`

Regardless of format (`.apk` or `.aab`), the final APK is always saved as `app.apk` in the project root after installation. Requires Java (JDK) to be installed. No fim, o script valida que o artefato existe e tem tamanho plausível — o CI sobe esse arquivo no passo seguinte e uma falha aqui precisa aparecer aqui.

**Este bloco AAB→APK é o maior ponto de divergência entre local e CI — e foi o que quebrou o job Android** (runs #47/#48 de 05/08/2026: nenhum upload Android chegou ao Device Farm). **Todos** os builds `development` de Android no EAS são `.aab`, então o Android sempre executa a conversão e o iOS nunca. Dentro dela, duas operações **jamais rodam na máquina local**, porque ficam em cache, mas rodam em **toda** run do CI:

| Operação | Local | CI |
|---|---|---|
| baixar o bundletool (guardado por `if (!existsSync(...))`) | nunca — jar cacheado em `scripts/bundletool.jar` | todo run — o jar é gitignored, nunca está no checkout |
| gerar `~/.android/debug.keystore` com `keytool` | nunca — já existe | todo run |

Por isso "funciona local" não é evidência de que o caminho do CI funciona. A descoberta da versão usa `api.github.com`, que **sem autenticação tem cota de 60 req/h por IP** — e os runners hospedados saem por IPs compartilhados. Mitigações no script:
- `Authorization: Bearer $GITHUB_TOKEN` (ou `GH_TOKEN`) quando a variável existe → cota de 5000/h. O workflow passa `secrets.GITHUB_TOKEN` (automático, não precisa cadastrar secret).
- O token **não** é repassado em redirect para outro host: o asset vai para `objects.githubusercontent.com`, que já vem assinado e rejeita requisição com token.
- Erro com status HTTP, `x-ratelimit-remaining`/`reset` e trecho do corpo — antes um 403 virava a mensagem genérica "não foi possível encontrar o bundletool.jar".
- **Fallback** para a URL fixa `releases/download/<BUNDLETOOL_FALLBACK_VERSION>/bundletool-all-<versão>.jar`, que não passa pela API e não tem rate limit. Atualize `BUNDLETOOL_FALLBACK_VERSION` de tempos em tempos.

### `scripts/generate-report-index.mjs`

Node ESM script that generates `reports/index.html` listing all `run-N-DATE/` directories in the `reports` branch, sorted newest-first.

**Abordagem híbrida (compatível com repo privado):** a lista de runs é montada **em build-time**, varrendo as pastas `run-N/` em disco (`fs.readdirSync`) — o `publish-report` roda o script a partir da raiz do branch `reports` já checado out, então as `<tr>` já saem prontas no HTML e a tabela abre mesmo sem JavaScript. No cliente, um script enxuto faz apenas `HEAD` **same-origin** em cada link renderizado e esconde as células/linhas cuja pasta foi apagada manualmente (reflete deleções ao vivo, sem esperar o próximo run). **Não** usar a API do GitHub (`api.github.com/.../contents`) no cliente: ela responde **404** a requisições não autenticadas em repositório privado, quebrando o índice no Pages privado — o `HEAD` same-origin roda com a sessão já autenticada do Pages e funciona em qualquer repo.

### GitHub Secrets required

| Secret | Purpose |
|---|---|
| `AWS_ACCESS_KEY_ID` | IAM key with `devicefarm:*` permission |
| `AWS_SECRET_ACCESS_KEY` | IAM secret |
| `DEVICE_FARM_PROJECT_ARN` | ARN do projeto no Device Farm |
| `DEVICE_FARM_DEVICE_POOL_ARN` | ARN do device pool Android |
| `DEVICE_FARM_IOS_DEVICE_POOL_ARN` | ARN do device pool iOS |
| `CLIENT_USER` | App login email (fallback local / single device) |
| `CLIENT_PASSWORD` | App login password (comum a **todas** as contas) |
| `CLIENT_USERS_ANDROID_EMAILS` | CSV dos emails das contas Android — a **ordem define o índice** e precisa casar com `test/utils/device-index.ts` |
| `CLIENT_USERS_IOS_EMAILS` | CSV dos emails das contas iOS (idem) |
| `EXPO_TOKEN` | EAS access token (expo.dev → Access Tokens) |
| `EXPO_PROJECT_ID` | UUID do projeto ecomm no EAS (expo.dev → projeto ecomm → Project Settings → Project ID) |

### Reports branch

The `reports` branch is an orphan branch served by GitHub Pages. Each CI run creates `reports/run-{RUN_NUMBER}-{DATE}/` with **two** Allure HTML reports in subfolders: `android/` and `ios/`. Each platform keeps its own Trend history (copied per-platform from the previous run's matching subfolder). The root index (`scripts/generate-report-index.mjs`) lists each run with separate **Android** and **iOS** columns; runs published before the split have a single "legado" link. The index is at the root of the GitHub Pages URL.

**Retenção: só os 3 runs mais recentes (`KEEP=3` no step `Publish reports to reports branch`).** A cada publicação o step apaga as pastas `run-*` mais antigas (`find -maxdepth 1 -name 'run-*' | sort -V | head -n -$KEEP`) e recria a branch como **commit órfão** + `git push --force`: 1 commit, no máximo 3 runs. Dois motivos para o órfão em vez de `git rm`: (1) apagar pasta num commit novo **não devolve espaço** — os blobs (vídeos, ~33 MB por aparelho) continuam no histórico, o repositório não encolhe (chegou a 5,69 GB, acima do limite de 5 GB) e o checkout da branch no CI continua levando ~9 min; (2) o site publicado tem teto de **1 GB** no Pages. `sort -V` é obrigatório aqui — em ordem lexicográfica `run-100` viria antes de `run-9`. A checagem de "nada novo para publicar" usa o **hash da árvore** (`git rev-parse HEAD^{tree}` antes × depois), porque num commit órfão `git diff --staged` nunca fica vazio (não há pai). O `concurrency: reports-publish` continua serializando runs sobrepostas, então o force push não atropela outra publicação. **O repositório não encolhe na hora** — os objetos ficam órfãos até o GitHub rodar GC.

O step seguinte, **`Apagar artifacts das runs podadas`**, lê os números das runs removidas (gravados em `$GITHUB_WORKSPACE/pruned-runs.txt`, fora de `reports-branch` para não serem commitados) e deleta pela API os **seis** artifacts de cada uma — `devicefarm-raw-android-N`, `allure-results-N`, `devicefarm-raw-ios-N`, `allure-results-ios-N`, `allure-report-android-N`, `allure-report-ios-N` —, casando por **nome exato**. Exige `actions: write` no `permissions` do job. Falha de deleção é só `::warning::`: o relatório já foi publicado e os artifacts têm `retention-days: 30` de qualquer forma. Quando o push falha (5 tentativas) ou nada muda, o arquivo é **esvaziado** — a poda não chegou ao remoto, então os artifacts não podem ser apagados.

**Todos os devices no relatório (navegável por aparelho):** o pool roda vários devices por plataforma e o relatório junta **todos**. O passo "Download artifacts" baixa o `Customer Artifacts` (zip com o `allure-results`, incluindo o vídeo) da `Tests Suite` de **cada** device (`artifacts/ca-<i>.zip`); o passo "Extract" extrai cada zip num subdir próprio e **mescla** tudo num único `allure-results/` com `cp -rn` (arquivos de resultado/anexo têm nome UUID → únicos entre devices; os fixos — `environment.properties`/`categories.json`/`executor.json` — ficam com 1 cópia).

Cada execução é rotulada em runtime no `test.spec.ts` para dar a navegação por aparelho:
- `addTestCaseId(caseKey)` + `addHistoryId(caseKey)` com `caseKey = "adiciona-favoritos::<device>"` — **é isto que separa os aparelhos**. O Allure agrupa resultados pelo `historyId`; sem uma chave distinta por device, os N resultados (mesmo título de teste) colapsariam como "retries" de um só e o relatório mostraria apenas um aparelho. A chave é estável por modelo, então cada aparelho mantém seu próprio histórico na aba **Trend** entre runs. **`addArgument` NÃO altera o `historyId`** nesta versão do reporter — não confie nele para isso.
- `allure.addParentSuite("<device> — <conta>")` → na aba **Suites** cada aparelho é um nó (com a conta usada); expanda para ver a execução dele (vídeo, passos).
- `allure.addArgument('Device', <device>)` — exibe o device nos **Parameters**.
- `allure.addArgument('Conta', <email>)` — mostra qual conta rodou naquele device (conta escolhida em `test/utils/credentials.ts`).
- `allure.addLabel('host', <device>)` — a aba **Timeline** também separa por aparelho.

O nome amigável do device vem de `test/utils/device-name.ts` (`friendlyDeviceName()`, mapeia `browser.capabilities.deviceModel` → nome; fallback `AVD-S24` local).

**O pipeline NÃO re-encoda vídeo — e não reintroduza um step de ffmpeg no `publish-report`.** O `.mp4` gravado pelo Appium é publicado como está. O step de re-encode que existiu ali nunca entregou nada e custou caro duas vezes: na primeira versão morria no `apt-get` sob `continue-on-error` (o `ffmpeg` não vem no runner) e virava um no-op silencioso; quando passou a rodar de verdade, o `ffmpeg` **sem `-nostdin`** lia a stdin do `while read` — que era a saída do `find` — caía no handler interativo de teclado (`Enter command: <target>|all <time>|-1 <command>`) e **pendurou o run por 4 h 05**. Consequências aceitas: o vídeo iOS (MJPEG do Appium 1.x) não toca no `<video>` do navegador, e nada comprime um `.mp4` que passe de 95 MB (o `publish-report` descarta arquivos desse tamanho antes do commit). O job tem `timeout-minutes: 45` para que nenhum step possa mais pendurar o run.

**Plataforma sem resultado não publica relatório:** os steps de `allure generate` (HTML e single-file) só rodam quando `allure-results-<plat>/` contém **pelo menos um `*-result.json`**. Diretório não-vazio não serve como critério: um job que morre antes do Device Farm ainda deixa lá os arquivos fixos (`environment.properties`, `categories.json`), e o Allure gera daí um relatório de **0 testes** — visualmente idêntico a "rodou e não achou nada". Foi o que mascarou a quebra do Android nos runs #44, #45, #47 e #48. Sem resultado, o job emite `::warning::` e escreve no Step Summary; como `apply_changes` só copia quando `allure-report-<plat>/` existe, a pasta da plataforma simplesmente não é criada e `generate-report-index.mjs` já renderiza `—` naquela coluna.

**Resiliência do `publish-report`:** o job usa `concurrency: reports-publish` (serializa runs sobrepostas), faz checkout da branch `reports` com `fetch-depth: 1` (o histórico completo com vídeos corrompia o checkout → `fatal: could not parse HEAD`), e publica num laço de até 5 tentativas: em push rejeitado, re-sincroniza (`fetch` + `reset --hard FETCH_HEAD`) e **reaplica** as mudanças de forma idempotente. Antes do commit, remove arquivos > 95 MB — com `-path './.git' -prune`, senão o packfile do próprio git é apagado e o commit seguinte quebra. Se nenhuma plataforma gerou relatório, sai com aviso em vez de publicar vazio.

**Relatório baixável:** além do HTML publicado, o job gera `allure generate --single-file` por plataforma e sobe como artifacts `allure-report-android-<run>` / `allure-report-ios-<run>` (30 dias) — um `index.html` autocontido, sem precisar de servidor. O resultado do Device Farm (`PASSED`/`FAILED`/`ERRORED`) **não quebra a esteira**; só o timeout esperando o run quebra, porque aí a esteira não conseguiu obter resultado nenhum.
