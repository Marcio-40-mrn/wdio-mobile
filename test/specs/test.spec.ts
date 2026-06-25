import { HomePage } from "../pageobjects/HomePage";
import { LoginPage } from "../pageobjects/LoginPage";
import { CategoriasPage } from "../pageobjects/CategoriasPage";
import { PerfilPage } from "../pageobjects/PerfilPage";
import { FavoritosPage } from "../pageobjects/FavoritosPage";
import allure from '@wdio/allure-reporter';
import { Status } from 'allure-js-commons';

// npx wdio run ./wdio.conf.js --spec ./test/specs/test.spec.ts

async function step(name: string, fn: () => Promise<void>) {
    allure.startStep(name);
    try {
        await fn();
        allure.endStep(Status.PASSED);
    } catch (e) {
        allure.endStep(Status.FAILED);
        throw e;
    }
}

describe('Teste Login e Perfil', () => {
    it('Adiciona produto em favoritos e valida adição', async () => {
        const homePage = new HomePage();
        const loginPage = new LoginPage();
        const categoriaPage = new CategoriasPage();
        const perfilPage = new PerfilPage();
        const favoritosPage = new FavoritosPage();

        await step('homePage.ativarApp()', () => homePage.ativarApp());
        await step('homePage.abrirPerfil()', () => homePage.abrirPerfil());

        await step('loginPage.logar()', () => loginPage.logar(process.env.CLIENT_USER!, process.env.CLIENT_PASSWORD!));
        // await step('categoriaPage.voltar() - categoria', () => categoriaPage.voltar());
        await step('homePage.abrirCategorias()', () => homePage.abrirCategorias());
        await step('homePage.fechaBanner()', () => homePage.fechaBanner());

        await step('categoriaPage.clickRoupas()', () => categoriaPage.clickRoupas());
        await step('homePage.fechaBanner()', () => homePage.fechaBanner());
        await step('categoriaPage.abrirCamisetas()', () => categoriaPage.abrirCamisetas());
        await step('categoriaPage.selecionarProduto()', () => categoriaPage.selecionarProduto("Camisa Manga Longa Slim Poliviscose de Bambu Stretch Branco"));
        await step('categoriaPage.adicionarItemFavoritos()', () => categoriaPage.adicionarItemFavoritos());
        await step('categoriaPage.voltar() - página do produto', () => categoriaPage.voltar());
        await step('categoriaPage.voltar() - categoria', () => categoriaPage.voltar());

        await step('homePage.abrirPerfil()', () => homePage.abrirPerfil());
        await step('perfilPage.abrirFavoritos()', () => perfilPage.abrirFavoritos());

        await step('favoritosPage.validaElememnto()', () => favoritosPage.validaElememnto("Camisa Manga Longa Slim Poliviscose de Bambu Stretch Branco"));
        await step('favoritosPage.tirarSelecaoItem()', () => favoritosPage.tirarSelecaoItem());

        await step('categoriaPage.voltar()', () => categoriaPage.voltar());

        await step('homePage.abrirPerfil()', () => homePage.abrirPerfil());
        await step('perfilPage.logout()', () => perfilPage.logout());
        await step('perfilPage.confirmarLogout()', () => perfilPage.confirmarLogout());
    });

});
