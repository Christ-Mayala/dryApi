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
    `
};

module.exports = templates;