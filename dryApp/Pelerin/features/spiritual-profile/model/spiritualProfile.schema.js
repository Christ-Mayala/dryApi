const mongoose = require('mongoose');

/**
 * Profil spirituel d'un utilisateur (identité spirituelle statique).
 * Un document par utilisateur — upsert sur GET/PUT /me.
 * Complémentaire de UserJourney (progression gamifiée) :
 *   SpiritualProfile = qui je suis (verset favori, objectif, prières)
 *   UserJourney      = où j'en suis (points, streak, milestones)
 */
const SpiritualProfileSchema = new mongoose.Schema(
  {
    createdBy: { type: String, required: true, trim: true },
    favoriteVerseBook: { type: String, trim: true, maxlength: 10 },
    favoriteVerseChapter: { type: Number, min: 1 },
    favoriteVerseVerse: { type: Number, min: 1 },
    favoriteVerseText: { type: String, trim: true, maxlength: 500 },
    spiritualGoal: { type: String, trim: true, maxlength: 500 },
    prayerTopics: { type: [String], default: [] },
    label: { type: String, trim: true },
  },
  { timestamps: true },
);

// PAS d'index explicite sur createdBy : le plugin DRY global ajoute deja
// createdBy avec index:true — un deuxieme schema.index({createdBy:1}) ici
// declenche le warning mongoose "Duplicate schema index". L'unicite (un
// document par utilisateur) est garantie par le findOneAndUpdate(upsert) des
// controllers.

module.exports = SpiritualProfileSchema;
