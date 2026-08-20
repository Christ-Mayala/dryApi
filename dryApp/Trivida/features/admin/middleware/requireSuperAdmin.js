/**
 * Middleware requireSuperAdmin (ou requireAdmin)
 * 
 * Protège les routes admin en vérifiant que l'utilisateur authentifié
 * a le rôle 'admin' ou 'superadmin'.
 * 
 * Pour les routes sensibles (settings, app update), on peut passer
 * requireSuperAdmin(true) pour n'accepter que 'superadmin'.
 * 
 * @example
 * router.get('/users', protect, requireSuperAdmin(), getUsers);
 * router.patch('/settings', protect, requireSuperAdmin(true), updateSettings);
 */
const sendResponse = require('../../../../../dry/utils/http/response');

const requireSuperAdmin = (superAdminOnly = false) => {
    return (req, res, next) => {
        if (!req.user) {
            return sendResponse(res, null, 'Non authentifié', false, undefined, 401);
        }
        
        // Les deux rôles ont accès par défaut
        const allowedRoles = superAdminOnly 
            ? ['superadmin'] 
            : ['admin', 'superadmin'];
        
        if (!allowedRoles.includes(req.user.role)) {
            return sendResponse(
                res, 
                null, 
                `Accès refusé. Rôle '${req.user.role}' insuffisant. Requis: ${allowedRoles.join(' ou ')}`, 
                false, 
                undefined, 
                403
            );
        }
        
        next();
    };
};

module.exports = requireSuperAdmin;
