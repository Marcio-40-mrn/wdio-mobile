# STATE

Atualizado em **2026-09-03**.

## Onde o projeto está

Suíte Android passando ponta a ponta contra o AVD-S24, app **1.14.1 build 464**
(profile `production`, selecionado pelo `.env` via `BUILD_PROFILE_ANDROID`).

Próximo marco: **M3 — replicar a suíte no iOS**. Ver `ROADMAP.md`.

## Working tree

Branch `main`. Último commit: **`dd5a4b7` — "fix/Test Prod Version"**, que levou a suíte
corrigida do M1:

```
.build-info.json                   .gitignore
CLAUDE.md                          test/pageobjects/BasePage.ts
test/pageobjects/CategoriasPage.ts test/pageobjects/HomePage.ts
test/specs/test.spec.ts
```

Não commitado no momento:

| Arquivo | O que é |
|---|---|
| `.planning/` | esta estrutura, ainda não rastreada (`??`) |
| `CLAUDE.md` | seção "Memória do projeto: `.planning/`" e o bloco de sub-agents |
| `README.md` | seção "Planejamento e roadmap" e `.planning/` + `.claude/agents/` na Arquitetura |

Nenhum código de teste foi alterado nesta entrega — só documentação e estrutura.

## Decisões tomadas

- **O banner do Insider se fecha pelo `Close` do criativo, dentro da WebView.** O `closeBt`
  nativo (`[1054,63][1080,132]`) é decorativo: clicar nele não fecha nada. O `back()` do
  Android também não fecha. Testado com dump antes/depois.
- **O marcador de presença do banner é o `insiderLayout`, nunca o `htmlView`** — o `htmlView`
  some da árvore em alguns momentos mesmo com o banner visível.
- **`accessibility id:Camisas` existe** nesta versão (`sub-categories-button`); o seletor
  nunca foi o problema. O que engolia o clique era o overlay do banner.
- **A tela de listagem de produtos não tem a barra de abas** (nenhum `tab-*`). Só a tela de
  categorias tem. Por isso o `voltar()` antes do `abrirPerfil()` é obrigatório.
- **O `action-button` é o favoritar**, confirmado no print: o coração passa de contorno para
  vermelho preenchido. Mas o estado não aparece na árvore.

## Pendências abertas

- **Segundo banner.** O Marcio relatou dois criativos diferentes. Só o "INTERLÚDIO" foi
  capturado. Falta confirmar que o outro também é Insider (`insiderLayout` + `Close`) — se
  for, o `fechaBanner` atual já cobre os dois sem ajuste.
- **`clickFirstPresent` e o `abrirPerfil`** foram introduzidos fora do plano original. O dump
  confirma que nesta versão a aba é `Perfil` e na outra era `Menu`, então resolvem um
  problema real, mas a decisão de manter é do Marcio.
- **Uma camisa ficou favoritada na conta** durante a investigação manual
  (Camisa Manga Longa Slim em Tricoline Stretch Liso Branco). Desfavoritar antes de um run
  limpo, já que o teste favorita exatamente esse primeiro card.
