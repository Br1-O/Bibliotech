const nodemailer = require('nodemailer');

const transporters = new Map();

class EmailDispatcher {
  static getTransporter({ user, pass }) {
    const cached = transporters.get(user);
    if (cached && cached.pass === pass) return cached.transporter;

    if (cached) cached.transporter.close();
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      pool: true,
      maxConnections: 3,
      maxMessages: 100,
      auth: { user, pass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
    transporters.set(user, { pass, transporter });
    return transporter;
  }

  static async send({ account, to, subject, html, text, senderName }) {
    const transporter = this.getTransporter(account);
    await transporter.sendMail({
      from: `"${senderName}" <${account.user}>`,
      to,
      subject,
      html,
      text,
    });
    return account.user;
  }

  static closeAll() {
    transporters.forEach(({ transporter }) => transporter.close());
    transporters.clear();
  }
}

module.exports = { EmailDispatcher };
