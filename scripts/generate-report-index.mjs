#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

// Gera um index.html DINÂMICO para o branch `reports` (GitHub Pages).
//
// Por que dinâmico: antes o índice era "assado" varrendo as pastas run-N no disco no
// momento da geração (no job publish-report). Quando um relatório era apagado manualmente
// do branch reports, o index.html NÃO era regenerado e continuava listando pastas que já
// não existiam (links 404). Agora a tabela é montada no navegador, consultando a API do
// GitHub ao abrir a página — então ela reflete SEMPRE as pastas run-N que existem naquele
// momento. Apagou a pasta, recarregou, o link some; sem regenerar nada.
//
// O conteúdo emitido é constante (não depende das pastas): o CI segue chamando este script
// no publish-report, mas ele só reescreve o mesmo index.html dinâmico.

const reportsDir = process.argv[2];
if (!reportsDir) {
    console.error('Usage: generate-report-index.mjs <reports-branch-dir>');
    process.exit(1);
}

const absDir = path.resolve(reportsDir);

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
  <div id="status" class="empty">Carregando relatórios…</div>
  <table id="tbl" hidden>
    <thead>
      <tr><th>Run</th><th>Data</th><th>Android</th><th>iOS</th></tr>
    </thead>
    <tbody id="tbody"></tbody>
  </table>
  <div class="footer">
    <p>Relatórios hospedados no GitHub Pages a partir do branch <code>reports</code>.
    Gerados com <a href="https://allurereport.org/">Allure Report</a>.</p>
  </div>
  <script>
    (async () => {
      const status = document.getElementById('status');
      const tbody = document.getElementById('tbody');
      const tbl = document.getElementById('tbl');

      // Deriva owner/repo do próprio endereço do Pages
      // (https://<owner>.github.io/<repo>/...), sem hardcode.
      const owner = location.hostname.split('.')[0];
      const repo = location.pathname.split('/').filter(Boolean)[0];

      // HEAD same-origin (servido pelo Pages) — não consome a cota da API do GitHub.
      const exists = async (url) => {
        try { return (await fetch(url, { method: 'HEAD' })).ok; }
        catch { return false; }
      };

      try {
        // 1 chamada à API lista as pastas da raiz do branch reports (reflete deleções ao vivo).
        const res = await fetch(
          \`https://api.github.com/repos/\${owner}/\${repo}/contents?ref=reports\`,
          { headers: { Accept: 'application/vnd.github+json' } }
        );
        if (!res.ok) throw new Error('API ' + res.status);

        const runs = (await res.json())
          .filter((i) => i.type === 'dir' && /^run-\\d+/.test(i.name))
          .map((i) => {
            const m = i.name.match(/^run-(\\d+)-(.+)$/);
            return { name: i.name, runNumber: m ? parseInt(m[1], 10) : 0, date: m ? m[2] : i.name };
          })
          .sort((a, b) => b.runNumber - a.runNumber);

        // Detecta android/ios/legado por HEAD; relatórios pré-split têm index.html na raiz do run.
        await Promise.all(runs.map(async (r) => {
          const [android, ios] = await Promise.all([
            exists(\`./\${r.name}/android/index.html\`),
            exists(\`./\${r.name}/ios/index.html\`),
          ]);
          r.android = android;
          r.ios = ios;
          r.legacy = (!android && !ios) && await exists(\`./\${r.name}/index.html\`);
        }));

        // Mostra só o que realmente abre (android, ios ou legado).
        const openable = runs.filter((r) => r.android || r.ios || r.legacy);
        if (openable.length === 0) {
          status.textContent = 'Nenhum relatório disponível.';
          return;
        }

        const cell = (ok, href, label) => ok ? \`<a href="\${href}">\${label}</a>\` : '—';
        tbody.innerHTML = openable.map((r) => {
          if (!r.android && !r.ios && r.legacy) {
            return \`<tr><td>#\${r.runNumber}</td><td>\${r.date}</td>\` +
                   \`<td colspan="2"><a href="./\${r.name}/index.html">Abrir Relatório (legado)</a></td></tr>\`;
          }
          return \`<tr><td>#\${r.runNumber}</td><td>\${r.date}</td>\` +
                 \`<td>\${cell(r.android, \`./\${r.name}/android/index.html\`, 'Abrir Android')}</td>\` +
                 \`<td>\${cell(r.ios, \`./\${r.name}/ios/index.html\`, 'Abrir iOS')}</td></tr>\`;
        }).join('');

        status.hidden = true;
        tbl.hidden = false;
      } catch (e) {
        status.textContent =
          'Não foi possível carregar a lista de relatórios (' + e.message +
          '). Recarregue em alguns minutos.';
      }
    })();
  </script>
</body>
</html>`;

const outputPath = path.join(absDir, 'index.html');
fs.writeFileSync(outputPath, html, 'utf8');
console.log(`index.html (dinâmico) escrito em ${outputPath}`);
