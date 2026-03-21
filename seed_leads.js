require('dotenv').config();
const mongoose = require('mongoose');

// Use hardcoded path or environment variable for MongoDB URI
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/LaStreetDB';

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connecté à la base de données:', MONGO_URI);

    // Schemas
    const UserSchema = require('./dry/modules/user/user.schema');
    const LeadSchema = require('./dryApp/LaStreet/features/leads/model/lead.schema');
    const LeadResponseSchema = require('./dryApp/LaStreet/features/leads/model/lead-response.schema');
    const TradeSchema = require('./dryApp/LaStreet/features/categories/model/trade.schema');

    // Factory
    const getModel = require('./dry/core/factories/modelFactory');

    const User = getModel('LaStreet', 'User', UserSchema);
    const Lead = getModel('LaStreet', 'Lead', LeadSchema);
    const LeadResponse = getModel('LaStreet', 'LeadResponse', LeadResponseSchema);
    const Trade = getModel('LaStreet', 'Trade', TradeSchema);

    // Create a Trade to bypass validation
    let trade = await Trade.findOne({ name: 'Plombier' });
    if (!trade) {
      trade = await Trade.create({ name: 'Plombier', category: new mongoose.Types.ObjectId() });
    }

    // 1. Create a Client
    let client = await User.findOne({ email: 'client.test@yopmail.com' });
    if (!client) {
      client = await User.create({
        name: 'Client Test',
        email: 'client.test@yopmail.com',
        password: 'Password123!',
        role: 'user',
        telephone: '061234567'
      });
    }

    // 2. Create a Premium Pro
    let proPremium = await User.findOne({ email: 'pro.premium@yopmail.com' });
    if (!proPremium) {
      proPremium = await User.create({
        name: 'Pro Premium',
        email: 'pro.premium@yopmail.com',
        password: 'Password123!',
        role: 'professional',
        telephone: '059876543',
        isPremium: true,
        premiumPlan: 'premium',
        premiumUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });
    }

    // 3. Create a Non-Premium Pro (who will unlock a lead)
    let proStandard = await User.findOne({ email: 'pro.standard@yopmail.com' });
    if (!proStandard) {
      proStandard = await User.create({
        name: 'Pro Standard',
        email: 'pro.standard@yopmail.com',
        password: 'Password123!',
        role: 'professional',
        telephone: '041112233',
        isPremium: false
      });
    }

    // Clean old leads for these users to avoid duplicates in test
    await Lead.deleteMany({ userId: client._id });
    await LeadResponse.deleteMany({ professionalId: { $in: [proPremium._id, proStandard._id] } });

    // 4. Create an OPEN lead with an estimated price
    const lead1 = await Lead.create({
      userId: client._id,
      serviceType: 'Plombier',
      description: 'Fuite d\'eau grave dans la salle de bain. Besoin d\'une intervention rapide.',
      location: 'Brazzaville, Moungali',
      estimatedPrice: 25000,
      createdByRole: 'client',
      status: 'open'
    });

    // 5. Create an ASSIGNED lead (Assigned to proPremium)
    const lead2 = await Lead.create({
      userId: client._id,
      serviceType: 'Plombier',
      description: 'Installation d\'un nouveau chauffe-eau.',
      location: 'Pointe-Noire, Lumumba',
      estimatedPrice: 150000,
      createdByRole: 'client',
      status: 'assigned',
      assignedTo: proPremium._id
    });

    // ProPremium responds to it (simulate past action)
    await LeadResponse.create({
      leadId: lead2._id,
      professionalId: proPremium._id,
      message: 'Je suis disponible demain matin pour l\'installation. J\'ai tout le matériel.',
      status: 'accepted'
    });

    // 6. Create a lead UNLOCKED by the Non-Premium Pro (Pay-Per-Lead 500 CFA simulated)
    const lead3 = await Lead.create({
      userId: client._id,
      serviceType: 'Plombier',
      description: 'Débouchage des canalisations de la cuisine.',
      location: 'Brazzaville, Poto-Poto',
      estimatedPrice: 15000,
      createdByRole: 'client',
      status: 'open',
      unlockedBy: [proStandard._id] // This bypasses the Teaser lock!
    });

    console.log('=============================================');
    console.log('✅ BASE DE DONNÉES PEUPLÉE AVEC SUCCÈS !');
    console.log('=============================================');
    console.log('COMPTES DE TEST (Mot de passe: Password123!) :');
    console.log('1. Client (Celui qui a créé les missions) : client.test@yopmail.com');
    console.log('2. Pro Premium (A accès à tout) : pro.premium@yopmail.com');
    console.log('3. Pro Standard (Non premium, mais a débloqué la mission 3) : pro.standard@yopmail.com');
    console.log('=============================================');
    console.log('MISSIONS CRÉÉES :');
    console.log('- Mission 1 (Ouverte) : 25 000 FCFA');
    console.log(`- Mission 2 (Assignée au Pro Premium) : 150 000 FCFA -> (ID: ${lead2._id})`);
    console.log(`- Mission 3 (Débloquée par Pro Standard) : 15 000 FCFA -> (ID: ${lead3._id})`);
    
    process.exit(0);
  } catch (error) {
    console.error('Erreur lors du peuplement :', error);
    process.exit(1);
  }
}

seed();
