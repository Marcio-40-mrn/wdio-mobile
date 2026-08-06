#!/usr/bin/env node
import { execSync } from 'child_process';
import { createWriteStream, existsSync, mkdirSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from 'fs';
import https from 'https';
import http from 'http';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
try {
    const { config } = await import('dotenv');
    config({ path: path.join(projectRoot, '.env') });
} catch {
    // dotenv não disponível; usa process.env diretamente
}

const EXPO_TOKEN = process.env.EXPO_TOKEN;
if (!EXPO_TOKEN) {
    console.error('EXPO_TOKEN não encontrado no .env');
    process.exit(1);
}

const EXPO_PROJECT_ID = process.env.EXPO_PROJECT_ID;
if (!EXPO_PROJECT_ID) {
    console.error('EXPO_PROJECT_ID não encontrado no .env');
    console.error('Encontre em: expo.dev → projeto ecomm → Project Settings → Project ID');
    process.exit(1);
}

const TARGET_BUNDLE_ID = 'com.aramis.ecomm';
const noInstall = process.argv.includes('--no-install');
const platformUpper = (() => {
    const idx = process.argv.indexOf('--platform');
    return idx !== -1 ? process.argv[idx + 1].toUpperCase() : 'ANDROID';
})();

function graphqlRequest(query, variables = {}) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ query, variables });
        const req = https.request({
            hostname: 'api.expo.dev',
            path: '/graphql',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${EXPO_TOKEN}`,
                'Accept': 'application/json',
            },
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let json;
                try { json = JSON.parse(data); } catch {
                    reject(new Error(`Resposta não-JSON (HTTP ${res.statusCode}): ${data.slice(0, 300)}`));
                    return;
                }
                if (json.errors && !json.data) {
                    reject(new Error(`GraphQL errors:\n${JSON.stringify(json.errors, null, 2)}`));
                    return;
                }
                resolve(json.data);
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

// Discover the current API structure for listing builds
console.log('Descobrindo schema da API EAS...');
const schemaData = await graphqlRequest(`{
    appQuery: __type(name: "AppQuery") {
        fields { name args { name } }
    }
    appType: __type(name: "App") {
        fields { name args { name } }
    }
}`);

const appQueryFields = schemaData?.appQuery?.fields ?? [];
const appTypeFields  = schemaData?.appType?.fields  ?? [];

// Find how to get an App by its project ID (byId, byProjectId, etc.)
const appByIdField = appQueryFields.find(f =>
    f.args?.some(a => ['appId', 'id', 'projectId'].includes(a.name))
);
// Find how builds are listed on the App type
const buildsField = appTypeFields.find(f => f.name === 'builds');

if (!appByIdField || !buildsField) {
    console.error('Não foi possível mapear o caminho até builds na API EAS.');
    console.error('AppQuery fields:', appQueryFields.map(f => `${f.name}(${f.args?.map(a => a.name).join(', ')})`).join('; ') || '(nenhum)');
    console.error('App fields com "build":', appTypeFields.filter(f => f.name.toLowerCase().includes('build')).map(f => f.name).join(', ') || '(nenhum)');
    process.exit(1);
}

const appIdArgName = appByIdField.args.find(a => ['appId', 'id', 'projectId'].includes(a.name)).name;
const hasLimit    = buildsField.args?.some(a => a.name === 'limit');
const hasPlatform = buildsField.args?.some(a => a.name === 'platform');
const hasStatus   = buildsField.args?.some(a => a.name === 'status');
const hasOffset   = buildsField.args?.some(a => a.name === 'offset');

console.log(`Caminho: app.${appByIdField.name}(${appIdArgName}: ...).${buildsField.name}(...) — buscando último development build (.apk ou .aab) para ${TARGET_BUNDLE_ID}...`);

const buildsArgs = [
    hasLimit    ? 'limit: $limit'       : null,
    hasPlatform ? 'platform: $platform' : null,
    hasStatus   ? 'status: $status'     : null,
    hasOffset   ? 'offset: $offset'     : null,
].filter(Boolean).join(', ');

const declaredVars = [
    `$${appIdArgName}: String!`,
    hasLimit    ? '$limit: Int!'              : null,
    hasPlatform ? '$platform: AppPlatform'    : null,
    hasStatus   ? '$status: BuildStatus'      : null,
    hasOffset   ? '$offset: Int!'             : null,
].filter(Boolean).join(', ');

const data = await graphqlRequest(`
    query(${declaredVars}) {
        app {
            ${appByIdField.name}(${appIdArgName}: $${appIdArgName}) {
                builds(${buildsArgs}) {
                    id
                    createdAt
                    platform
                    status
                    appIdentifier
                    appVersion
                    appBuildVersion
                    buildProfile
                    artifacts { buildUrl }
                }
            }
        }
    }
`, {
    [appIdArgName]: EXPO_PROJECT_ID,
    ...(hasLimit    ? { limit: 20 }          : {}),
    ...(hasPlatform ? { platform: platformUpper } : {}),
    ...(hasStatus   ? { status: 'FINISHED' }  : {}),
    ...(hasOffset   ? { offset: 0 }           : {}),
});

const appBuilds = data?.app?.[appByIdField.name]?.builds ?? [];

// Sort newest first, then filter for the right build type
const build = appBuilds
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .find(b =>
        b.status === 'FINISHED' &&
        b.buildProfile === 'development' &&
        b.appIdentifier === TARGET_BUNDLE_ID &&
        (platformUpper === 'IOS'
            ? b.artifacts?.buildUrl?.endsWith('.ipa')
            : (b.artifacts?.buildUrl?.endsWith('.apk') || b.artifacts?.buildUrl?.endsWith('.aab')))
    );

if (!build) {
    console.error(`Nenhum build development/FINISHED com .apk ou .aab encontrado para ${TARGET_BUNDLE_ID}.`);
    if (appBuilds.length) {
        console.error('Builds disponíveis (mais recentes primeiro):');
        [...appBuilds]
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .forEach(b => {
                const ext = b.artifacts?.buildUrl?.split('.').pop() ?? '?';
                console.error(`  ${b.createdAt} | ${b.buildProfile} | ${b.status} | .${ext} | ${b.id}`);
            });
    }
    process.exit(1);
}

console.log(`Build ID  : ${build.id}`);
console.log(`Versão    : ${build.appVersion ?? '?'} (code ${build.appBuildVersion ?? '?'})`);
console.log(`Criado em : ${new Date(build.createdAt).toLocaleString('pt-BR')}`);
console.log(`Profile   : ${build.buildProfile}`);
console.log(`URL       : ${build.artifacts.buildUrl}`);

writeFileSync(
    path.join(projectRoot, '.build-info.json'),
    JSON.stringify({
        appVersion:      build.appVersion      ?? '?',
        appBuildVersion: build.appBuildVersion ?? '?',
        buildId:         build.id,
        createdAt:       build.createdAt,
        platform:        build.platform,
        buildProfile:    build.buildProfile,
    }, null, 2)
);

const isIpa = build.artifacts.buildUrl.endsWith('.ipa');
const isAab = build.artifacts.buildUrl.endsWith('.aab');
const tmpArtifact = path.join(projectRoot, isIpa ? 'tmp-app.ipa' : (isAab ? 'tmp-app.aab' : 'tmp-app.apk'));

function download(url, dest) {
    return new Promise((resolve, reject) => {
        const get = url.startsWith('https') ? https.get : http.get;
        get(url, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                res.resume();
                download(res.headers.location, dest).then(resolve).catch(reject);
                return;
            }
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode} ao baixar artefato`));
                return;
            }
            const total = parseInt(res.headers['content-length'] || '0', 10);
            let downloaded = 0;
            const file = createWriteStream(dest);
            res.on('data', chunk => {
                downloaded += chunk.length;
                if (total) {
                    const pct = Math.round(downloaded / total * 100);
                    process.stdout.write(`\rDownload: ${pct}% (${(downloaded / 1024 / 1024).toFixed(1)} MB)`);
                }
            });
            res.pipe(file);
            file.on('finish', () => { file.close(); process.stdout.write('\n'); resolve(); });
            file.on('error', reject);
        }).on('error', reject);
    });
}

