const slugify = require('slugify');
const mongoose = require('mongoose');
const LogSchema = require('../../modules/log/log.schema');

module.exports = function (schema, options) {
    // ---------------------------------------------------------
    // 1. Definition des champs standards DRY
    // ---------------------------------------------------------
    const baseFields = {
        deletedAt: { type: Date, index: true },
        slug: { type: String, unique: true, index: true, sparse: true },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    };

    if (!schema.path('status')) {
        baseFields.status = {
            type: String,
            enum: ['active', 'inactive', 'deleted', 'banned'],
            default: 'active',
            index: true,
        };
    }

    if (!schema.path('label')) {
        baseFields.label = { type: String, trim: true, index: true };
    }

    schema.add(baseFields);

    // ---------------------------------------------------------
    // 2. Middleware Pre-save : Logic Metier & Audit Prep
    // ---------------------------------------------------------
    schema.pre('save', async function () {
        // [AUDIT] Capture l'etat avant modification pour le log
        this._wasNew = this.isNew;
        this._modifiedPaths = this.modifiedPaths();

        // [LOGIC] Garantir un label si absent (source principale du slug)
        if (!this.label) {
            const sourceLabel =
                this.name ||
                this.titre ||
                this.title ||
                this.subject ||
                this.nom ||
                this.prenom ||
                this.email;

            if (sourceLabel) {
                this.label = sourceLabel;
            } else {
                // Fallback: premier champ string du schema
                const stringPath = Object.values(schema.paths).find(
                    (p) => p?.instance === 'String' && !['__v', 'slug', 'label'].includes(p.path)
                );
                if (stringPath && this[stringPath.path]) {
                    this.label = this[stringPath.path];
                }
            }
        }

        // [LOGIC] Generation de Slug
        if (!this.slug) {
            const source = this.name || this.label || this.titre || this.title || this.subject;
            if (source) {
                this.slug = slugify(source, { lower: true, strict: true }) + '-' + Date.now().toString().slice(-4);
            }
        }

        // [LOGIC] Gestion Soft Delete
        if (this.isModified('status') && this.status === 'deleted' && !this.deletedAt) {
            this.deletedAt = new Date();
        }
    });

    // ---------------------------------------------------------
    // 3. 🕵️ Audit Trail (Historique)
    // ---------------------------------------------------------
    schema.post('save', async function (doc) {
        try {
            // Determiner l'action
            let action = 'update';
            if (doc._wasNew) action = 'create';
            if (doc.status === 'deleted' && doc._modifiedPaths?.includes('status')) action = 'soft-delete';

            // Connexion DB du tenant actuel
            const db = doc.db;
            if (!db) return;

            // Recuperer ou compiler le modele Log sur cette connexion (Multi-tenant)
            const LogModel = db.models.Log || db.model('Log', LogSchema);

            // Preparer les changements (sauf pour create)
            const changes = {};
            if (action !== 'create' && doc._modifiedPaths) {
                doc._modifiedPaths.forEach(path => {
                    if (!['updatedAt', 'createdAt', '__v', 'slug'].includes(path)) {
                        changes[path] = doc[path];
                    }
                });
            }

            // Creer le log
            await LogModel.create({
                action,
                collectionName: doc.constructor.modelName,
                documentId: doc._id,
                user: doc.updatedBy || doc.createdBy,
                changes: action === 'create' ? 'created' : changes
            });

        } catch (error) {
            console.error(`[AUDIT ERROR] Impossible de logger pour ${doc.constructor.modelName}:`, error.message);
        }
    });

    // ---------------------------------------------------------
    // 4. 🔗 Auto-Populate & Soft Delete Filter
    // ---------------------------------------------------------
    schema.pre(/^find/, async function () {
        // Option pour desactiver l'auto-populate si besoin
        if (!this.options.skipAutoPopulate) {
            // Populate createdBy/updatedBy avec name, nom et email
            this.populate('createdBy', 'name nom email');
            this.populate('updatedBy', 'name nom email');
        }
        
        // Appliquer le filtre Soft Delete existant
        const currentFilter = this.getQuery() || {};
        
        // Si on demande explicitement les supprimes
        if (currentFilter.includeDeleted === true) {
            delete currentFilter.includeDeleted;
            return;
        }

        // Sinon on masque les supprimes par defaut
        if (currentFilter.status !== 'deleted') {
            this.where({ status: { $ne: 'deleted' } });
        }
    });

    // ---------------------------------------------------------
    // 5. 🛡️ Masquage de sécurité (toJSON)
    // ---------------------------------------------------------
    const originalTransform = schema.options.toJSON && schema.options.toJSON.transform;

    schema.set('toJSON', {
        virtuals: true,
        transform: function (doc, ret, options) {
            // 1. Appliquer le transform d'origine s'il existe (ex: UserSchema)
            if (originalTransform) {
                const result = originalTransform(doc, ret, options);
                if (result) ret = result;
            }

            // 2. Masquage Securite Global
            delete ret.__v;
            delete ret.password;
            delete ret.refreshTokens; // Securite JWT
            
            // 3. Masquer les donnees de suppression
            if (ret.status === 'deleted') {
               delete ret.deletedAt;
            }

            return ret;
        }
    });
};
