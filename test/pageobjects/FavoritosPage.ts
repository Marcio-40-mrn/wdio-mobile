import { BasePage, timewhait, scrollUntilVisible } from "./BasePage";
import { driver, $ } from '@wdio/globals'


export class FavoritosPage extends BasePage {

    async tirarSelecaoItem() {
        const element = await $("-android uiautomator:new UiSelector().className(\"com.horcrux.svg.PathView\").instance(2)");
        await this.waitForElement(element); 
        await element.click();
        await driver.pause(timewhait);
    }

    async validaElememnto(texto: string) {
        const element = await $(`-android uiautomator:new UiSelector().text(\"${texto}\")`);
        // Rola até o item aparecer na lista de favoritos antes de validar (item pode estar
        // abaixo da dobra). elementVisible sozinho não rolava — causa da falha histórica.
        await scrollUntilVisible(element);
        await this.elementVisible(element);
    }


}


