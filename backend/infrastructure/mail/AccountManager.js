const { logger } = require('../../utils/logger');

class AccountManager {
  constructor(maxAccounts = 10) {
    this.accounts = this._loadAccounts(maxAccounts);
  }

  _loadAccounts(max) {
    const accounts = [];
    for (let i = 1; i <= max; i++) {
      const user = process.env[`EMAIL_USER_${i}`];
      const pass = process.env[`EMAIL_PASS_${i}`];

      if (user && pass) {
        accounts.push({ user: String(user).trim(), pass: String(pass).trim() });
      }
    }

    if (accounts.length === 0) {
      logger.warn('mail.no_accounts_configured');
    }

    return accounts;
  }

  getAccounts() {
    return this.accounts;
  }

  hasAccounts() {
    return this.accounts.length > 0;
  }

  getRandomStartIndex() {
    return this.accounts.length ? Math.floor(Math.random() * this.accounts.length) : 0;
  }
}

module.exports = { AccountManager };
