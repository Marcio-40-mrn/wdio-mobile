import { BasePage, timewhait, scrollUntilVisible } from "./BasePage";
import { driver, $ } from '@wdio/globals'

export class PerfilPage extends BasePage {

    async abrirFavoritos() {
        const element = await $("accessibility id:Favorites, Manage your interests");
        await this.waitForElement(element);
        await element.click();
        await driver.pause(timewhait);
    }

    async logout() {
        const element = await $("accessibility id:Logout");
        await scrollUntilVisible(element);
        await element.click();
        await driver.pause(timewhait);
    }

    async confirmarLogout() {
        const element = await $("id:android:id/button1");
        await scrollUntilVisible(element);
        await element.click();
        await driver.pause(timewhait);
    }

}
