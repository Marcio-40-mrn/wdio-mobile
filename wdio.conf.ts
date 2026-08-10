import '@wdio/allure-reporter';
import { execSync } from 'child_process';
import * as dotenv from "dotenv";
import * as fs from "fs";
import allure from '@wdio/allure-reporter';
import { Status } from 'allure-js-commons';
dotenv.config();

const isDeviceFarm = !!process.env.DEVICEFARM_DEVICE_UDID;
const isCI        = !!process.env.CI;
const isIOS       = process.env.PLATFORM === 'ios';
const isRemote    = isIOS && !!process.env.REMOTE_HOST;

// App version: env vars (Device Farm/CI) or .build-info.json (local install-apk.mjs)
let appVersion      = process.env.APP_VERSION       ?? '?';
let appBuildVersion = process.env.APP_BUILD_VERSION ?? '?';
if (appVersion === '?' && fs.existsSync('./.build-info.json')) {
    try {
        const info = JSON.parse(fs.readFileSync('./.build-info.json', 'utf8'));
        if (info.appVersion)      appVersion      = info.appVersion;
        if (info.appBuildVersion) appBuildVersion = info.appBuildVersion;
    } catch {}
}

function buildCapabilities(): object[] {
    if (isDeviceFarm && isIOS) {
        return [{
            platformName: "iOS",
            "appium:deviceName": process.env.DEVICEFARM_DEVICE_NAME ?? "iPhone",
            "appium:udid": process.env.DEVICEFARM_DEVICE_UDID,
            "appium:app": process.env.DEVICEFARM_APP_PATH,
            "appium:automationName": "XCUITest",
            "appium:noReset": false,
            "appium:bundleId": "com.aramis.ecomm",
            "appium:autoAcceptAlerts": true,
            // Device Farm fornece um WDA pré-compilado e pré-assinado; reusar evita
            // o build via xcodebuild (que falha com "code 70" no host self-managed).
            "appium:usePrebuiltWDA": true,
            "appium:derivedDataPath":
                process.env.DEVICEFARM_WDA_DERIVED_DATA_PATH_V9 ??
                process.env.DEVICEFARM_WDA_DERIVED_DATA_PATH,
            "appium:showXcodeLog": true,
        } as any];
    }

    if (isDeviceFarm) {
        return [{
            platformName: "Android",
            "appium:deviceName": process.env.DEVICEFARM_DEVICE_NAME ?? "Android",
            "appium:udid": process.env.DEVICEFARM_DEVICE_UDID,
            "appium:app": process.env.DEVICEFARM_APP_PATH,
            "appium:automationName": "UiAutomator2",
            "appium:noReset": false,
            "appium:appPackage": "com.aramis.ecomm",
            "appium:appActivity": "com.aramis.ecomm.MainActivity",
            "appium:uiautomator2ServerInstallTimeout": 60000,
            "appium:uiautomator2ServerLaunchTimeout": 60000,
            // Sem autoGrantPermissions: deixamos os diálogos de permissão (GPS/notificação)
            // aparecerem para a sequência ativarApp() tratá-los, como no fluxo local.
            "appium:noIncrementalInstall": true,
        } as any];
    }

    if (isIOS) {
        return [{
            platformName: "iOS",
            "appium:automationName": "XCUITest",
            "appium:noReset": true,
            "appium:bundleId": "com.aramis.ecomm",
            "appium:autoAcceptAlerts": true,
        } as any];
    }

    return [{
        platformName: "Android",
        "appium:deviceName": "AVD-S24",
        "appium:automationName": "UiAutomator2",
        "appium:noReset": true,
        "appium:appPackage": "com.aramis.ecomm",
        "appium:appActivity": "com.aramis.ecomm.MainActivity",
        "appium:uiautomator2ServerInstallTimeout": 60000,
        "appium:uiautomator2ServerLaunchTimeout": 60000,
        "appium:autoGrantPermissions": true,
        "appium:noIncrementalInstall": true,
    } as any];
}

function buildConnectionSettings(): object {
    if (isDeviceFarm) {
        return {
            hostname: '127.0.0.1',
            port: 4723,
            path: '/wd/hub',
        };
    }
    if (isRemote) {
        return {
            protocol: 'https',
            hostname: process.env.REMOTE_HOST,
            port: parseInt(process.env.REMOTE_PORT!),
            path: process.env.REMOTE_PATH_IOS,
        };
    }
    return {};
}

function buildServices(): object[] {
    if (isDeviceFarm || isRemote) return [];
    return [
        ['appium', {
            command: 'appium',
            args: {
                address: '127.0.0.1',
                port: 4723,
                relaxedSecurity: true,
                allowCors: true
            }
        }]
    ];
}

function deviceLabel(): string {
    if (isDeviceFarm) return process.env.DEVICEFARM_DEVICE_NAME ?? 'Device Farm';
    if (isRemote)     return 'iOS Remote (Device Farm)';
    if (isIOS)        return 'iOS Remote';
    return 'AVD-S24';
}

function environmentLabel(): string {
    if (isDeviceFarm) return 'AWS Device Farm';
    if (isRemote)     return 'AWS Device Farm (Remote)';
    return 'Local';
}

