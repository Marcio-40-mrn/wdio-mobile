# PROJECT

Automação de testes E2E mobile do app **Aramis** (`com.aramis.ecomm`), escrita em
TypeScript com WebdriverIO + Appium.

## Stack

| Camada | Tecnologia |
|---|---|
| Runner | WebdriverIO 9 (`@wdio/cli`, `@wdio/local-runner`, `@wdio/mocha-framework`) |
| Driver Android | UiAutomator2 |
| Driver iOS | XCUITest |
| Relatórios | Allure (`@wdio/allure-reporter`) + CTRF (`wdio-ctrf-json-reporter`) |
| Distribuição do app | EAS / Expo, baixado por `scripts/install-apk.mjs` |
| CI | GitHub Actions + AWS Device Farm |

## Ambientes de execução

São três, e o `wdio.conf.ts` decide qual é por variável de ambiente:

| Ambiente | Como ativa | Appium | Observação |
|---|---|---|---|
| **Local Android** | padrão | subido pelo próprio WDIO (`@wdio/appium-service`) | AVD-S24, emulador do Marcio |
| **Device Farm Android** | `DEVICEFARM_DEVICE_UDID` | do host, iniciado pelo `testspec.yml` | CI |
| **Device Farm iOS** | `PLATFORM=ios` | do host, iniciado pelo `testspec-ios.yml` | CI |
| **iOS Remote Access** | `PLATFORM=ios` + `REMOTE_HOST` | da sessão remota | sessão manual no console da AWS |

As flags estão em `wdio.conf.ts`: `isDeviceFarm`, `isIOS`, `isRemote`, `isCI`.

## Onde as coisas saem

- Relatório Allure publicado no GitHub Pages, a partir da branch `reports`.
- `ctrf/ctrf-report.json` para consumo programático.
- Vídeo da execução anexado a cada teste no Allure.

## Estrutura

```
wdio.conf.ts           configuração central; detecta plataforma e ambiente
testspec.yml           test spec do Device Farm — Android
testspec-ios.yml       test spec do Device Farm — iOS (seta PLATFORM=ios)
test/
  specs/               a suíte
  pageobjects/         Page Object Model
  utils/               credenciais e nome amigável de device
scripts/               download/instalação do app e geração do índice de relatórios
.claude/agents/        sub-agents especializados
.planning/             memória persistente do projeto (este diretório)
```
