import type { ChainablePromiseElement } from 'webdriverio';


export class BasePage {
  private defaultTimeout = 20000;

  async waitForElement(element: unknown, timeout = this.defaultTimeout) {
    const resolvedElement = (await (element as any)) as WebdriverIO.Element;
    if (!resolvedElement || typeof resolvedElement.waitForDisplayed !== 'function') {
      throw new Error('Elemento inválido passado para waitForElement');
    }

    await resolvedElement.waitForDisplayed({ timeout });
  }

  // Clica no elemento apenas se ele aparecer dentro do timeout; caso contrário pula o passo
  // sem derrubar o teste. Usado nos passos de abertura/permissão que podem não surgir em
  // todos os devices (ex.: permissão já concedida, telas de onboarding variando por SO).
  async clickIfPresent(selector: string, timeout = 8000): Promise<boolean> {
    const el = await $(selector);
    const shown = await el.waitForDisplayed({ timeout }).then(() => true).catch(() => false);
    if (!shown) {
      console.log(`⏭️ Passo opcional pulado (não exibido): ${selector}`);
      return false;
    }
    await el.click();
    await driver.pause(timewhait);
    return true;
  }

  // Clica no primeiro seletor que estiver na tela. Existe porque um mesmo elemento pode ter
  // accessibility id diferente entre versões do app (ex.: a aba de perfil da barra inferior,
  // "Menu" na versão com ícone de mochila e "Perfil" na versão com ícone de sacola). Assim os
  // dois ids ficam registrados e o teste usa o que a versão instalada expõe.
  async clickFirstPresent(selectors: string[], timeout = this.defaultTimeout): Promise<string> {
    const deadline = Date.now() + timeout;

    do {
      for (const selector of selectors) {
        const el = await $(selector);
        if (await el.isDisplayed().catch(() => false)) {
          console.log(`✅ Seletor encontrado: ${selector}`);
          await el.click();
          await driver.pause(timewhait);
          return selector;
        }
      }
      await driver.pause(500);
    } while (Date.now() < deadline);

    throw new Error(`Nenhum dos seletores apareceu em ${timeout}ms: ${selectors.join(' | ')}`);
  }

  // Banner do Insider: o botão nativo closeBt é decorativo (clicar nele não fecha nada) e o
  // back() do Android também não fecha. Quem fecha é o botão do próprio criativo, dentro da
  // WebView, exposto como accessibility id "Close". A WebView leva alguns segundos para
  // publicar a árvore de acessibilidade: antes disso o htmlView vem com NAF="true" e sem
  // filhos, e o "Close" simplesmente não existe — por isso esperamos por ele em vez de
  // consultar uma única vez. Nada de tocar em coordenada: o card tem "Open App" cobrindo a
  // imagem e o CTA "Ver coleção", então um toque que erre o alvo navega para o promo.
  async fechaBanner() {
    const overlay = "id:com.aramis.ecomm:id/insiderLayout";
    const botaoFechar = "accessibility id:Close";

    for (let tentativa = 1; tentativa <= 3; tentativa++) {
      // Sem banner na tela o método custa uma consulta e retorna: roda antes de todo step.
      if (!(await this.bannerNaTela(overlay))) return;

      const close = await $(botaoFechar);
      const apareceu = await close
        .waitForDisplayed({ timeout: 10000 })
        .then(() => true)
        .catch(() => false);

      if (!apareceu) {
        console.log(`⏳ Banner na tela mas o "Close" não apareceu (tentativa ${tentativa}/3)`);
        continue;
      }

      await close.click();

      const fechou = await driver
        .waitUntil(async () => !(await this.bannerNaTela(overlay)), { timeout: 5000, interval: 500 })
        .then(() => true)
        .catch(() => false);

      if (fechou) {
        console.log(`✅ Banner fechado (tentativa ${tentativa}/3)`);
        await driver.pause(timewhait);
        // Não retorna: pode haver um segundo criativo enfileirado atrás do primeiro.
        continue;
      }

      console.log(`⚠ Clique no "Close" não fechou o banner (tentativa ${tentativa}/3)`);
    }

    if (await this.bannerNaTela(overlay)) {
      throw new Error('Banner do Insider não fechou após 3 tentativas de clicar em "Close"');
    }
  }

