import { BasePage, timewhait } from "./BasePage";
import { driver, $ } from '@wdio/globals'

export class HomePage extends BasePage {

    async ativarApp() {
        if (process.env.PLATFORM === 'ios') {
            // TODO: passos de inicialização iOS
        } else {
            await this.iniciaApp();
            await this.ativaGps();
            await this.permiteNotificacao();
            await this.continua();
            // await this.negaNotificacao();
            // await this.continua();
            await this.termo1();
            await this.termos2();
        }
    }

    // async abrirPerfil() {
    //     const element = await $("accessibility id:Menu");
    //     await this.waitForElement(element);
    //     await element.click();
    //     await driver.pause(timewhait);
    // }

    async abrirPerfil() {
        const element = await $("accessibility id:Perfil");
        await this.waitForElement(element);
        await element.click();
        await driver.pause(timewhait);
    }


    async abrirCategorias() {
        const element = await $("accessibility id:Categorias");
        await this.waitForElement(element);
        await element.click();
        await driver.pause(timewhait);
    }

}


