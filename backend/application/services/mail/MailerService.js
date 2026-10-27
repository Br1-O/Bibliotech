const { AccountManager } = require('../../../infrastructure/mail/AccountManager');
const { EmailDispatcher } = require('../../../infrastructure/mail/EmailDispatcher');

class MailerService {
  constructor() {
    this.accountManager = new AccountManager();
  }

  async send({ to, subject, html, text, fromAccount, senderName = 'Organización Bibliotech' }) {
    const logs = [];

    if (fromAccount) {
      try {
        const sentBy = await EmailDispatcher.send({ account: fromAccount, to, subject, html, text, senderName });
        logs.push({ account: fromAccount.user, success: true });
        return { sentBy, accountLogs: logs };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logs.push({ account: fromAccount.user, success: false, error: errorMsg });
        throw new Error(`[MailerService] La cuenta preferida ${fromAccount.user} falló: ${errorMsg}`);
      }
    }

    const accounts = this.accountManager.getAccounts();
    if (!accounts.length) {
      throw new Error('[MailerService] No hay cuentas de correo configuradas en EMAIL_USER_1 / EMAIL_PASS_1.');
    }
    const startIndex = this.accountManager.getRandomStartIndex();
    let lastError = null;

    for (let i = 0; i < accounts.length; i++) {
      const currentAccount = accounts[(startIndex + i) % accounts.length];
      try {
        console.log(`[MailerService] Intentando envío con: ${currentAccount.user}`);
        const sentBy = await EmailDispatcher.send({ account: currentAccount, to, subject, html, text, senderName });
        logs.push({ account: currentAccount.user, success: true });
        return { sentBy, accountLogs: logs };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.warn(`[MailerService] Falló la casilla ${currentAccount.user}. Probando la siguiente...`, errorMsg);
        logs.push({ account: currentAccount.user, success: false, error: errorMsg });
        lastError = error;
      }
    }

    const err = Object.assign(
      new Error(`[MailerService] Se agotaron todas las casillas de Gmail (${accounts.length}). Último error: ${lastError instanceof Error ? lastError.message : String(lastError)}`),
      { accountLogs: logs }
    );
    throw err;
  }
}

const mailerService = new MailerService();

module.exports = { MailerService, mailerService };
