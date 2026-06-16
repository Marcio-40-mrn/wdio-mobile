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

  async fechaBanner() {
  const element1 = await $("class name:android.webkit.WebView");
  const element2 = await $("-android uiautomator:new UiSelector().text(\"Close\")");

  if (await element2.isDisplayed().catch(() => false)) {
    await element1.click();
    await element2.click();
    await driver.pause(timewhait);
  }
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

// APP Android
// const el1 = await driver.$("accessibility id:linear-gradient");
// await el1.click();
// const el2 = await driver.$("-ios class chain:**/XCUIElementTypeStaticText[`name == \"Você precisa aceitar os termos de política de privacidade para continuar.\"`][2]");
// await el2.click();
// const el3 = await driver.$("-ios class chain:**/XCUIElementTypeStaticText[`name == \"Você precisa aceitar os termos de política de privacidade para continuar.\"`][2]");
// await el3.click();
// const el4 = await driver.$("accessibility id:accept-button");
// await el4.click();
// const el5 = await driver.$("accessibility id:accept-button");
// await el5.click();
// const el6 = await driver.$("accessibility id:accept-button");
// await el6.click();
// const el7 = await driver.$("accessibility id:tab-menu");
// await el7.click();
// const el8 = await driver.$("accessibility id:Register or login");
// await el8.click();
// const el9 = await driver.$("accessibility id:Email");
// await el9.addValue("marciorocha@maildrop.cc");
// const el10 = await driver.$("accessibility id:Password *");
// await el10.addValue("Maje1425");
// const el15 = await driver.$("accessibility id:Back");
// await el15.click();
// const el16 = await driver.$("accessibility id:Register or login");
// await el16.click();
// const el17 = await driver.$("accessibility id:Password *");
// await el17.addValue("Maje1425");
// const el18 = await driver.$("accessibility id:Email");
// await el18.addValue("marciorocha@maildrop.cc");
// const el19 = await driver.$("-ios class chain:**/XCUIElementTypeOther[`name == \"pressable\"`][1]");
// await el19.click();
