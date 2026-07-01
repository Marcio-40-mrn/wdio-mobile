// Mapa determinístico device -> índice da conta (NÃO secreto).
//
// Cada device do pool recebe um índice único na lista de contas da sua plataforma,
// garantindo que cada conta seja usada por exatamente um device por run. A chave é o
// MODELO do device (ro.product.model), que o UiAutomator2 expõe como `deviceModel` nas
// capabilities da sessão. NÃO usar DEVICEFARM_DEVICE_NAME: essa env var é o número de
// SÉRIE do aparelho (no iOS, o UDID) e muda a cada run — nunca casaria com um mapa fixo.
//
// A chave Android é o PREFIXO do modelo (sem o sufixo de região "U1"/"U"/"B"), casado com
// `startsWith` em getCredentials() — resiliente a variações de região. Os prefixos S9xx
// são todos distintos (nenhum é prefixo do outro).
//
// Como descobrir os modelId: aws devicefarm list-jobs --arn <run> \
//   --query "jobs[].{name:device.name, modelId:device.modelId}"
//
// Android: 6 modelos -> índices 0..5    iOS: 5 modelos -> índices 0..4
export const deviceIndex: Record<'android' | 'ios', Record<string, number>> = {
    android: {
        "SM-S918": 0,  // Galaxy S23 Ultra
        "SM-S916": 1,  // Galaxy S23+
        "SM-S928": 2,  // Galaxy S24 Ultra
        "SM-S926": 3,  // Galaxy S24+
        "SM-S938": 4,  // Galaxy S25 Ultra
        "SM-S948": 5,  // Galaxy S26 Ultra
    },
    // iOS: best-effort. No XCUITest o `deviceModel` pode não vir como o modelId "A2649"
    // (formato incerto, ex.: "iPhone14,5"). O fluxo iOS ainda quebra no onboarding, então
    // isto precisa ser VERIFICADO em runtime quando o iOS for implementado.
    ios: {
        "A2482": 0,  // iPhone 13
        "A2649": 1,  // iPhone 14
        "A2651": 2,  // iPhone 14 Pro Max
        "A2846": 3,  // iPhone 15
        "A2849": 4,  // iPhone 15 Pro Max
    },
};
