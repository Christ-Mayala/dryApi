const templates = {
    // Template de bienvenue (création de compte)
    WELCOME_REGISTER: (name) => `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h1 style="color: #111;">Bienvenue, ${name} !</h1>
            <p>Votre compte <strong>La STREET</strong> a été créé avec succès.</p>
            <p style="color:#444">Vous pouvez maintenant vous connecter et contacter des professionnels.</p>
        </div>
    `,
    // Template création Agence
    AGENCE_CREATED: (userName, agenceName, link) => `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd;">
            <h2 style="color: #2c3e50;">Félicitations ${userName}</h2>
            <p>Votre agence <strong>${agenceName}</strong> est enregistrée.</p>
            <p>Votre licence a été stockée de manière sécurisée.</p>
            <a href="${link}" style="background: #3498db; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px;">Voir la licence</a>
        </div>
    `,
    // Template notification générale
    NOTIFICATION: (message) => `
        <div style="padding: 20px;">
            <h3>Notification</h3>
            <p>${message}</p>
        </div>
    `,
    // Template réinitialisation mot de passe
    PASSWORD_RESET: (name, code) => `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #111; text-align: center;">Code de réinitialisation</h1>
            <p>Bonjour ${name},</p>
            <p>Vous avez demandé à réinitialiser votre mot de passe <strong>La STREET</strong>.</p>
            <div style="background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; font-size: 14px; color: #666;">Votre code de réinitialisation est :</p>
                <h2 style="margin: 10px 0; font-size: 32px; letter-spacing: 5px; color: #007bff; font-family: monospace;">${code}</h2>
            </div>
            <p style="color: #666; font-size: 14px;">Ce code expire dans 15 minutes.</p>
            <p style="color: #666; font-size: 14px;">Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
        </div>
    `,
    // Template confirmation réinitialisation
    PASSWORD_RESET_CONFIRM: (name) => `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #28a745; text-align: center;">Mot de passe réinitialisé</h1>
            <p>Bonjour ${name},</p>
            <p>Votre mot de passe <strong>La STREET</strong> a été réinitialisé avec succès.</p>
            <p>Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="http://localhost:4200/login" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Se connecter</a>
            </div>
            <p style="color: #666; font-size: 14px;">Si vous n'avez pas effectué cette action, contactez-nous immédiatement.</p>
        </div>
    `
};

module.exports = templates;