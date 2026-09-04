# ROADMAP

## M1 — Suíte Android estável ✅

Concluído em 2026-09-03.

- `fechaBanner` fecha o banner do Insider por **seletor** (`accessibility id:Close`, o botão
  do próprio criativo), esperando a WebView publicar a árvore, confirmando que o
  `insiderLayout` sumiu e repetindo o ciclo até 3 vezes. Nenhuma coordenada.
- O produto favoritado deixou de ser um nome fixo: `favoritarPrimeiroProduto()` pega a
  primeira camisa que a lista mostrar, lê o nome do `content-desc` do card e favorita ali
  mesmo, no `action-button`.
- Favoritando na listagem, o teste fica uma tela antes na navegação e um único `voltar()`
  chega em categorias, que é onde a aba Perfil existe.
- `abrirPerfil` aceita `Menu` ou `Perfil`, porque o id da aba muda entre versões do app.

## M2 — Inspeção de elementos padronizada 🔄

- ✅ `.claude/agents/android-ui-inspector.md` — inspeção Android via `adb`
  (`uiautomator dump` + `screencap`), com os tempos de espera medidos, a regra de nunca
  confiar em um dump só, e a armadilha do `MSYS_NO_PATHCONV` no Git Bash.
- ⬜ `ios-ui-inspector` — mesmo papel, mecanismo diferente. **No iOS não existe `adb`.** O
  equivalente é abrir sessão Appium contra o endpoint Remote Access e usar
  `driver.getPageSource()` (árvore XCUITest) e `driver.takeScreenshot()`.
  Criar **depois** da primeira sessão real no iPhone, com a árvore na mão em vez de
  suposição — foi assim que o agente Android ficou útil.

## M3 — Replicar a suíte no iOS ⬜

O foco atual. A infraestrutura já existe (`npm run wdio:ios`, `testspec-ios.yml`,
capabilities XCUITest no `wdio.conf.ts`, variáveis no `.env`). **O bloqueio são os
seletores dos page objects.** Inventário atual, 31 seletores:

| Tipo | Qtd | Situação no iOS |
|---|---|---|
| `-android uiautomator:` | 14 | não funciona — precisa de equivalente XCUITest |
| `id:` (resource-id Android) | 5 | não funciona — inclui ids do sistema (`android:id/button1`, `com.android.permissioncontroller:...`) |
| `accessibility id:` | 12 | sintaxe funciona nas duas plataformas, mas **o valor precisa ser confirmado** no iOS |

Ou seja, 19 dos 31 são Android-only, e os 12 restantes não podem ser presumidos.

Passos:

1. O Marcio abre uma sessão de **Remote Access no AWS Device Farm num device iPhone** e
   instala o IPA na sessão.
2. Preenche `REMOTE_HOST`, `REMOTE_PORT` e `REMOTE_PATH_IOS` no `.env`.
3. O sub-agent de inspeção iOS percorre cada tela do fluxo do M1 e, para cada uma: aguarda o
   carregamento, captura screenshot e árvore XCUITest, e escreve **um draft por tela** com
   os elementos expostos (`name`, `label`, `value`, `type`, `rect`, `enabled`, `visible`).
4. Com os drafts, os page objects passam a resolver o seletor por plataforma, mantendo um
   método por ação. **O `test/specs/test.spec.ts` não muda** — o fluxo iOS é exatamente o
   mesmo que roda hoje no Android.
5. A suíte roda no iOS ponta a ponta.

Pontos de atenção já conhecidos para o iOS:

- O banner do Insider provavelmente também aparece; o `Close` do criativo é WebView nas duas
  plataformas, mas o seletor nativo (`insiderLayout`, `closeBt`) é Android. O equivalente iOS
  precisa ser levantado, não presumido.
- `autoAcceptAlerts: true` já está nas capabilities iOS, então os diálogos de permissão
  seguem caminho diferente do Android — a sequência `ativarApp()` provavelmente muda.

## M4 — Paridade em CI ⬜

`testspec-ios.yml` rodando no workflow ao lado do Android, com relatório Allure único
cobrindo as duas plataformas e cada device identificado.

## M5 — Cobertura além do favoritar ⬜

O fluxo de compra rascunhado em `test/Draft.ts`: adicionar à sacola → escolher tamanho →
endereço → cartão → finalizar compra.
