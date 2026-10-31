// Le schéma User est partagé par le noyau DRY; cet adaptateur conserve la frontière du tenant.
exports.forTenant = req => req.getModel('User');
