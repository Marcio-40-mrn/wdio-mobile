#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

// Gera o index.html do branch `reports` (GitHub Pages) com abordagem HÍBRIDA.
//
// Build-time (aqui, no CI): a lista de runs é montada varrendo as pastas run-N em disco
// (fs.readdirSync). O job publish-report faz checkout completo do branch reports e roda este
// script a partir da raiz dele, então enxergamos todas as pastas run-N. As <tr> já saem
// preenchidas no HTML — a tabela abre mesmo sem JavaScript, sem depender de API externa.
//
// Cliente (no navegador): um script enxuto faz apenas HEAD *same-origin* em cada link já
// renderizado e esconde as linhas/células cuja pasta foi apagada manualmente. Como é
// same-origin (servido pelo próprio Pages, com a sessão já autenticada), funciona em
// repositório PRIVADO — reflete deleções ao vivo sem esperar o próximo run do CI.
//
// Por que não usar a API do GitHub: a versão anterior chamava
// https://api.github.com/repos/{owner}/{repo}/contents no cliente. Isso só funciona em repo
// público; em repo privado a API responde 404 a requisições não autenticadas (e não há como
// autenticar com segurança em JS estático), quebrando a página no Pages privado.

const reportsDir = process.argv[2];
if (!reportsDir) {
    console.error('Usage: generate-report-index.mjs <reports-branch-dir>');
    process.exit(1);
}

const absDir = path.resolve(reportsDir);
const entries = fs.readdirSync(absDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && /^run-\d+/.test(d.name))
    .map(d => {
        const match = d.name.match(/^run-(\d+)-(.+)$/);
        const runNumber = match ? parseInt(match[1], 10) : 0;
        const date = match ? match[2] : d.name;
        const hasAndroid = fs.existsSync(path.join(absDir, d.name, 'android', 'index.html'));
        const hasIos = fs.existsSync(path.join(absDir, d.name, 'ios', 'index.html'));
        const hasLegacy = fs.existsSync(path.join(absDir, d.name, 'index.html'));
        return { name: d.name, runNumber, date, hasAndroid, hasIos, hasLegacy };
    })
    .filter(e => e.hasAndroid || e.hasIos || e.hasLegacy)
    .sort((a, b) => b.runNumber - a.runNumber);

const cell = (exists, href, label) =>
    exists ? `<a href="${href}">${label}</a>` : '—';

const rows = entries.map(e => {
    // Runs antigos (pré-separação) têm o relatório na raiz do run, sem subpastas.
    if (!e.hasAndroid && !e.hasIos && e.hasLegacy) {
        return `
    <tr data-run="${e.name}">
      <td>#${e.runNumber}</td>
      <td>${e.date}</td>
      <td colspan="2" data-check="./${e.name}/index.html"><a href="./${e.name}/index.html">Abrir Relatório (legado)</a></td>
    </tr>`;
    }
    const androidHref = `./${e.name}/android/index.html`;
    const iosHref = `./${e.name}/ios/index.html`;
    return `
    <tr data-run="${e.name}">
      <td>#${e.runNumber}</td>
      <td>${e.date}</td>
      <td${e.hasAndroid ? ` data-check="${androidHref}"` : ''}>${cell(e.hasAndroid, androidHref, 'Abrir Android')}</td>
      <td${e.hasIos ? ` data-check="${iosHref}"` : ''}>${cell(e.hasIos, iosHref, 'Abrir iOS')}</td>
    </tr>`;
}).join('\n');

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Aramis Mobile Tests — Relatórios Allure</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 900px; margin: 40px auto; padding: 0 20px; color: #24292f; }
    h1 { border-bottom: 1px solid #d0d7de; padding-bottom: 16px; }
    p { color: #656d76; }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; }
    th { text-align: left; padding: 10px 14px; background: #f6f8fa; border: 1px solid #d0d7de; font-weight: 600; }
    td { padding: 10px 14px; border: 1px solid #d0d7de; }
    tr:hover td { background: #f6f8fa; }
    a { color: #0969da; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .empty { color: #656d76; font-style: italic; margin-top: 24px; }
    .footer { margin-top: 48px; color: #656d76; font-size: 0.85em; border-top: 1px solid #d0d7de; padding-top: 16px; }
  </style>
</head>
<body>
  <h1>Aramis Mobile Tests — Relatórios Allure</h1>
  <p>Todas as execuções de teste estão listadas abaixo, da mais recente para a mais antiga.
     Os relatórios são gerados automaticamente após cada run no CI.
     A exclusão é apenas manual — a lista abaixo reflete sempre os relatórios que ainda existem.</p>
  ${entries.length === 0
    ? '<p class="empty">Nenhum relatório ainda. Execute o workflow para gerar o primeiro relatório.</p>'
    : `<table id="tbl">
    <thead>
      <tr><th>Run</th><th>Data</th><th>Android</th><th>iOS</th></tr>
    </thead>
    <tbody>${rows}
    </tbody>
  </table>
  <p id="empty" class="empty" hidden>Nenhum relatório disponível.</p>`}
  <div class="footer">
    <p>Relatórios hospedados no GitHub Pages a partir do branch <code>reports</code>.
    Gerados com <a href="https://allurereport.org/">Allure Report</a>.</p>
  </div>
  <script>
    // Poda ao vivo: HEAD same-origin em cada link já renderizado no build.
    // Se a pasta foi apagada manualmente do branch reports, o HEAD dá 404 e a célula some
    // (a linha inteira some se nenhuma célula sobrar). Same-origin → funciona em repo privado,
    // sem consumir a API do GitHub. Sem JavaScript, a tabela ainda aparece (estado do build).
    (async () => {
      // Só considera "apagado" quando o servidor responde 404 de forma definitiva.
      // Em erro de rede ou 5xx transitório, mantém o link (não esconde relatório válido).
      const isDeleted = async (url) => {
        try { return (await fetch(url, { method: 'HEAD' })).status === 404; }
        catch { return false; }
      };
      const cells = Array.from(document.querySelectorAll('td[data-check]'));
      await Promise.all(cells.map(async (td) => {
        if (await isDeleted(td.getAttribute('data-check'))) {
          td.removeAttribute('data-check');
          if (td.hasAttribute('colspan')) {
            td.innerHTML = '—';           // legado: mantém a linha, marca como indisponível
          } else {
            td.textContent = '—';         // android/ios: zera só a célula
          }
        }
      }));
      // Remove linhas que ficaram sem nenhum link válido.
      const tbody = document.querySelector('#tbl tbody');
      if (tbody) {
        Array.from(tbody.rows).forEach((tr) => {
          if (!tr.querySelector('a')) tr.remove();
        });
        if (tbody.rows.length === 0) {
          const tbl = document.getElementById('tbl');
          const empty = document.getElementById('empty');
          if (tbl) tbl.hidden = true;
          if (empty) empty.hidden = false;
        }
      }
    })();
  </script>
</body>
</html>`;

const outputPath = path.join(absDir, 'index.html');
fs.writeFileSync(outputPath, html, 'utf8');
console.log(`index.html escrito em ${outputPath} (${entries.length} runs listados)`);
