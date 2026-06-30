// Mapa determinístico device -> índice da conta (NÃO secreto).
//
// Cada device do pool recebe um índice único na lista de contas da sua
// plataforma, garantindo que cada conta seja usada por exatamente um device por
// run. A chave é o DEVICEFARM_DEVICE_NAME (legível e estável para um pool de
// modelos distintos). Se houver nomes duplicados no pool (mesmo modelo repetido),
// troque a chave pelo DEVICEFARM_DEVICE_UDID — o helper getCredentials() já lê o
// UDID; basta mudar a fonte da chave lá.
//
// Como descobrir os nomes: o workflow imprime "Device: $NAME -> $RES" no passo
// "Download artifacts" (.github/workflows/mobile_test.yml), ou rode
//   aws devicefarm list-devices-for-device-pool --arn <pool>
//
// Android: 6 devices -> índices 0..5    iOS: 5 devices -> índices 0..4
export const deviceIndex: Record<'android' | 'ios', Record<string, number>> = {
    android: {
        "Samsung Galaxy S23 Ultra": 0,
        "Samsung Galaxy S23+": 1,
        "Samsung Galaxy S24 Ultra": 2,
        "Samsung Galaxy S24+": 3,
        "Samsung Galaxy S25 Ultra": 4,
        "Samsung Galaxy S26 Ultra": 5,
    },
    ios: {
        "Apple iPhone 13": 0,
        "Apple iPhone 14": 1,
        "Apple iPhone 14 Pro Max": 2,
        "Apple iPhone 15": 3,
        "Apple iPhone 15 Pro Max": 4,
    },
};
