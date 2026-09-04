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

    async abrirCamisas() {
        const element = await $("accessibility id:Camisas");
        // const element = await $('//*[@text="Camisas" or @content-desc="Camisas"]');
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

    // Favorita a primeira camisa que a lista mostrar, direto no card, e devolve o nome para a
    // validação nos favoritos usar depois. Amarrar o teste a um nome fixo não funciona: o
    // catálogo muda entre versões e o UiSelector().text() é match exato.
    //
    // Favoritar aqui, e não na página do produto, deixa o teste uma tela antes na navegação:
    // um único voltar() já chega em categorias, que é a tela onde a aba Perfil existe (a
    // listagem não tem tab-* nenhum).
    //
    // ATENÇÃO: o estado favoritado NÃO é exposto na árvore de acessibilidade. Depois do
    // clique o action-button continua com selected="false", checked="false" e content-desc
    // vazio — só o pixel do coração muda de contorno para vermelho. Não dá para assertar
    // "favoritou" nesta tela; a validação é na tela de Favoritos.
    //
    // O nome sai do content-desc do card, que vem como "Nome, R$ preço"; o preço é cortado
    // para sobrar o texto que a tela de favoritos exibe.
    //
    // descriptionMatches em vez de description() porque description() é match exato; o
    // "{10,}" descarta o título da tela ("Camisas", 7 caracteres), que também é clicável e
    // aparece antes dos produtos na árvore.
    async favoritarPrimeiroProduto(): Promise<string> {
        // Timeout folgado: a lista tem 150 produtos e demora a montar depois do clique na
        // categoria — com os 20s do waitForElement ela terminava de aparecer junto com o estouro.
        const card = await $('-android uiautomator:new UiSelector().descriptionMatches("Camisa.{10,}").instance(0)');
        await card.waitForDisplayed({ timeout: 40000 });

        const descricao = (await card.getAttribute('content-desc')) ?? '';
        const nome = descricao.replace(/,\s*R\$[\s\S]*$/, '').trim();
        console.log(`🛍 Produto escolhido: ${nome}`);

        // A lista segue hidratando depois do primeiro card aparecer; sem esta pausa o clique
        // sai cedo demais e o coração não reage.
        await driver.pause(timewhait);

        const coracao = await $('-android uiautomator:new UiSelector().resourceId("action-button").instance(0)');
        await coracao.waitForDisplayed({ timeout: 20000 });
        await coracao.click();
        await driver.pause(timewhait);

        return nome;
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

