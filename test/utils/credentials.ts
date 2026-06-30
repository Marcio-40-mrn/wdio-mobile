import { deviceIndex } from "./device-index";

export interface Credentials {
    user: string;
    password: string;
}

// Seleciona a conta deste device em runtime.
//
// No Device Farm, as variáveis de ambiente são globais ao run (todos os devices
// recebem as mesmas), então a escolha da conta tem que acontecer aqui, a partir
// da identidade do device. CLIENT_USERS_EMAILS é uma lista (CSV) dos emails das
// contas da plataforma; a senha é comum a todas (CLIENT_PASSWORD). deviceIndex
// mapeia cada device a um índice único nessa lista, garantindo uma conta distinta
// por device.
//
// Por que CSV de emails (e não base64 de JSON): o Device Farm limita cada variável
// de ambiente a 256 caracteres, e o base64 das contas estourava esse limite.
//
// Fallback (local / single device): CLIENT_USER + CLIENT_PASSWORD do .env.
export function getCredentials(): Credentials {
    const isIOS = process.env.PLATFORM === 'ios';
    const isDeviceFarm = !!process.env.DEVICEFARM_DEVICE_UDID;
    const emailsCsv = process.env.CLIENT_USERS_EMAILS;
    const password = process.env.CLIENT_PASSWORD!;

    if (emailsCsv && isDeviceFarm) {
        const emails = emailsCsv
            .split(',')
            .map((e) => e.trim())
            .filter(Boolean);

        const name = process.env.DEVICEFARM_DEVICE_NAME ?? '';
        const map = deviceIndex[isIOS ? 'ios' : 'android'];
        const index = map[name];

        if (index !== undefined && index >= 0 && index < emails.length) {
            const user = emails[index];
            console.log(
                `🔑 Device "${name}" -> conta[${index}] = ${user}`
            );
            return { user, password };
        }

        console.warn(
            `⚠️ Device não mapeado em device-index.ts: "${name}" ` +
            `(plataforma ${isIOS ? 'ios' : 'android'}, índice=${index}). ` +
            `Usando conta[0] como fallback — ajuste o mapa para garantir ` +
            `unicidade.`
        );
        return { user: emails[0], password };
    }

    return {
        user: process.env.CLIENT_USER!,
        password,
    };
}
