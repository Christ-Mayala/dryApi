const nodemailer = require('nodemailer');
const logger = require('../../utils/logger');

const sendEmail = async (options) => {
    if (!process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD || !process.env.FROM_EMAIL) {
        return false;
    }

    const transporter = nodemailer.createTransport({
        service: process.env.SMTP_SERVICE || 'gmail',
        auth: {
            user: process.env.SMTP_EMAIL,
            pass: process.env.SMTP_PASSWORD,
        },
    });

    const fromName = process.env.FROM_NAME || 'La STREET';

    const message = {
        from: `${fromName} <${process.env.FROM_EMAIL}>`,
        to: options.email,
        subject: options.subject,
        html: options.html,
    };

    try {
        await transporter.sendMail(message);
        logger(`Email envoyé à : ${options.email}`, 'info');
        return true;
    } catch (error) {
        logger(`Erreur Email : ${error.message}`, 'error');
        return false;
    }
};
module.exports = sendEmail;