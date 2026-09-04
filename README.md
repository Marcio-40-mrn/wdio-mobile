# Mobile E2E Test Suite

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

# Seleção do build no EAS (opcionais — ver tabela abaixo)
BUILD_PROFILE_ANDROID=development
BUILD_PROFILE_IOS=development
BUILD_SELECTION=latest
BUILD_FROM=YYYY-MM-DD
BUILD_TO=YYYY-MM-DD

# iOS local via Device Farm Remote Access (apenas para npm run wdio:ios)
REMOTE_HOST=<hostname da sessão remota>
REMOTE_PORT=<porta, ex: 4723>
REMOTE_PATH_IOS=<Remote Path do Appium Inspector, ex: /wd/hub>
```

> `REMOTE_HOST`, `REMOTE_PORT` e `REMOTE_PATH_IOS` só são usados quando `PLATFORM=ios` está ativo. Não afetam execuções Android.

### Qual build do EAS é baixado

Todas as variáveis abaixo são **opcionais**. Sem nenhuma delas o comportamento é o histórico:
profile `development` e o build **FINISHED mais recente**.

| Variável | Valores | Default | Efeito |
|---|---|---|---|
| `BUILD_PROFILE_ANDROID` | nome do profile no `eas.json` (`development`, `preview`, `production`…) | `development` | Profile usado nas execuções Android |
| `BUILD_PROFILE_IOS` | idem | `development` | Profile usado com `--platform ios` (Android e iOS podem estar em profiles diferentes) |
| `BUILD_PROFILE` | idem | — | Fallback comum às duas plataformas, quando a variável específica não está definida |
| `BUILD_SELECTION` | `latest` ou `date` | `latest` | `latest`: build mais recente. `date`: mais recente dentro do intervalo |
| `BUILD_FROM` | `YYYY-MM-DD` | — | Início do intervalo (inclusivo). Só vale com `BUILD_SELECTION=date` |
| `BUILD_TO` | `YYYY-MM-DD` | — | Fim do intervalo (inclusivo, até 23:59:59 do dia) |

O literal `YYYY-MM-DD` (e valores vazios) conta como **não preenchido** — dá para deixar o
placeholder no `.env` sem afetar o modo `latest`. Com `BUILD_SELECTION=date` é obrigatório
preencher `BUILD_FROM` e/ou `BUILD_TO`; para um dia único, use a mesma data nos dois.

> **Limitação do modo `date`:** a consulta ao EAS traz os **20 builds mais recentes** da
> plataforma. Se o intervalo for antigo demais para caber nesses 20, o script encerra com erro
> e lista os builds que encontrou, para você ajustar as datas.

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
| `CLIENT_USER` | Email de login do app (fallback local / single device) |
| `CLIENT_PASSWORD` | Senha de login do app (comum a todas as contas) |
| `CLIENT_USERS_ANDROID_EMAILS` | CSV dos emails das contas Android (1 por device, na ordem do pool) — ver "Conta distinta por device" |
| `CLIENT_USERS_IOS_EMAILS` | CSV dos emails das contas iOS (1 por device, na ordem do pool) |
| `EXPO_TOKEN` | Token EAS para download de builds |
| `EXPO_PROJECT_ID` | UUID do projeto ecomm no EAS (expo.dev → projeto → Project Settings → Project ID) |

Além dos secrets, a esteira lê as variáveis de seleção de build como **Repo Variables**
(Settings → Secrets and variables → Actions → aba **Variables**, não são secrets):
`BUILD_PROFILE_ANDROID`, `BUILD_PROFILE_IOS`, `BUILD_SELECTION`, `BUILD_FROM` e `BUILD_TO`.
Todas opcionais — variável não cadastrada chega vazia ao script e cai no default
(`development` + build mais recente), então a esteira roda igual sem nenhuma configuração nova.

### Conta distinta por device (multiusuário no Device Farm)

No Device Farm o pool roda vários devices em paralelo. Se todos logarem com a mesma
conta, eles disputam o mesmo produto na tela de Favoritos (um adiciona / outro remove)
e o teste falha de forma intermitente. Para evitar isso, **cada device usa uma conta
distinta**, escolhida em runtime pelo modelo do aparelho:

- As variáveis de ambiente do Device Farm são globais ao run (todos os devices recebem
  as mesmas), então a lista de contas viaja num CSV único por plataforma
  (`CLIENT_USERS_EMAILS`), com a **senha comum** em `CLIENT_PASSWORD`.
- `test/utils/device-index.ts` mapeia o **modelo** do device (`browser.capabilities.deviceModel`,
  ex.: `SM-S918U1`) → índice na lista. `test/utils/credentials.ts` casa por prefixo e
  devolve `emails[index]`. Log em runtime: `🔑 Device model "…" -> conta[N] = email`.
- O CSV é transportado em **texto puro** (não base64): o Device Farm limita cada env var
  a 256 caracteres e o base64 do JSON das contas estourava esse limite.

Os secrets `CLIENT_USERS_ANDROID_EMAILS` / `CLIENT_USERS_IOS_EMAILS` recebem apenas o CSV
de emails. **A ordem dos emails define o índice da conta e precisa casar com `device-index.ts`:**

| Índice | Android (`device-index.ts`) | iOS (`device-index.ts`) |
|---|---|---|
| 0 | Galaxy S23 Ultra (`SM-S918`) | iPhone 13 (`A2482`) |
| 1 | Galaxy S23+ (`SM-S916`) | iPhone 14 (`A2649`) |
| 2 | Galaxy S24 Ultra (`SM-S928`) | iPhone 14 Pro Max (`A2651`) |
| 3 | Galaxy S24+ (`SM-S926`) | iPhone 15 (`A2846`) |
| 4 | Galaxy S25 Ultra (`SM-S938`) | iPhone 15 Pro Max (`A2849`) |
| 5 | Galaxy S26 Ultra (`SM-S948`) | — |

> Se um device não casar nenhum prefixo, cai em `conta[0]` (com `warn` no log) — ajuste
> o mapa antes de confiar na unicidade. O mapeamento iOS é best-effort e ainda não foi
> verificado em runtime.

---

## Planejamento e roadmap

O planejamento do projeto fica em [`.planning/`](.planning/), no padrão GSD, como memória
persistente entre sessões:

- **[`ROADMAP.md`](.planning/ROADMAP.md)** — os marcos. O próximo é **replicar a suíte no
  iOS**, usando uma sessão de Remote Access do AWS Device Farm num device iPhone para
  levantar os elementos de cada tela e rodar exatamente o mesmo fluxo que roda hoje no
  Android.
- **[`STATE.md`](.planning/STATE.md)** — onde o projeto está agora e o que está pendente.
- **[`REQUIREMENTS.md`](.planning/REQUIREMENTS.md)** — o fluxo coberto e as regras que não
  podem ser quebradas.
- **[`PROJECT.md`](.planning/PROJECT.md)** — stack e os quatro ambientes de execução.

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
.planning/            — memória persistente do projeto (padrão GSD)
  PROJECT.md          — stack e ambientes de execução
  REQUIREMENTS.md     — fluxo coberto, critérios de aceite e regras invioláveis
  ROADMAP.md          — marcos: o que está feito e o que vem a seguir
  STATE.md            — estado atual e pendências abertas
  plans/              — um arquivo por iniciativa
.claude/agents/       — sub-agents especializados
  android-ui-inspector.md — inspeção de elementos Android via adb
```

### Flags de detecção de ambiente (`wdio.conf.ts`)

| Flag | Variável | Ativa quando |
|---|---|---|
| `isDeviceFarm` | `DEVICEFARM_DEVICE_UDID` | Rodando no Device Farm (CI) |
| `isIOS` | `PLATFORM=ios` | Target iOS — setado por `wdio:ios` ou `testspec-ios.yml` |
| `isRemote` | `isIOS && REMOTE_HOST` | iOS local via Device Farm Remote Access |
| `isCI` | `CI` | GitHub Actions |

---

