#!/usr/bin/env node

require('dotenv').config();

const { connectCluster } = require('../../dry/config/connection/dbConnection');
const getModel = require('../../dry/core/factories/modelFactory');

const PropertySchema = require('../../dryApp/SCIM/features/property/model/property.schema');
const ReservationSchema = require('../../dryApp/SCIM/features/reservation/model/reservation.schema');
const MessageSchema = require('../../dryApp/SCIM/features/message/model/message.schema');

const {
    buildReservationReference,
    buildSupportPayload,
    buildStatusHistoryEntry,
    normalizePhoneE164,
} = require('../../dryApp/SCIM/features/reservation/controller/reservation.support.util');

const APP_NAME = 'SCIM';

const addDaysAtHour = (daysFromNow, hour = 11, minute = 0) => {
    const d = new Date();
    d.setSeconds(0, 0);
    d.setDate(d.getDate() + daysFromNow);
    d.setHours(hour, minute, 0, 0);
    return d;
};

const usersFixture = [
    {
        key: 'admin',
        name: 'Admin SCIM',
        nom: 'Systeme',
        email: process.env.SEED_ADMIN_EMAIL || 'admin@admin.com',
        telephone: '+242060000001',
        password: process.env.SEED_ADMIN_PASSWORD || 'Admin@2026',
        role: 'admin',
        status: 'active',
    },
    {
        key: 'owner_1',
        name: 'Armand',
        nom: 'Mabiala',
        email: 'owner1@scim.local',
        telephone: '+242060000101',
        password: 'Owner@2026',
        role: 'user',
        status: 'active',
    },
    {
        key: 'owner_2',
        name: 'Clarisse',
        nom: 'Tchicaya',
        email: 'owner2@scim.local',
        telephone: '+242060000102',
        password: 'Owner@2026',
        role: 'user',
        status: 'active',
    },
    {
        key: 'owner_3',
        name: 'Ghislain',
        nom: 'Itoua',
        email: 'owner3@scim.local',
        telephone: '+242060000103',
        password: 'Owner@2026',
        role: 'user',
        status: 'active',
    },
    {
        key: 'client_1',
        name: 'Nadia',
        nom: 'Mbemba',
        email: 'client1@scim.local',
        telephone: '+242060000201',
        password: 'User@2026',
        role: 'user',
        status: 'active',
    },
    {
        key: 'client_2',
        name: 'Junior',
        nom: 'Mayenga',
        email: 'client2@scim.local',
        telephone: '+242060000202',
        password: 'User@2026',
        role: 'user',
        status: 'active',
    },
    {
        key: 'client_3',
        name: 'Mireille',
        nom: 'Massamba',
        email: 'client3@scim.local',
        telephone: '+242060000203',
        password: 'User@2026',
        role: 'user',
        status: 'active',
    },
];

