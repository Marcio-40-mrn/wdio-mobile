#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

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
    .sort((a, b) => b.runNumber - a.runNumber);

const cell = (exists, href, label) =>
    exists ? `<a href="${href}">${label}</a>` : '—';

const rows = entries.map(e => {
    // Runs antigos (pré-separação) têm o relatório na raiz do run, sem subpastas.
    if (!e.hasAndroid && !e.hasIos && e.hasLegacy) {
        return `
    <tr>
      <td>#${e.runNumber}</td>
      <td>${e.date}</td>
      <td colspan="2"><a href="./${e.name}/index.html">Abrir Relatório (legado)</a></td>
    </tr>`;
    }
    return `
    <tr>
      <td>#${e.runNumber}</td>
      <td>${e.date}</td>
      <td>${cell(e.hasAndroid, `./${e.name}/android/index.html`, 'Abrir Android')}</td>
      <td>${cell(e.hasIos, `./${e.name}/ios/index.html`, 'Abrir iOS')}</td>
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
     A exclusão é apenas manual.</p>
  ${entries.length === 0
    ? '<p class="empty">Nenhum relatório ainda. Execute o workflow para gerar o primeiro relatório.</p>'
    : `<table>
    <thead>
      <tr><th>Run</th><th>Data</th><th>Android</th><th>iOS</th></tr>
    </thead>
    <tbody>${rows}
    </tbody>
  </table>`}
  <div class="footer">
    <p>Relatórios hospedados no GitHub Pages a partir do branch <code>reports</code>.
    Gerados com <a href="https://allurereport.org/">Allure Report</a>.</p>
  </div>
</body>
</html>`;

const outputPath = path.join(absDir, 'index.html');
fs.writeFileSync(outputPath, html, 'utf8');
console.log(`index.html escrito em ${outputPath} (${entries.length} runs listados)`);
