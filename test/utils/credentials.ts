import { deviceIndex } from "./device-index";

export interface Credentials {
    user: string;
    password: string;
}

// Seleciona a conta deste device em runtime.
//
// No Device Farm, as variáveis de ambiente são globais ao run (todos os devices
// recebem as mesmas), então a escolha da conta tem que acontecer aqui, a partir
// da identidade do device. CLIENT_USERS_B64 é uma lista (base64 de JSON) de
// contas da plataforma; deviceIndex mapeia cada device a um índice único nessa
// lista, garantindo uma conta distinta por device.
//
// Fallback (local / single device): CLIENT_USER + CLIENT_PASSWORD do .env.
export function getCredentials(): Credentials {
    const isIOS = process.env.PLATFORM === 'ios';
    const isDeviceFarm = !!process.env.DEVICEFARM_DEVICE_UDID;
    const usersB64 = process.env.CLIENT_USERS_B64;

    if (usersB64 && isDeviceFarm) {
        const list = JSON.parse(
            Buffer.from(usersB64, 'base64').toString('utf8')
        ) as Credentials[];

        const name = process.env.DEVICEFARM_DEVICE_NAME ?? '';
        const map = deviceIndex[isIOS ? 'ios' : 'android'];
        const index = map[name];

        if (index !== undefined && index >= 0 && index < list.length) {
            const chosen = list[index];
            console.log(
                `🔑 Device "${name}" -> conta[${index}] = ${chosen.user}`
            );
            return chosen;
        }

        console.warn(
            `⚠️ Device não mapeado em device-index.ts: "${name}" ` +
            `(plataforma ${isIOS ? 'ios' : 'android'}, índice=${index}). ` +
            `Usando conta[0] como fallback — ajuste o mapa para garantir ` +
            `unicidade.`
        );
        return list[0];
    }

    return {
        user: process.env.CLIENT_USER!,
        password: process.env.CLIENT_PASSWORD!,
    };
}