const propertyFixture = [
    {
        key: 'brazzaville-appartement-plateau',
        ownerKey: 'owner_1',
        titre: 'Appartement premium - Plateau Centre',
        description: 'Appartement moderne et lumineux au Plateau, proche commerces, ecoles et grands axes. Ideal pour un cadre de vie urbain confortable.',
        prix: 750000,
        prixOriginal: 850000,
        devise: 'XAF',
        ville: 'Brazzaville',
        adresse: 'Avenue Amilcar Cabral, Plateau',
        transactionType: 'location',
        categorie: 'Appartement',
        status: 'active',
        isBonPlan: true,
        bonPlanLabel: 'Offre lancement -12%',
        bonPlanExpiresAt: addDaysAtHour(12, 23, 0),
        nombre_chambres: 3,
        nombre_salles_bain: 2,
        nombre_salons: 1,
        superficie: 130,
        garage: true,
        gardien: true,
        balcon: true,
        piscine: false,
        jardin: false,
        images: [
            { url: 'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1400&q=80', public_id: 'seed/scim/property-plateau-1' },
            { url: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1400&q=80', public_id: 'seed/scim/property-plateau-2' },
            { url: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1400&q=80', public_id: 'seed/scim/property-plateau-3' },
        ],
    },
    {
        key: 'pointe-noire-villa-cotiere',
        ownerKey: 'owner_2',
        titre: 'Villa familiale - Quartier Cotiere',
        description: 'Grande villa avec jardin, dependance et parking prive. Quartier residentiel calme a Pointe-Noire, parfait pour famille.',
        prix: 185000000,
        prixOriginal: 195000000,
        devise: 'XAF',
        ville: 'Pointe-Noire',
        adresse: 'Rue de la Corniche, Cotiere',
        transactionType: 'vente',
        categorie: 'Maison',
        status: 'active',
        isBonPlan: false,
        bonPlanLabel: '',
        bonPlanExpiresAt: null,
        nombre_chambres: 5,
        nombre_salles_bain: 3,
        nombre_salons: 2,
        superficie: 360,
        garage: true,
        gardien: true,
        balcon: true,
        piscine: true,
        jardin: true,
        images: [
            { url: 'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=1400&q=80', public_id: 'seed/scim/property-cotiere-1' },
            { url: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1400&q=80', public_id: 'seed/scim/property-cotiere-2' },
            { url: 'https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1400&q=80', public_id: 'seed/scim/property-cotiere-3' },
        ],
    },
    {
        key: 'makelekele-studio',
        ownerKey: 'owner_3',
        titre: 'Studio equipe - Makelekele',
        description: 'Studio pratique et securise, meuble, avec acces rapide aux transports et commerces. Ideal jeune actif ou etudiant.',
        prix: 280000,
        prixOriginal: 300000,
        devise: 'XAF',
        ville: 'Brazzaville',
        adresse: 'Avenue de la Base, Makelekele',
        transactionType: 'location',
        categorie: 'Appartement',
        status: 'active',
        isBonPlan: true,
        bonPlanLabel: 'Charges incluses 1 mois',
        bonPlanExpiresAt: addDaysAtHour(20, 22, 30),
        nombre_chambres: 1,
        nombre_salles_bain: 1,
        nombre_salons: 1,
        superficie: 45,
        garage: false,
        gardien: false,
        balcon: false,
        piscine: false,
        jardin: false,
        images: [
            { url: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1400&q=80', public_id: 'seed/scim/property-makelekele-1' },
            { url: 'https://images.unsplash.com/photo-1554995207-c18c203602cb?auto=format&fit=crop&w=1400&q=80', public_id: 'seed/scim/property-makelekele-2' },
        ],
    },
    {
        key: 'djiri-terrain',
        ownerKey: 'owner_1',
        titre: 'Terrain titré 900m2 - Djiri',
        description: 'Terrain plat avec acces route et viabilisation proche. Zone en forte croissance, ideal projet immobilier.',
        prix: 42000000,
        prixOriginal: 45000000,
        devise: 'XAF',
        ville: 'Brazzaville',
        adresse: 'Route de Djiri, secteur 4',
        transactionType: 'vente',
        categorie: 'Terrain',
        status: 'active',
        isBonPlan: false,
        bonPlanLabel: '',
        bonPlanExpiresAt: null,
        nombre_chambres: 0,
        nombre_salles_bain: 0,
        nombre_salons: 0,
        superficie: 900,
        garage: false,
        gardien: false,
        balcon: false,
        piscine: false,
        jardin: false,
        images: [
            { url: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1400&q=80', public_id: 'seed/scim/property-djiri-1' },
            { url: 'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&w=1400&q=80', public_id: 'seed/scim/property-djiri-2' },
        ],
    },
    {
        key: 'centre-commercial-open-space',
        ownerKey: 'owner_2',
        titre: 'Local commercial open-space - Centre Ville',
        description: 'Local commercial visible et modulable, fort passage pieton, ideal boutique ou agence.',
        prix: 1200000,
        prixOriginal: 1400000,
        devise: 'XAF',
        ville: 'Brazzaville',
        adresse: 'Boulevard Denis Sassou Nguesso',
        transactionType: 'location',
        categorie: 'Commercial',
        status: 'active',
        isBonPlan: true,
        bonPlanLabel: '2 mois loyer negocies',
        bonPlanExpiresAt: addDaysAtHour(10, 20, 0),
        nombre_chambres: 0,
        nombre_salles_bain: 1,
        nombre_salons: 1,
        superficie: 180,
        garage: true,
        gardien: true,
        balcon: false,
        piscine: false,
        jardin: false,
        images: [
            { url: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1400&q=80', public_id: 'seed/scim/property-commercial-1' },
            { url: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1400&q=80', public_id: 'seed/scim/property-commercial-2' },
        ],
    },
    {
        key: 'moungali-maison-jardin',
        ownerKey: 'owner_3',
        titre: 'Maison renovee avec jardin - Moungali',
        description: 'Maison renovee avec finitions modernes, jardin arriere et espace de vie convivial dans quartier residentiel.',
        prix: 98000000,
        prixOriginal: 105000000,
        devise: 'XAF',
        ville: 'Brazzaville',
        adresse: 'Rue de la Mairie, Moungali',
        transactionType: 'vente',
        categorie: 'Maison',
        status: 'active',
        isBonPlan: false,
        bonPlanLabel: '',
        bonPlanExpiresAt: null,
        nombre_chambres: 4,
        nombre_salles_bain: 2,
        nombre_salons: 2,
        superficie: 240,
        garage: true,
        gardien: false,
        balcon: true,
        piscine: false,
        jardin: true,
        images: [
            { url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=80', public_id: 'seed/scim/property-moungali-1' },
            { url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=80', public_id: 'seed/scim/property-moungali-2' },
        ],
    },
];

const reservationFixture = [
    {
        key: 'r1',
        propertyKey: 'brazzaville-appartement-plateau',
        userKey: 'client_1',
        date: addDaysAtHour(2, 11, 0),
        status: 'en_attente',
        isWhatsapp: true,
    },
    {
        key: 'r2',
        propertyKey: 'pointe-noire-villa-cotiere',
        userKey: 'client_2',
        date: addDaysAtHour(4, 14, 30),
        status: 'confirmee',
        isWhatsapp: false,
    },
    {
        key: 'r3',
        propertyKey: 'makelekele-studio',
        userKey: 'client_3',
        date: addDaysAtHour(3, 16, 0),
        status: 'annulee',
        isWhatsapp: false,
    },
    {
        key: 'r4',
        propertyKey: 'moungali-maison-jardin',
        userKey: 'client_1',
        date: addDaysAtHour(6, 10, 30),
        status: 'en_attente',
        isWhatsapp: true,
    },
];

const messageFixture = [
    {
        fromKey: 'client_1',
        toKey: 'owner_1',
        sujet: 'Question sur appartement Plateau',
        contenu: 'Bonjour, est-ce que les charges de syndic sont incluses dans le loyer mensuel ?'
    },
    {
        fromKey: 'client_2',
        toKey: 'owner_2',
        sujet: 'Visite villa Cotiere',
        contenu: 'Bonjour, je souhaite planifier une visite de la villa ce weekend si possible.'
    },
    {
        fromKey: 'owner_3',
        toKey: 'client_3',
        sujet: 'Disponibilite studio Makelekele',
        contenu: 'Le studio est disponible immediatement. Voulez-vous une visite demain matin ?'
    },
];

const seedUsers = async (User) => {
    const byKey = {};

    for (const user of usersFixture) {
        const payload = {
            name: user.name,
            nom: user.nom,
            telephone: normalizePhoneE164(user.telephone),
            role: user.role,
            status: user.status,
            password: user.password,
        };

        let doc = await User.findOne({ email: user.email }).select('+password');
        if (!doc) {
            doc = await User.create({ ...payload, email: user.email });
        } else {
            let changed = false;
            ['name', 'nom', 'telephone', 'role', 'status'].forEach((field) => {
                if (payload[field] !== undefined && String(doc[field] || '') !== String(payload[field] || '')) {
                    doc[field] = payload[field];
                    changed = true;
                }
            });
            if (payload.password) {
                doc.password = payload.password;
                changed = true;
            }
            if (changed) await doc.save();
        }

        byKey[user.key] = doc;
    }

    return byKey;
};

const seedProperties = async (Property, usersByKey) => {
    const byKey = {};

    for (const fixture of propertyFixture) {
        const owner = usersByKey[fixture.ownerKey];
        if (!owner) continue;

        const payload = {
            ...fixture,
            utilisateur: owner._id,
        };

        delete payload.key;
        delete payload.ownerKey;

        let doc = await Property.findOne({ titre: fixture.titre, utilisateur: owner._id });
        if (!doc) {
            doc = await Property.create(payload);
        } else {
            Object.assign(doc, payload);
            await doc.save();
        }

        byKey[fixture.key] = doc;
    }

    return byKey;
};

const recomputeRatingsAndRelations = async ({ Property, User, propertiesByKey, usersByKey }) => {
    const ratingPlan = [
        { propertyKey: 'brazzaville-appartement-plateau', userKey: 'client_1', note: 5 },
        { propertyKey: 'brazzaville-appartement-plateau', userKey: 'client_2', note: 4 },
        { propertyKey: 'pointe-noire-villa-cotiere', userKey: 'client_2', note: 5 },
        { propertyKey: 'makelekele-studio', userKey: 'client_3', note: 4 },
        { propertyKey: 'moungali-maison-jardin', userKey: 'client_1', note: 5 },
    ];

    for (const plan of ratingPlan) {
        const property = propertiesByKey[plan.propertyKey];
        const user = usersByKey[plan.userKey];
        if (!property || !user) continue;

        property.evaluations = property.evaluations || [];
        const existing = property.evaluations.find((e) => String(e.utilisateur) === String(user._id));
        if (existing) {
            existing.note = plan.note;
        } else {
            property.evaluations.push({ utilisateur: user._id, note: plan.note, creeLe: new Date() });
        }

        const notes = property.evaluations.map((e) => Number(e.note) || 0).filter((n) => n > 0);
        property.noteMoyenne = notes.length ? notes.reduce((a, b) => a + b, 0) / notes.length : 0;
        property.nombreAvis = notes.length;

        await property.save();
    }

    const favoritePlan = [
        { userKey: 'client_1', propertyKey: 'brazzaville-appartement-plateau' },
        { userKey: 'client_1', propertyKey: 'moungali-maison-jardin' },
        { userKey: 'client_2', propertyKey: 'pointe-noire-villa-cotiere' },
        { userKey: 'client_3', propertyKey: 'makelekele-studio' },
    ];

    for (const plan of favoritePlan) {
        const user = usersByKey[plan.userKey];
        const property = propertiesByKey[plan.propertyKey];
        if (!user || !property) continue;

        user.favoris = Array.isArray(user.favoris) ? user.favoris : [];
        property.favoris = Array.isArray(property.favoris) ? property.favoris : [];

        if (!user.favoris.some((id) => String(id) === String(property._id))) {
            user.favoris.push(property._id);
        }
        if (!property.favoris.some((id) => String(id) === String(user._id))) {
            property.favoris.push(user._id);
        }

        user.visited = Array.isArray(user.visited) ? user.visited : [];
        const existingVisit = user.visited.find((v) => String(v.property) === String(property._id));
        if (existingVisit) {
            existingVisit.count = Math.max(1, Number(existingVisit.count || 1)) + 1;
            existingVisit.lastVisitedAt = new Date();
        } else {
            user.visited.push({ property: property._id, count: 1, lastVisitedAt: new Date() });
        }

        await user.save();
        await property.save();
    }
};

const seedReservations = async ({ Reservation, propertiesByKey, usersByKey }) => {
    const byKey = {};

    for (const fixture of reservationFixture) {
        const property = propertiesByKey[fixture.propertyKey];
        const user = usersByKey[fixture.userKey];
        if (!property || !user) continue;

        const phone = normalizePhoneE164(user.telephone || '') || '+242060000000';

        let reservation = await Reservation.findOne({
            property: property._id,
            user: user._id,
            date: fixture.date,
        });

        if (!reservation) {
            reservation = await Reservation.create({
                property: property._id,
                user: user._id,
                date: fixture.date,
                telephone: phone,
                isWhatsapp: Boolean(fixture.isWhatsapp),
                status: fixture.status,
            });
        }

        reservation.status = fixture.status;
        reservation.telephone = phone;
        reservation.isWhatsapp = Boolean(fixture.isWhatsapp);
        reservation.reference = reservation.reference || buildReservationReference({ createdAt: reservation.createdAt, objectId: reservation._id });

        reservation.support = buildSupportPayload({
            reference: reservation.reference,
            propertyTitle: property.titre,
            visitDate: reservation.date,
            requesterPhone: phone,
            requesterEmail: user.email,
        });

        if (fixture.status === 'confirmee') {
            reservation.support.confirmedAt = new Date();
        }

        reservation.statusHistory = [
            buildStatusHistoryEntry({ status: 'en_attente', actorId: user._id, note: 'Reservation creee via seed dataset', source: 'seed' }),
            ...(fixture.status !== 'en_attente'
                ? [buildStatusHistoryEntry({ status: fixture.status, actorId: usersByKey.admin?._id || null, note: `Statut ${fixture.status} applique via seed`, source: 'seed' })]
                : []),
        ];

        await reservation.save();
        byKey[fixture.key] = reservation;
    }

    return byKey;
};

const seedMessages = async ({ Message, usersByKey }) => {
    for (const fixture of messageFixture) {
        const from = usersByKey[fixture.fromKey];
        const to = usersByKey[fixture.toKey];
        if (!from || !to) continue;

        const existing = await Message.findOne({
            expediteur: from._id,
            destinataire: to._id,
            sujet: fixture.sujet,
            contenu: fixture.contenu,
        });

        if (!existing) {
            await Message.create({
                expediteur: from._id,
                destinataire: to._id,
                sujet: fixture.sujet,
                contenu: fixture.contenu,
                type: 'reservation',
            });
        }
    }
};

const run = async () => {
    console.log('[seed:scim:fixtures] start');
    await connectCluster();

    const User = getModel(APP_NAME, 'User');
    const Property = getModel(APP_NAME, 'Property', PropertySchema);
    const Reservation = getModel(APP_NAME, 'Reservation', ReservationSchema);
    const Message = getModel(APP_NAME, 'Message', MessageSchema);

    const usersByKey = await seedUsers(User);
    const propertiesByKey = await seedProperties(Property, usersByKey);
    await recomputeRatingsAndRelations({ Property, User, propertiesByKey, usersByKey });
    const reservationsByKey = await seedReservations({ Reservation, propertiesByKey, usersByKey });
    await seedMessages({ Message, usersByKey });

    console.log('[seed:scim:fixtures] done');
    console.log(`[seed:scim:fixtures] users=${Object.keys(usersByKey).length}`);
    console.log(`[seed:scim:fixtures] properties=${Object.keys(propertiesByKey).length}`);
    console.log(`[seed:scim:fixtures] reservations=${Object.keys(reservationsByKey).length}`);
    console.log('[seed:scim:fixtures] admin login:');
    console.log(`  email: ${process.env.SEED_ADMIN_EMAIL || 'admin@admin.com'}`);
    console.log(`  password: ${process.env.SEED_ADMIN_PASSWORD || 'Admin@2026'}`);
};

run()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('[seed:scim:fixtures] error:', error?.message || error);
        process.exit(1);
    });
