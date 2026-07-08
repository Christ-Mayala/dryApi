const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { validateId } = require('../../../../../dry/middlewares/validation/validation.middleware');
const { validateSCIM } = require('../../../validation/middleware');

// Imports des modèles pour le queryBuilder
const ReservationSchema = require('../../reservation/model/reservation.schema');
const PropertySchema = require('../../property/model/property.schema');
const PropertySubmissionSchema = require('../../property/model/propertySubmission.schema');
const MessageSchema = require('../../message/model/message.schema');
const UserPublicSchema = require('../../users/model/userPublic.schema');

// Middleware de filtrage réutilisable (comme advancedResults de control-api)
const queryBuilder = require('../../../../../dry/middlewares/query/queryBuilder');

const getDashboardStats = require('../controller/admin.dashboardStats.controller');
const getAllReservations = require('../controller/admin.reservations.list.controller');
const updateReservationStatus = require('../controller/admin.reservations.updateStatus.controller');

const getAllProperties = require('../controller/admin.properties.list.controller');
const getPropertyById = require('../controller/admin.properties.get.controller');
const updatePropertyStatus = require('../controller/admin.properties.updateStatus.controller');
const deleteProperty = require('../controller/admin.properties.delete.controller');
const listPropertySubmissions = require('../controller/admin.propertySubmissions.list.controller');
const updatePropertySubmission = require('../controller/admin.propertySubmissions.update.controller');
const updatePropertySubmissionStatus = require('../controller/admin.propertySubmissions.updateStatus.controller');
const deletePropertySubmission = require('../controller/admin.propertySubmissions.delete.controller');

const getAllUsers = require('../controller/admin.users.list.controller');
const getUserById = require('../controller/admin.users.get.controller');
const updateUser = require('../controller/admin.users.update.controller');
const updateUserRole = require('../controller/admin.users.updateRole.controller');
const deleteUser = require('../controller/admin.users.delete.controller');
const restoreUser = require('../controller/admin.users.restore.controller');

const getAllMessages = require('../controller/admin.messages.list.controller');
const getMessageById = require('../controller/admin.messages.get.controller');
const updateMessageStatus = require('../controller/admin.messages.updateStatus.controller');
const deleteMessage = require('../controller/admin.messages.delete.controller');

const getPropertyAnalytics = require('../controller/admin.analytics.properties.controller');
const getUserAnalytics = require('../controller/admin.analytics.users.controller');
const getRevenueAnalytics = require('../controller/admin.analytics.revenue.controller');

const getSystemSettings = require('../controller/admin.settings.get.controller');
const updateSystemSettings = require('../controller/admin.settings.update.controller');

router.use(protect);
router.use(authorize('admin'));
router.get('/dashboard/stats', getDashboardStats);

// GET /reservations avec queryBuilder (filtrage, pagination, tri)
router.get('/reservations', 
    queryBuilder(
        (req) => req.getModel('Reservation', ReservationSchema),
        [
            { path: 'property', select: 'titre ville adresse prix devise categorie images utilisateur isBonPlan bonPlanLabel bonPlanExpiresAt' },
            { path: 'user', select: 'name nom email telephone role' }
        ]
    ),
    getAllReservations
);
router.put('/reservations/:id/status', validateId, updateReservationStatus);

// GET /properties avec queryBuilder + filtre isDeleted:false par défaut
router.get('/properties', 
    queryBuilder(
        (req) => req.getModel('Property', PropertySchema),
        [
            { path: 'utilisateur', select: 'name nom email telephone role' },
            { path: 'adminReference', select: 'name nom email' }
        ],
        { defaultFilter: { isDeleted: false } }
    ),
    getAllProperties
);
router.get('/properties/:id', validateId, getPropertyById);
router.put('/properties/:id/status', validateId, updatePropertyStatus);
router.delete('/properties/:id', validateId, deleteProperty);

// GET /property-submissions avec queryBuilder
router.get('/property-submissions',
    queryBuilder(
        (req) => req.getModel('PropertySubmission', PropertySubmissionSchema),
        [
            { path: 'submitter.user', select: 'name nom email telephone' },
            { path: 'reviewedBy', select: 'name nom email telephone' },
            { path: 'createdProperty', select: 'titre prix ville adresse categorie' }
        ]
    ),
    listPropertySubmissions
);
router.put('/property-submissions/:id', validateId, validateSCIM.property.submissionUpdate, updatePropertySubmission);
router.put('/property-submissions/:id/status', validateId, validateSCIM.property.submissionReview, updatePropertySubmissionStatus);
router.delete('/property-submissions/:id', validateId, deletePropertySubmission);

// GET /users avec queryBuilder + exclure le mot de passe
router.get('/users',
    queryBuilder(
        (req) => req.getModel('User', UserPublicSchema),
        null,
        { select: '-password' }
    ),
    getAllUsers
);
router.get('/users/:id', validateId, getUserById);
router.put('/users/:id', validateId, updateUser);
router.put('/users/:id/role', validateId, updateUserRole);
router.delete('/users/:id', validateId, deleteUser);
router.patch('/users/:id/restore', validateId, restoreUser);

// GET /messages avec queryBuilder
// Middleware de transformation : le frontend envoie status=unread/read, le schema Message utilise lu (boolean)
const mapMessageStatus = (req, res, next) => {
    if (req.query.status && req.query.status !== 'all') {
        // req.query est un getter (Express re-parse l'URL à chaque accès) : muter ses
        // propriétés ne persiste pas. On redéfinit la propriété avec une valeur figée.
        const nextQuery = { ...req.query, lu: req.query.status === 'unread' ? false : true };
        delete nextQuery.status;
        Object.defineProperty(req, 'query', {
            value: nextQuery,
            writable: true,
            configurable: true,
            enumerable: true,
        });
    }
    next();
};
router.get('/messages',
    mapMessageStatus,
    queryBuilder(
        (req) => req.getModel('Message', MessageSchema),
        [
            { path: 'expediteur', select: 'name nom email telephone' },
            { path: 'destinataire', select: 'name nom email telephone' }
        ]
    ),
    getAllMessages
);
router.get('/messages/:id', validateId, getMessageById);
router.put('/messages/:id/status', validateId, updateMessageStatus);
router.delete('/messages/:id', validateId, deleteMessage);

router.get('/analytics/properties', getPropertyAnalytics);
router.get('/analytics/users', getUserAnalytics);
router.get('/analytics/revenue', getRevenueAnalytics);

router.get('/settings', getSystemSettings);
router.put('/settings', updateSystemSettings);

module.exports = router;
