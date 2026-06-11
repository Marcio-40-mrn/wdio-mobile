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
    const element = await $("-android uiautomator:new UiSelector().className(\"android.view.View\").instance(0)");
    await this.waitForElement(element);
    await element.click();
    await driver.pause(timewhait);
  }

  async ativaGps() {
    const element = await $("id:com.android.permissioncontroller:id/permission_allow_one_time_button");
    await this.waitForElement(element);
    await element.click();
    await driver.pause(timewhait);
  }

  async permiteNotificacao() {
    const element = await $("id:com.android.permissioncontroller:id/permission_allow_button");
    await this.waitForElement(element);
    await element.click();
    await driver.pause(timewhait);
  }

  async negaNotificacao() {
    const element = await $("id:com.android.permissioncontroller:id/permission_deny_button");
    await this.waitForElement(element);
    await element.click();
    await driver.pause(timewhait);
  }

  async continua() {
    const element = await $("accessibility id:Continue");
    await this.waitForElement(element); 
    await element.click();
    await driver.pause(timewhait);
  }

  async termo1() {
    const element = await $("accessibility id:I have read and agree");
    await forceScrollBeforeSearching(6);
    await scrollUntilVisible(element);
    await element.click();
    await driver.pause(timewhait);
  }

  async termos2() {
    const element = await $("accessibility id:I have read and agree");
    await forceScrollBeforeSearching(5);
    await scrollUntilVisible(element);
    await element.click();
    await driver.pause(timewhait);
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

  await driver.releaseActions();
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

// APP IOS
// await driver.action('pointer')
//   .move({ duration: 0, x: 263, y: 510 })
//   .down({ button: 0 })
//   .pause(50)
//   .up({ button: 0 })
//   .perform();

// const el1 = await driver.$("accessibility id:linear-gradient");
// await el1.click();
// const el2 = await driver.$("-ios class chain:**/XCUIElementTypeStaticText[`name == \"Você precisa aceitar os termos de política de privacidade para continuar.\"`][2]");
// await el2.click();
// const el3 = await driver.$("-ios class chain:**/XCUIElementTypeStaticText[`name == \"Você precisa aceitar os termos de política de privacidade para continuar.\"`][2]");
// await el3.click();
// const el4 = await driver.$("xpath:(//XCUIElementTypeOther[@name=\"Horizontal scroll bar, 1 page\"])[2]");
// await el4.click();
// const el5 = await driver.$("xpath:(//XCUIElementTypeOther[@name=\"Horizontal scroll bar, 1 page\"])[2]");
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
// const el16 = await driver.$("-ios class chain:**/XCUIElementTypeOther[`name == \"pressable\"`][1]");
// await el16.click();
// const el17 = await driver.$("-ios class chain:**/XCUIElementTypeOther[`name == \"pressable\"`][1]");
// await el17.click();
// const el18 = await driver.$("-ios class chain:**/XCUIElementTypeOther[`name == \"Forgot your password? Sign in Sign in with access code Not registered yet? Create Account\"`]/XCUIElementTypeOther[4]");
// await el18.addValue("Maje1425");