const slugify = require('slugify');
const mongoose = require('mongoose');

module.exports = function (schema, options) {
    // 1. Definition des champs standards DRY
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

    // 2. Middleware Pre-save : Generation de Slug
    // CORRECTION : Async sans 'next'
    schema.pre('save', async function () {
        // Garantir un label si absent (source principale du slug)
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

        if (!this.slug) {
            const source = this.name || this.label || this.titre || this.title || this.subject;
            if (source) {
                this.slug = slugify(source, { lower: true, strict: true }) + '-' + Date.now().toString().slice(-4);
            }
        }

        if (this.isModified('status') && this.status === 'deleted' && !this.deletedAt) {
            this.deletedAt = new Date();
        }
    });

    // 3. Middleware Query : Soft Delete
    // Par defaut, on masque les documents supprimes.
    // Exception: si la requete contient { includeDeleted: true } ou un filtre explicite status='deleted'.
    schema.pre(/^find/, async function () {
        const currentFilter = this.getQuery() || {};

        if (currentFilter.includeDeleted === true) {
            delete currentFilter.includeDeleted;
            return;
        }

        if (currentFilter.status !== 'deleted') {
            this.where({ status: { $ne: 'deleted' } });
        }
    });
};
