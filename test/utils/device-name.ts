// Nome amigável do device em runtime, para rotular a execução no relatório Allure.
//
// A identidade vem do MODELO (ro.product.model), lido das capabilities da sessão
// (`browser.capabilities.deviceModel`, ex.: "SM-S918U1"). NÃO usar DEVICEFARM_DEVICE_NAME:
// essa env var é o número de série do aparelho (no iOS, o UDID). O mapa é por PREFIXO de
// modelo (sem o sufixo de região), casado com `startsWith` — mesma ideia do device-index.ts.
//
// Fallback: modelo cru -> DEVICEFARM_DEVICE_NAME -> 'AVD-S24' (execução local).
const deviceNames: Record<'android' | 'ios', Record<string, string>> = {
    android: {
        "SM-S918": "Samsung Galaxy S23 Ultra",
        "SM-S916": "Samsung Galaxy S23+",
        "SM-S928": "Samsung Galaxy S24 Ultra",
        "SM-S926": "Samsung Galaxy S24+",
        "SM-S938": "Samsung Galaxy S25 Ultra",
        "SM-S948": "Samsung Galaxy S26 Ultra",
    },
    // iOS: o `deviceModel` do XCUITest é incerto (pode vir "iPhone14,5"); cai no fallback.
    // O fluxo iOS ainda quebra no onboarding, então isto será verificado quando o iOS rodar.
    ios: {},
};

export function friendlyDeviceName(): string {
    const isIOS = process.env.PLATFORM === 'ios';
    const isDeviceFarm = !!process.env.DEVICEFARM_DEVICE_UDID;

    if (!isDeviceFarm) return 'AVD-S24';

    const model = String((browser?.capabilities as any)?.deviceModel ?? '');
    const map = deviceNames[isIOS ? 'ios' : 'android'];
    const hit = Object.entries(map).find(([prefix]) => model.startsWith(prefix))?.[1];

    return hit || model || process.env.DEVICEFARM_DEVICE_NAME || 'Device Farm';
}