// GET simples devolvendo { status, headers, body }. Os `headers` extras valem só para o host
// da URL original: num redirect para outro host eles são descartados. Isso importa porque o
// Authorization não pode vazar para fora da api.github.com — o endpoint de download do asset
// (objects.githubusercontent.com) já vem assinado e rejeita requisição com token.
function httpsGet(url, headers = {}) {
    return new Promise((resolve, reject) => {
        const origin = new URL(url).host;
        https.get(url, { headers: { 'User-Agent': 'install-apk-script', ...headers } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                res.resume();
                const next = new URL(res.headers.location, url);
                httpsGet(next.href, next.host === origin ? headers : {}).then(resolve).catch(reject);
                return;
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
        }).on('error', reject);
    });
}

// Versão usada quando a API do GitHub não responde. O nome do asset segue o padrão
// bundletool-all-<versão>.jar em todos os releases.
const BUNDLETOOL_FALLBACK_VERSION = '1.18.3';

// Descobre a URL do bundletool mais recente pela API do GitHub.
//
// A API sem autenticação tem cota de 60 requisições/hora POR IP. Isso nunca aparece na
// execução local, porque scripts/bundletool.jar fica cacheado e este bloco inteiro é pulado
// pelo `if (!existsSync(...))`. No CI o jar nunca existe (é gitignored), então TODA run bate
// na API — saindo por um IP de runner hospedado, compartilhado com muitos outros jobs, onde
// os 60/h se esgotam com facilidade. Com GITHUB_TOKEN a cota vai para 5000/h.
//
// Se ainda assim a API falhar, cai numa URL fixa de release (que não passa pela API e não tem
// rate limit) em vez de derrubar o pipeline.
async function resolveBundletoolUrl() {
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    try {
        const res = await httpsGet('https://api.github.com/repos/google/bundletool/releases/latest', {
            Accept: 'application/vnd.github+json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        });

        if (res.status !== 200) {
            const reset = res.headers['x-ratelimit-reset'];
            throw new Error(
                `HTTP ${res.status} (autenticado: ${token ? 'sim' : 'NÃO'}` +
                `, cota ${res.headers['x-ratelimit-remaining'] ?? '?'}/${res.headers['x-ratelimit-limit'] ?? '?'}` +
                `, reset ${reset ? new Date(Number(reset) * 1000).toISOString() : '?'}) — ` +
                res.body.slice(0, 200)
            );
        }

        const release = JSON.parse(res.body);
        const jarAsset = release.assets?.find(a => a.name.endsWith('.jar'));
        if (!jarAsset) throw new Error(`release ${release.tag_name ?? '?'} não tem asset .jar`);

        console.log(`Baixando bundletool ${release.tag_name}...`);
        return jarAsset.browser_download_url;
    } catch (err) {
        console.warn(`Não foi possível consultar a API do GitHub: ${err.message}`);
        console.warn(`Usando fallback fixo: bundletool ${BUNDLETOOL_FALLBACK_VERSION} (download direto, sem API).`);
        return `https://github.com/google/bundletool/releases/download/${BUNDLETOOL_FALLBACK_VERSION}` +
            `/bundletool-all-${BUNDLETOOL_FALLBACK_VERSION}.jar`;
    }
}

console.log(`Fazendo download do ${isIpa ? 'IPA' : isAab ? 'AAB' : 'APK'}...`);
await download(build.artifacts.buildUrl, tmpArtifact);

if (isIpa) {
    const appIpa = path.join(projectRoot, 'app.ipa');
    renameSync(tmpArtifact, appIpa);
    console.log('IPA salvo em: app.ipa');
} else if (!isAab) {
    const appApk = path.join(projectRoot, 'app.apk');
    renameSync(tmpArtifact, appApk);
    if (!noInstall) {
        console.log('Instalando no emulador via adb...');
        execSync(`adb install -r "${appApk}"`, { stdio: 'inherit' });
    }
    console.log('APK salvo em: app.apk');
} else {
    // AAB → APK universal via bundletool
    try {
        execSync('java -version', { stdio: 'ignore' });
    } catch {
        console.error('Java não encontrado. Instale o JDK para converter AAB → APK.');
        console.error('Download: https://adoptium.net/');
        unlinkSync(tmpArtifact);
        process.exit(1);
    }

    const bundletoolJar = path.join(projectRoot, 'scripts', 'bundletool.jar');
    if (!existsSync(bundletoolJar)) {
        console.log('bundletool.jar não encontrado em scripts/. Baixando...');
        try {
            await download(await resolveBundletoolUrl(), bundletoolJar);
        } catch (err) {
            console.error(`Falha ao baixar o bundletool.jar: ${err.message}`);
            if (existsSync(bundletoolJar)) rmSync(bundletoolJar, { force: true });
            unlinkSync(tmpArtifact);
            process.exit(1);
        }
        console.log('bundletool.jar salvo em scripts/bundletool.jar');
    }

    const dotAndroid = path.join(os.homedir(), '.android');
    const debugKeystore = path.join(dotAndroid, 'debug.keystore');
    if (!existsSync(debugKeystore)) {
        console.log('Debug keystore não encontrado. Gerando automaticamente...');
        if (!existsSync(dotAndroid)) mkdirSync(dotAndroid, { recursive: true });
        execSync(
            `keytool -genkey -v` +
            ` -keystore "${debugKeystore}"` +
            ` -storepass android` +
            ` -alias androiddebugkey` +
            ` -keypass android` +
            ` -keyalg RSA -keysize 2048 -validity 10000` +
            ` -dname "CN=Android Debug,O=Android,C=US"`,
            { stdio: 'inherit' }
        );
        console.log(`Debug keystore gerado em: ${debugKeystore}`);
    }

    const tmpApks  = path.join(projectRoot, 'tmp-app.apks');
    const tmpApksDir = path.join(projectRoot, 'tmp-apks-dir');

    console.log('Convertendo AAB → APK universal com bundletool...');
    // -Xmx4g: o heap padrão da JVM é ~1/4 da RAM. No runner do GitHub (2 vCPU / 7 GB em repo
    // privado) isso dá ~1,75 GB, apertado para o universal APK atual (~150 MB) — localmente
    // a máquina tem folga e o default basta.
    execSync(
        `java -Xmx4g -jar "${bundletoolJar}" build-apks` +
        ` --bundle="${tmpArtifact}"` +
        ` --output="${tmpApks}"` +
        ` --mode=universal` +
        ` --ks="${debugKeystore}"` +
        ` --ks-pass=pass:android` +
        ` --ks-key-alias=androiddebugkey` +
        ` --key-pass=pass:android` +
        ` --overwrite`,
        { stdio: 'inherit' }
    );

    console.log('Extraindo APK universal...');
    if (existsSync(tmpApksDir)) rmSync(tmpApksDir, { recursive: true, force: true });
    mkdirSync(tmpApksDir);
    // .apks é um ZIP — usar jar (JDK) para extrair, pois Expand-Archive exige extensão .zip
    execSync(`jar xf "${tmpApks}" universal.apk`, { cwd: tmpApksDir, stdio: 'inherit' });

    const universalApk = path.join(tmpApksDir, 'universal.apk');
    if (!existsSync(universalApk)) {
        console.error(`universal.apk não encontrado após extração em: ${tmpApksDir}`);
        process.exit(1);
    }

    const appApk = path.join(projectRoot, 'app.apk');
    renameSync(universalApk, appApk);
    rmSync(tmpApksDir, { recursive: true, force: true });
    if (!noInstall) {
        console.log('Instalando no emulador via adb...');
        execSync(`adb install -r "${appApk}"`, { stdio: 'inherit' });
    }
    unlinkSync(tmpArtifact);
    unlinkSync(tmpApks);
    console.log('APK salvo em: app.apk');
}

// Guarda final: o CI sobe este artefato para o Device Farm no passo seguinte. Se ele não
// existir ou vier truncado, falhar aqui — nomeando o passo — é melhor do que quebrar depois
// no `curl -T` com um erro que não diz nada sobre a origem.
const artifactPath = path.join(projectRoot, isIpa ? 'app.ipa' : 'app.apk');
if (!existsSync(artifactPath)) {
    console.error(`Conversão/download terminou sem gerar ${path.basename(artifactPath)}.`);
    process.exit(1);
}
const artifactMB = statSync(artifactPath).size / 1024 / 1024;
if (artifactMB < 10) {
    console.error(`${path.basename(artifactPath)} tem apenas ${artifactMB.toFixed(1)} MB — artefato truncado.`);
    process.exit(1);
}
console.log(`Artefato pronto: ${path.basename(artifactPath)} (${artifactMB.toFixed(1)} MB)`);
