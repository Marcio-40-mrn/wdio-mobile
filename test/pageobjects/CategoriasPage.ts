import { BasePage, timewhait } from "./BasePage";
import { driver, $ } from '@wdio/globals'

export class CategoriasPage extends BasePage {

    async selecionarMangaCurta() {
        const element = await $('-android uiautomator:new UiSelector().text("Manga curta ")');
        await this.waitForElement(element);
        await element.scrollIntoView();
        await element.click();
        await driver.pause(timewhait);
    }

    async clickRoupas() {
        const element = await $("accessibility id:Roupas");
        await this.waitForElement(element);
        await element.scrollIntoView();
        await element.click();
        await driver.pause(timewhait);
    }

    async abrirCamisetas() {
        const element = await $("accessibility id:Camisas");
        await this.waitForElement(element);
        await element.scrollIntoView();
        await element.click();
        await driver.pause(timewhait);
    }

    async selecionarProduto(texto: string) {
        const element = await $(`-android uiautomator:new UiSelector().text(\"${texto}\")`);
        await this.waitForElement(element);
        await element.scrollIntoView();
        await element.click();
        await driver.pause(timewhait);
    }

    async validaElememnto(texto: string) {
        const element = await $(`-android uiautomator:new UiSelector().text(\"${texto}\")`);
        await this.elementVisible(element);
    }

    async selecionarTipo() {
        const element = await $("-android uiautomator:new UiSelector().text(\"Casual\")");
        await this.waitForElement(element);
        await element.scrollIntoView();
        await element.click();
        await driver.pause(timewhait);
    }

    async adicionarItemFavoritos() {
        const element = await $("-android uiautomator:new UiSelector().className(\"com.horcrux.svg.PathView\").instance(2)");
        await this.waitForElement(element);
        await element.scrollIntoView();
        await element.click();
        await driver.pause(timewhait);
    }

    async voltar() {
        const element = await $("-android uiautomator:new UiSelector().className(\"com.horcrux.svg.PathView\").instance(0)");
        await this.waitForElement(element);
        await element.scrollIntoView();
        await element.click();
        await driver.pause(timewhait);
    }

}

// const el4 = await driver.$("-android uiautomator:new UiSelector().text(\"Camisa Manga Longa Slim Poliviscose de Bambu Stretch Branco\")");
// await el4.click();
// const el5 = await driver.$("-android uiautomator:new UiSelector().className(\"com.horcrux.svg.SvgView\").instance(0)");
// await el5.click();
// const el4 = await driver.$("id:com.aramis.ecomm:id/buttonContainer");
// await el4.click();
// const el5 = await driver.$("");
// await el5.click();
// const el6 = await driver.$("accessibility id:Back");
// await el6.click();





