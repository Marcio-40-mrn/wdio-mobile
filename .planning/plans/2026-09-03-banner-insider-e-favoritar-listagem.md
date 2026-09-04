# Banner do Insider e favoritar na listagem

**Status:** concluído em 2026-09-03. Teste passando ponta a ponta.

## Problema

O teste quebrava no meio do fluxo. Duas causas independentes:

1. O banner do Insider não era fechado. O `fechaBanner` lia os bounds do `closeBt` nativo e
   tocava numa coordenada calculada (`x - largura`, centro vertical), na suposição de que o
   "X" real ficava a uma largura à esquerda. Não conferia o resultado. Com o banner aberto, o
   `htmlView` cobre a tela inteira e engole todo clique — mas o `uiautomator` continua
   reportando os elementos de trás como `displayed`, então o `waitForDisplayed` passava e o
   clique ia para o WebView.
2. O produto favoritado estava preso a um nome fixo, procurado com `UiSelector().text()`, que
   é match exato. O nome não existia mais no catálogo.

## Evidência (AVD-S24, 1080x2340, app 1.14.1 build 464)

| Ação | Coordenada | Resultado |
|---|---|---|
| `click()` no `closeBt` nativo | (1067, 97) | não fecha — inerte |
| `back()` do Android | — | não fecha |
| Clique no `Close` do criativo | (879, 832) | **fecha** |

O `Close` só entra na árvore alguns segundos depois do banner aparecer; antes disso o
`htmlView` vem com `NAF="true"` e zero filhos.

## Solução

- `fechaBanner` detecta pelo `insiderLayout`, aguarda `accessibility id:Close`, clica,
  confirma que o `insiderLayout` sumiu, repete até 3 vezes e lança erro se não fechar.
- `favoritarPrimeiroProduto()` pega a primeira camisa da lista, lê o nome do `content-desc`,
  pausa para a lista terminar de hidratar e clica no `action-button` do card.
- O nome capturado é o que a validação nos favoritos procura.
- Um único `voltar()`, porque favoritar na listagem deixa o teste uma tela antes.
