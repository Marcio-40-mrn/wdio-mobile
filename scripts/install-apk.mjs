#!/usr/bin/env node
import { execSync } from 'child_process';
import { createWriteStream, existsSync, mkdirSync, renameSync, rmSync, unlinkSync, writeFileSync } from 'fs';
import https from 'https';
import http from 'http';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
config({ path: path.join(projectRoot, '.env') });

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
    ...(hasPlatform ? { platform: 'ANDROID' } : {}),
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
        (b.artifacts?.buildUrl?.endsWith('.apk') || b.artifacts?.buildUrl?.endsWith('.aab'))
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

const isAab = build.artifacts.buildUrl.endsWith('.aab');
const tmpArtifact = path.join(projectRoot, isAab ? 'tmp-app.aab' : 'tmp-app.apk');

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

function httpsGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'install-apk-script' } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                res.resume();
                httpsGet(res.headers.location).then(resolve).catch(reject);
                return;
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

console.log(`Fazendo download do ${isAab ? 'AAB' : 'APK'}...`);
await download(build.artifacts.buildUrl, tmpArtifact);

if (!isAab) {
    const appApk = path.join(projectRoot, 'app.apk');
    renameSync(tmpArtifact, appApk);
    console.log('Instalando no emulador via adb...');
    execSync(`adb install -r "${appApk}"`, { stdio: 'inherit' });
    console.log('Instalação concluída. APK salvo em: app.apk');
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
        console.log('bundletool.jar não encontrado em scripts/. Baixando versão mais recente...');
        const releaseJson = await httpsGet('https://api.github.com/repos/google/bundletool/releases/latest');
        const release = JSON.parse(releaseJson);
        const jarAsset = release.assets?.find(a => a.name.endsWith('.jar'));
        if (!jarAsset) {
            console.error('Não foi possível encontrar o bundletool.jar no release do GitHub.');
            unlinkSync(tmpArtifact);
            process.exit(1);
        }
        console.log(`Baixando bundletool ${release.tag_name}...`);
        await download(jarAsset.browser_download_url, bundletoolJar);
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
    execSync(
        `java -jar "${bundletoolJar}" build-apks` +
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
    console.log('Instalando no emulador via adb...');
    execSync(`adb install -r "${appApk}"`, { stdio: 'inherit' });
    unlinkSync(tmpArtifact);
    unlinkSync(tmpApks);
    console.log('Instalação concluída. APK salvo em: app.apk');
}
