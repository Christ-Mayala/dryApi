const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

// --- GRANT PREMIUM (Admin Targeted Promotion) ---
// Method: POST
// Route: /api/v1/lastreet/admin/users/:id/grant-premium
// Body: { days: number (optional, default 7), plan: string (optional, default 'starter') }
module.exports = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { days = 7, plan = 'starter' } = req.body;

    const User = req.getModel('User');
    const Professional = req.getModel('Professional', require('../../professionals/model/professional.schema'));

    const user = await User.findById(id);
    if (!user) throw new Error('Utilisateur introuvable');

    const durationMs = parseInt(days, 10) * 24 * 60 * 60 * 1000;
    
    // Si l'utilisateur est déjà premium, on prolonge à partir de son expiration actuelle
    // Sinon, on démarre à partir de maintenant
    let newExpiration;
    if (user.isPremium && user.premiumUntil > Date.now()) {
        newExpiration = new Date(user.premiumUntil.getTime() + durationMs);
    } else {
        newExpiration = new Date(Date.now() + durationMs);
    }

    // 1. Mettre à jour l'Utilisateur
    user.isPremium = true;
    user.premiumUntil = newExpiration;
    user.premiumPlan = plan;
    await user.save();

    // 2. Cascade : Mettre à jour le Profil Professionnel associé s'il en a un
    await Professional.updateMany(
        { createdBy: user._id },
        { 
            $set: { 
                isPremium: true, 
                premiumUntil: newExpiration 
            } 
        }
    );

    sendResponse(res, { user, daysGranted: parseInt(days, 10), newExpiration }, `Premium accordé pour ${days} jours avec succès`);
});
