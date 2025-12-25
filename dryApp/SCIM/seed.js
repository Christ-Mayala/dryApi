const PropertySchema = require('./features/property/model/property.schema');
const ReservationSchema = require('./features/reservation/model/reservation.schema');
const MessageSchema = require('./features/message/model/message.schema');

module.exports = async ({ appName, getModel }) => {
    const User = getModel(appName, 'User');
    const Property = getModel(appName, 'Property', PropertySchema);
    const Reservation = getModel(appName, 'Reservation', ReservationSchema);
    const Message = getModel(appName, 'Message', MessageSchema);

    let client = await User.findOne({ email: 'client@scim.local' });
    if (!client) {
        client = await User.create({
            name: 'Client SCIM',
            nom: 'Client SCIM',
            email: 'client@scim.local',
            telephone: '+237600000000',
            password: 'Client@2026',
            role: 'user',
            status: 'active',
        });
    }

    const existingCount = await Property.countDocuments({ isDeleted: false });
    if (existingCount === 0) {
        const admin = await User.findOne({ role: 'admin' });

        const p1 = await Property.create({
            titre: 'Maison à louer - Bon plan',
            description: 'Maison moderne, bon plan.',
            prix: 250000,
            prixOriginal: 300000,
            devise: 'XAF',
            ville: 'Douala',
            adresse: 'Bonapriso',
            transactionType: 'location',
            categorie: 'Maison',
            isBonPlan: true,
            bonPlanLabel: '-15% cette semaine',
            bonPlanExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            images: [],
            utilisateur: admin?._id || client._id,
        });

        const p2 = await Property.create({
            titre: 'Appartement en vente',
            description: 'Appartement spacieux.',
            prix: 45000000,
            devise: 'XAF',
            ville: 'Yaoundé',
            adresse: 'Bastos',
            transactionType: 'vente',
            categorie: 'Appartement',
            images: [],
            utilisateur: admin?._id || client._id,
        });

        const p3 = await Property.create({
            titre: 'Hôtel bon plan',
            description: 'Offre spéciale hôtel.',
            prix: 35000,
            devise: 'XAF',
            ville: 'Kribi',
            adresse: 'Front de mer',
            transactionType: 'location',
            categorie: 'Hôtel',
            isBonPlan: true,
            bonPlanLabel: '2 nuits = 1 offerte',
            bonPlanExpiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            images: [],
            utilisateur: admin?._id || client._id,
        });

        await Reservation.create({
            property: p1._id,
            user: client._id,
            date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            status: 'en attente',
        });

        await Message.create({
            expediteur: client._id,
            destinataire: admin?._id || client._id,
            contenu: `Bonjour SCIM, je suis intéressé par: ${p1.titre}`,
        });

        client.favoris = client.favoris || [];
        client.favoris.push(p2._id);
        await client.save();

        p2.favoris = p2.favoris || [];
        p2.favoris.push(client._id);
        await p2.save();

        await Message.create({
            expediteur: admin?._id || client._id,
            destinataire: client._id,
            contenu: `Bonjour, merci pour votre intérêt. Nous pouvons organiser une visite.`,
        });

        void p3;
    }
};