export const config: WebdriverIO.Config = {
    runner: 'local',

    specs: ['./test/specs/**/*.ts'],

    maxInstances: 1,

    ...buildConnectionSettings(),

    capabilities: buildCapabilities(),

    logLevel: 'info',

    framework: 'mocha',
    mochaOpts: {
        ui: 'bdd',
        timeout: 900000
    },

    services: buildServices() as any,

    reporters: ['spec',
        ['allure', {
        outputDir: 'allure-results',
        disableWebdriverStepsReporting: false,
        disableWebdriverScreenshotsReporting: false,}],
        ['ctrf-json', {
        outputDir: './ctrf',
        outputFileFormat: () => 'ctrf-report.json',
        minimal: false,
        testType: 'e2e',
        appName: 'Aramis eComm',
        appVersion: appVersion}],
    ],

    onPrepare: function () {
        if (!fs.existsSync('./allure-results')) fs.mkdirSync('./allure-results');

        fs.writeFileSync('./allure-results/environment.properties', [
            `Platform=${isIOS ? 'iOS' : 'Android'}`,
            `Device=${deviceLabel()}`,
            'App=com.aramis.ecomm',
            `AppVersion=${appVersion}`,
            `AppBuildVersion=${appBuildVersion}`,
            `Automation=${isIOS ? 'XCUITest' : 'UiAutomator2'}`,
            'Framework=WebdriverIO + Appium',
            `Environment=${environmentLabel()}`,
        ].join('\n'));

        fs.writeFileSync('./allure-results/categories.json', JSON.stringify([
            {
                name: 'Elemento não encontrado',
                matchedStatuses: ['failed'],
                messageRegex: '.*displayed.*'
            },
            {
                name: 'Timeout',
                matchedStatuses: ['broken'],
                messageRegex: '.*Timeout.*'
            },
            {
                name: 'Outras falhas',
                matchedStatuses: ['failed']
            }
        ], null, 2));

        fs.writeFileSync('./allure-results/executor.json', JSON.stringify({
            name: environmentLabel(),
            type: isDeviceFarm ? 'ci' : 'local',
            buildName: isDeviceFarm
                ? `Device Farm Run ${new Date().toISOString()}`
                : `Run ${new Date().toLocaleString('pt-BR')}`,
        }, null, 2));
    },

    before: async function () {
        console.log("\n⏳ Aguardando 10 segundos para o aplicativo carregar...\n");
        await driver.pause(10000);
    },

    beforeTest: async function () {
        if (isRemote) return;
        if (isDeviceFarm && !isIOS) {
            // SÓ Android no Device Farm: o screenrecord nativo (startRecordingScreen)
            // trunca o vídeo em ~37s na troca de surface do app lá. MediaProjection
            // sobrevive a isso e grava a sessão inteira.
            // Local e iOS continuam no startRecordingScreen (já gravam completo).
            //
            // resolution: '1280x720' (720p) — em resolução nativa o .mp4 passava de
            // 100MB (limite por arquivo do GitHub), era apagado no publish e o vídeo
            // sumia do relatório (404). 720p reduz drásticamente o tamanho sem perder
            // a legibilidade do fluxo. priority é prioridade da thread de captura
            // (não mexe na qualidade/tamanho) — mantido em 'high' para não perder frames.
            await driver.execute('mobile: startMediaProjectionRecording', {
                resolution: '1280x720',
                maxDurationSec: 600,
                priority: 'high',
            });
        } else {
            await driver.startRecordingScreen({ timeLimit: 180 });
        }
    },

    afterTest: async function (_test: any, _context: any, _result: any) {

        if (!isRemote) {
            try {
                const video = (isDeviceFarm && !isIOS)
                    ? (await driver.execute('mobile: stopMediaProjectionRecording')) as string
                    : await driver.stopRecordingScreen();
                const videoBuffer = Buffer.from(video, 'base64');
                allure.startStep('Video da execução');
                allure.addAttachment('Video', videoBuffer, 'video/mp4');
                allure.endStep(Status.PASSED);
                console.log('🎥 Vídeo anexado ao Allure.');
            } catch (err) {
                console.warn("Erro ao capturar vídeo:", err);
            }
        }

        if (isRemote) {
            try {
                await driver.terminateApp('com.aramis.ecomm');
                console.log('\n✅ App iOS encerrado (Remote Access).');
            } catch (error) {
                console.warn('Aviso: terminateApp não suportado:', error);
            }
        } else if (isIOS) {
            try {
                console.log('\n🔄 Limpando dados da aplicação iOS (mobile: clearApp)...');
                await driver.execute('mobile: clearApp', { bundleId: 'com.aramis.ecomm' });
            } catch (error) {
                console.error('Erro ao limpar app iOS:', error);
            }
        } else if (isDeviceFarm) {
            try {
                console.log('\n🔄 Limpando dados da aplicação via Appium (mobile: clearApp)...');
                await driver.execute('mobile: clearApp', { appId: 'com.aramis.ecomm' });
            } catch (error) {
                console.error('Erro ao limpar app via Appium:', error);
            }
        } else {
            try {
                console.log('\n🔄 Limpando dados da aplicação (adb shell pm clear com.aramis.ecomm)...');
                execSync('adb shell pm clear com.aramis.ecomm', { stdio: 'inherit' });
            } catch (error) {
                console.error('Erro ao executar limpeza via ADB:', error);
            }
        }
    },

    onComplete: async function () {
        const { execSync } = await import("child_process");

        if (isDeviceFarm) {
            console.log('\n⏭️ Device Farm: allure-results copiado pelo testspec.yml. Pulando geração local.\n');
            return;
        }

        if (fs.existsSync('./allure-report/history')) {
            fs.cpSync('./allure-report/history', './allure-results/history', { recursive: true });
        }

        console.log("\n📊 Gerando relatório Allure...\n");
        execSync("allure generate ./allure-results --clean", { stdio: "inherit" });

        if (!isCI) {
            execSync("allure open ./allure-report", { stdio: "inherit" });
        }

        console.log("\n📁 Relatório gerado em: ./allure-report\n");
    },
};
