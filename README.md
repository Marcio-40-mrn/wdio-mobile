# Aramis eComm — Mobile E2E Test Suite

WebdriverIO + Appium end-to-end test suite for the `com.aramis.ecomm` Android and iOS app.

## Cenários de execução

| Cenário | Comando | Requisitos |
|---|---|---|
| Android local (sem reinstalar) | `npm run wdio` ou `npm run wdio:android` | AVD-S24 rodando |
| Android local (com install) | `npm run wdio:fresh` | AVD-S24 + EAS token |
| iOS local (Device Farm Remote) | `npm run wdio:ios` | Sessão Device Farm aberta + IPA instalado + vars `.env` |
| CI Android | GitHub Actions | Secrets AWS + EXPO configurados |
| CI iOS | GitHub Actions | Secrets AWS + EXPO configurados |

---

## Pré-requisitos locais

- Node.js LTS
- Java JDK (necessário para bundletool no fluxo .aab → .apk)
- Appium: `npm install -g appium`
- Driver Android: `appium driver install uiautomator2`
- Driver iOS: `appium driver install xcuitest`
- Android Studio com AVD nomeado **AVD-S24**
- Arquivo `.env` na raiz do projeto (ver abaixo)

---

## Variáveis de ambiente (`.env`)

```env
# Credenciais do app
CLIENT_USER=<email de login>
CLIENT_PASSWORD=<senha>

# EAS / Expo (para download de builds)
EXPO_TOKEN=<token em expo.dev → Account Settings → Access Tokens>
EXPO_PROJECT_ID=<UUID em expo.dev → projeto → Project Settings>

# iOS local via Device Farm Remote Access (apenas para npm run wdio:ios)
REMOTE_HOST=<hostname da sessão remota>
REMOTE_PORT=<porta, ex: 4723>
REMOTE_PATH_IOS=<Remote Path do Appium Inspector, ex: /wd/hub>
```

> `REMOTE_HOST`, `REMOTE_PORT` e `REMOTE_PATH_IOS` só são usados quando `PLATFORM=ios` está ativo. Não afetam execuções Android.

---

## Executando localmente

### Android (AVD-S24)

```bash
# Baixa o APK mais recente do EAS, instala no AVD-S24 e roda os testes
npm run wdio:fresh

# Roda os testes sem reinstalar o app
npm run wdio:android
```

### iOS (Device Farm Remote Access)

1. Abra uma sessão de **Remote Access** no AWS Device Farm e selecione um device iOS.
2. Instale o IPA manualmente na sessão antes de executar.
3. Copie os dados de conexão (hostname, porta e remote path) para o `.env`.
4. Execute:

```bash
npm run wdio:ios
```

O relatório Allure é gerado e aberto no browser ao final da execução.

---

## Relatórios

```bash
# Gera e abre o relatório Allure (após execução local)
npm run report:allure

# Exibe o CTRF JSON resumido
npm run report:ctrf
```

Relatórios de execuções CI ficam publicados no branch `reports` via GitHub Pages.

---

## CI/CD — GitHub Actions

O workflow `.github/workflows/mobile_test.yml` executa dois jobs em paralelo a cada `push` ou `pull_request`:

- **Job Android** — baixa APK do EAS, sobe para o Device Farm, roda no pool Android (`DEVICE_FARM_DEVICE_POOL_ARN`)
- **Job iOS** — baixa IPA do EAS, sobe para o Device Farm, roda no pool iOS (`DEVICE_FARM_IOS_DEVICE_POOL_ARN`)
- **Job publish-report** — mescla os resultados Allure de ambas as plataformas e publica no branch `reports`

### GitHub Secrets necessários

| Secret | Propósito |
|---|---|
| `AWS_ACCESS_KEY_ID` | IAM key com permissão `devicefarm:*` |
| `AWS_SECRET_ACCESS_KEY` | IAM secret |
| `DEVICE_FARM_PROJECT_ARN` | ARN do projeto no Device Farm |
| `DEVICE_FARM_DEVICE_POOL_ARN` | Pool de devices Android |
| `DEVICE_FARM_IOS_DEVICE_POOL_ARN` | Pool de devices iOS |
| `CLIENT_USER` | Email de login do app |
| `CLIENT_PASSWORD` | Senha de login do app |
| `EXPO_TOKEN` | Token EAS para download de builds |
| `EXPO_PROJECT_ID` | UUID do projeto ecomm no EAS (expo.dev → projeto → Project Settings → Project ID) |

---

## Arquitetura

```
wdio.conf.ts          — configuração central (detecta plataforma por env vars)
testspec.yml          — Device Farm test spec para Android (CI)
testspec-ios.yml      — Device Farm test spec para iOS (CI, seta PLATFORM=ios)
test/
  specs/test.spec.ts  — suite de testes principal
  pageobjects/        — Page Object Model
    BasePage.ts       — base com utilitários de scroll, espera e debug
    HomePage.ts
    LoginPage.ts
    CategoriasPage.ts
    PerfilPage.ts
    FavoritosPage.ts
scripts/
  install-apk.mjs     — download + install do APK/AAB do EAS via GraphQL API
  generate-report-index.mjs — gera índice HTML do branch reports
```

### Flags de detecção de ambiente (`wdio.conf.ts`)

| Flag | Variável | Ativa quando |
|---|---|---|
| `isDeviceFarm` | `DEVICEFARM_DEVICE_UDID` | Rodando no Device Farm (CI) |
| `isIOS` | `PLATFORM=ios` | Target iOS — setado por `wdio:ios` ou `testspec-ios.yml` |
| `isRemote` | `isIOS && REMOTE_HOST` | iOS local via Device Farm Remote Access |
| `isCI` | `CI` | GitHub Actions |
