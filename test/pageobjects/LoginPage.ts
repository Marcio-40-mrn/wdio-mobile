import { BasePage, timewhait } from "./BasePage";
import { driver, $ } from '@wdio/globals'

export class LoginPage extends BasePage {

    async logar(email: string, senha: string) {
        const btnLogin = await $("-android uiautomator:new UiSelector().text(\"login\")");
        const inputEmail = await $("-android uiautomator:new UiSelector().text(\"Email\")");
        const inputPassword = await $("-android uiautomator:new UiSelector().text(\"Password\")");
        const btnSignIn = await $("accessibility id:Sign in");
        await this.waitForElement(btnLogin);
        await btnLogin.scrollIntoView();
        await btnLogin.click();
        await driver.pause(timewhait)
        await inputEmail.addValue(email);
        await inputPassword.addValue(senha);
        await btnSignIn.click();
    }
}

