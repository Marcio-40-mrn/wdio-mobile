import { HomePage } from "../pageobjects/HomePage";
import { LoginPage } from "../pageobjects/LoginPage";
import { CategoriasPage } from "../pageobjects/CategoriasPage";
import { PerfilPage } from "../pageobjects/PerfilPage";
import { FavoritosPage } from "../pageobjects/FavoritosPage";
import { getCredentials } from "../utils/credentials";
import { friendlyDeviceName } from "../utils/device-name";
import allure, { addHistoryId, addTestCaseId } from '@wdio/allure-reporter';
import { Status } from 'allure-js-commons';

// npx wdio run ./wdio.conf.js --spec ./test/specs/test.spec.ts

// Fechador de banner injetado no início de cada it(); usado pelo step() para tentar
// dispensar o banner do Insider ANTES de cada passo. O banner pode surgir a qualquer
// momento após o login, então em vez de espalhar chamadas manuais, todo passo tenta
// fechá-lo primeiro. É no-op quando o banner não está visível (fechaBanner checa isDisplayed).
let closeBannerIfPresent: (() => Promise<void>) | null = null;

async function step(name: string, fn: () => Promise<void>) {
    allure.startStep(name);
    try {
        if (closeBannerIfPresent) {
            await closeBannerIfPresent();
        }
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

        const { user, password } = getCredentials();

        // O nome sai da tela em runtime: o teste favorita a primeira camisa que a lista
        // mostrar, e a validação nos favoritos precisa procurar exatamente esse item.
        let produtoFavoritado = '';

        // Habilita a limpeza automática do banner antes de cada step (ver comentário acima).
        closeBannerIfPresent = () => homePage.fechaBanner();

        // Rotula a execução por aparelho para o relatório Allure juntar TODOS os devices
        // num só e permitir navegar por aparelho (aba Suites) mostrando a conta usada.
        const device = friendlyDeviceName();
        // historyId/testCaseId DISTINTO por aparelho: o Allure agrupa resultados pelo historyId;
        // sem isso os N devices (mesmo título de teste) colapsam num só, aparecendo como "retries"
        // e mostrando apenas um device. Chave estável por modelo → cada aparelho mantém seu
        // histórico (aba Trend) entre runs. (addArgument NÃO altera o historyId nesta versão.)
        const caseKey = `adiciona-favoritos::${device}`;
        await addTestCaseId(caseKey);
        await addHistoryId(caseKey);

        await allure.addParentSuite(`${device} — ${user}`); // nó do aparelho na aba Suites (com a conta)
        await allure.addArgument('Device', device);          // device visível nos parâmetros do teste
        await allure.addArgument('Conta', user);             // qual conta rodou neste device
        await allure.addLabel('host', device);               // aba Timeline agrupa por aparelho

        await step('homePage.ativarApp()', () => homePage.ativarApp());
        await step('homePage.abrirPerfil()', () => homePage.abrirPerfil());

        await step('loginPage.logar()', () => loginPage.logar(user, password));
        await step('homePage.abrirCategorias()', () => homePage.abrirCategorias());

        await step('categoriaPage.clickRoupas()', () => categoriaPage.clickRoupas());
        await step('categoriaPage.abrirCamisetas()', () => categoriaPage.abrirCamisas());
        await step('categoriaPage.favoritarPrimeiroProduto()', async () => {produtoFavoritado = await categoriaPage.favoritarPrimeiroProduto();});
        // Um voltar() só: favoritando na listagem, esta é a única tela a sair para chegar em
        // categorias, que é onde a aba Perfil existe (a listagem não tem tab-* nenhum).
        await step('categoriaPage.voltar() - categoria', () => categoriaPage.voltar());

        await step('homePage.abrirPerfil()', () => homePage.abrirPerfil());
        await step('perfilPage.abrirFavoritos()', () => perfilPage.abrirFavoritos());

        await step('favoritosPage.validaElememnto()', () => favoritosPage.validaElememnto(produtoFavoritado));
        await step('favoritosPage.tirarSelecaoItem()', () => favoritosPage.tirarSelecaoItem());

        await step('categoriaPage.voltar()', () => categoriaPage.voltar());

        await step('homePage.abrirPerfil()', () => homePage.abrirPerfil());
        await step('perfilPage.logout()', () => perfilPage.logout());
        await step('perfilPage.confirmarLogout()', () => perfilPage.confirmarLogout());
    });

});