  // Presença do banner pelo insiderLayout: o htmlView some do dump em alguns momentos mesmo
  // com o banner visível na tela, então ele não serve de marcador.
  private async bannerNaTela(overlay: string): Promise<boolean> {
    const el = await $(overlay);
    return el.isDisplayed().catch(() => false);
  }


  async iniciaApp() {
    await this.clickIfPresent("-android uiautomator:new UiSelector().className(\"android.view.View\").instance(0)");
  }

  async ativaGps() {
    await this.clickIfPresent("id:com.android.permissioncontroller:id/permission_allow_one_time_button");
  }

  async permiteNotificacao() {
    await this.clickIfPresent("id:com.android.permissioncontroller:id/permission_allow_button");
  }

  async negaNotificacao() {
    await this.clickIfPresent("id:com.android.permissioncontroller:id/permission_deny_button");
  }

  async continua() {
    await this.clickIfPresent("accessibility id:Continue");
  }

  async termo1() {
    const element = await $("accessibility id:I have read and agree");
    await forceScrollBeforeSearching(6);
    const found = await scrollUntilVisible(element);
    if (found) {
      await element.click();
      await driver.pause(timewhait);
    } else {
      console.log("⏭️ termo1 pulado (não encontrado após scrolls)");
    }
  }

  async termos2() {
    const element = await $("accessibility id:I have read and agree");
    await forceScrollBeforeSearching(5);
    const found = await scrollUntilVisible(element);
    if (found) {
      await element.click();
      await driver.pause(timewhait);
    } else {
      console.log("⏭️ termos2 pulado (não encontrado após scrolls)");
    }
  }

  async debugContextAndSource() {
    console.log('=== CONTEXTOS ===');
    console.log(await driver.getContext());
    console.log(await driver.getContexts());

    console.log('\n=== PAGE SOURCE (primeiros 3000 chars) ===');
    const source = await driver.getPageSource();
    console.log(source.slice(0, 3000));
  }


  async elementVisible(element: ChainablePromiseElement): Promise<void> {
    await expect(element).toBeDisplayed();
  }

}

export const scrollFinger = async () => {
  const { width, height } = await driver.getWindowRect();

  const startX = width * 0.448;   // 44.8%
  const startY = height * 0.817;  // 81.7%
  const endX   = width * 0.508;   // 50.8%
  const endY   = height * 0.146;  // 14.6%

  await driver.performActions([
    {
      type: 'pointer',
      id: 'finger1',
      parameters: { pointerType: 'touch' },
      actions: [
        { type: 'pointerMove', duration: 0, x: startX, y: startY },
        { type: 'pointerDown', button: 0 },
        { type: 'pointerMove', duration: 800, x: endX, y: endY },
        { type: 'pointerUp', button: 0 }
      ]
    }
  ]);

  // releaseActions (DELETE /actions) não é suportado em alguns Appium (ex.: AWS Device Farm) e
  // lança "unknown command". O gesto já foi aplicado pelo performActions; ignorar a falha aqui.
  try {
    await driver.releaseActions();
  } catch {
    // no-op: endpoint ausente nesse host
  }
};


export const scrollUntilVisible = async (
    element: ChainablePromiseElement,
    maxScrolls: number = 14
  ) => {
    let scrollCount = 0;
  
    while (scrollCount < maxScrolls) {
      const isVisible = await element.isDisplayed().catch(() => false);
  
      console.log(`🔎 Tentativa ${scrollCount + 1}/${maxScrolls} — visível?`, isVisible);
  
      if (isVisible) {
        console.log("✨ Elemento encontrado!");
        return true;
      }
  
      await scrollFinger();
      await driver.pause(500);
  
      scrollCount++;
    }
  
    console.warn("⚠ Elemento NÃO encontrado após todos os scrolls.");
    return false;
};

export const forceScrollBeforeSearching = async (scrolls: number = 6) => {
  for (let i = 0; i < scrolls; i++) {
    console.log(`🔄 Scroll obrigatório ${i + 1}/${scrolls}`);
    await scrollFinger();
    await driver.pause(300);
  }
};

export const timewhait = 3000;

