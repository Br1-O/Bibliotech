const nodemailer = require('nodemailer');

class EmailDispatcher {
  static async send({ account, to, subject, html, text, senderName }) {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: account.user,
        pass: account.pass,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });

    await transporter.sendMail({
      from: `"${senderName}" <${account.user}>`,
      to,
      subject,
      html,
      text,
    });

    return account.user;
  }
}

module.exports = { EmailDispatcher };
