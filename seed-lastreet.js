require('dotenv').config();
const mongoose = require('mongoose');
const config = require('./config/database');
const { connectCluster, getTenantDB } = require('./dry/config/connection/dbConnection');

// Modèles
const TradeCategorySchema = require('./dryApp/LaStreet/features/categories/model/tradeCategory.schema');
const TradeSchema = require('./dryApp/LaStreet/features/categories/model/trade.schema');

const tradesData = [
  {
    category: 'Bâtiment & Travaux',
    items: ['Plombier', 'Électricien', 'Maçon', 'Peintre', 'Menuisier', 'Carreleur', 'Frigoriste', 'Étanchéité']
  },
  {
    category: 'Services Ménagers',
    items: ['Ménage', 'Lessive', 'Cuisine à domicile', 'Garde d\'enfants', 'Jardinier']
  },
  {
    category: 'Mécanique & Transport',
    items: ['Mécanicien Auto', 'Électricien Auto', 'Tôlier', 'Chauffeur', 'Livreur']
  },
  {
    category: 'Beauté & Bien-être',
    items: ['Coiffeur', 'Maquilleuse', 'Manucure/Pédicure', 'Massage', 'Coach Sportif']
  },
  {
    category: 'Technologie & Digital',
    items: ['Réparateur Smartphone', 'Informaticien', 'Graphiste', 'Développeur Web', 'Photographe']
  }
];

const seed = async () => {
  try {
    console.log('🚀 Connexion au cluster...');
    await connectCluster();
    
    const db = getTenantDB('LaStreet');
    console.log('📂 Base de données LaStreetDB sélectionnée.');

    const TradeCategory = db.model('TradeCategory', TradeCategorySchema);
    const Trade = db.model('Trade', TradeSchema);

    // Nettoyage optionnel (décommenter si besoin de reset complet)
    // await Trade.deleteMany({});
    // await TradeCategory.deleteMany({});
    // console.log('🗑️  Anciennes données supprimées.');

    for (let i = 0; i < tradesData.length; i++) {
      const catData = tradesData[i];
      
      let category = await TradeCategory.findOne({ name: catData.category });
      if (!category) {
        category = await TradeCategory.create({ name: catData.category, order: i });
        console.log(`✅ Catégorie créée : ${catData.category}`);
      }

      for (let j = 0; j < catData.items.length; j++) {
        const tradeName = catData.items[j];
        const existingTrade = await Trade.findOne({ name: tradeName, category: category._id });
        
        if (!existingTrade) {
          await Trade.create({
            name: tradeName,
            category: category._id,
            order: j
          });
          console.log(`   + Métier ajouté : ${tradeName}`);
        }
      }
    }

    console.log('\n✨ Seeding terminé avec succès !');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors du seeding :', error);
    process.exit(1);
  }
};

seed();
