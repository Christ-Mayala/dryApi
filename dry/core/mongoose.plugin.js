const slugify = require('slugify');

module.exports = function (schema, options) {
    // 1. Définition des champs standards
    schema.add({
        status: {
            type: String,
            enum: ['active', 'inactive', 'deleted', 'banned'],
            default: 'active',
            index: true,
        },
        deletedAt: { type: Date, index: true },
        slug: { type: String, unique: true, index: true, sparse: true },
    });

    // 2. Middleware Pre-save : Génération de Slug
    // CORRECTION : Async sans 'next'
    schema.pre('save', async function () {
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
    // Par défaut, on masque les documents supprimés.
    // Exception: si la requête contient { includeDeleted: true } ou un filtre explicite status='deleted'.
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