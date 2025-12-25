const ProductSchema = require('./features/product/model/product.schema');
const AtelierSchema = require('./features/atelier/model/atelier.schema');
const ImpactSchema = require('./features/impact/model/impact.schema');
const GallerySchema = require('./features/gallery/model/gallery.schema');
const ContactSchema = require('./features/contact/model/contact.schema');

module.exports = async ({ appName, getModel }) => {
    const Product = getModel(appName, 'Product', ProductSchema);
    const Atelier = getModel(appName, 'Atelier', AtelierSchema);
    const Impact = getModel(appName, 'Impact', ImpactSchema);
    const Gallery = getModel(appName, 'Gallery', GallerySchema);
    const Contact = getModel(appName, 'Contact', ContactSchema);

    if ((await Product.countDocuments({})) === 0) {
        await Product.create({ name: 'Sac cuir', category: 'sac', price: 25000, description: 'Sac en cuir', images: [] });
        await Product.create({ name: 'Sandale artisanale', category: 'sandale', price: 12000, description: 'Sandale', images: [] });
    }

    if ((await Atelier.countDocuments({})) === 0) {
        await Atelier.create({
            name: 'Atelier couture',
            description: 'Atelier couture',
            duration: '3 semaines',
            images: [],
            videos: [],
            nextSession: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
    }

    if ((await Impact.countDocuments({})) === 0) {
        await Impact.create({ name: 'Action solidaire', description: 'Collecte', images: [], videos: [], location: 'Douala' });
    }

    if ((await Gallery.countDocuments({})) === 0) {
        await Gallery.create({ name: 'Photo atelier', category: 'atelier', imageUrl: 'https://example.com/gallery1.jpg' });
    }

    if ((await Contact.countDocuments({})) === 0) {
        await Contact.create({ name: 'Visiteur', phone: '+237699999999', email: 'visitor@example.com', subject: 'Infos', message: 'Bonjour' });
    }
};
