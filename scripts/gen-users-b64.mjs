// Gera o texto base64 das contas para colar nos GitHub Secrets
// (CLIENT_USERS_ANDROID_B64 / CLIENT_USERS_IOS_B64).
//
// Uso:
//   node scripts/gen-users-b64.mjs <senha> <email1,email2,email3,...>
//
// Exemplo (6 contas Android com a mesma senha):
//   node scripts/gen-users-b64.mjs MinhaSenha123 a1@x.com,a2@x.com,a3@x.com,a4@x.com,a5@x.com,a6@x.com
//
// A ordem dos emails = a ordem das contas (conta[0], conta[1], ...), que casa
// com os índices em test/utils/device-index.ts.
//
// Este script NÃO guarda nada: ele só imprime o base64 no terminal. Seguro para
// ficar no repositório (não contém senhas).

const [, , senha, emailsCsv] = process.argv;

if (!senha || !emailsCsv) {
    console.error('Uso: node scripts/gen-users-b64.mjs <senha> <email1,email2,...>');
    process.exit(1);
}

const emails = emailsCsv.split(',').map((e) => e.trim()).filter(Boolean);
const contas = emails.map((email) => ({ user: email, password: senha }));

const b64 = Buffer.from(JSON.stringify(contas)).toString('base64');

console.log(`\n${contas.length} conta(s):`);
contas.forEach((c, i) => console.log(`  conta[${i}] = ${c.user}`));
console.log('\n=== COLE ISTO NO GITHUB SECRET ===\n');
console.log(b64);
console.log('');
