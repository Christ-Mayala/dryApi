const mongoose = require('mongoose');

// Connect directly to online MongoDB
mongoose.connect('mongodb+srv://cerver-gold-dry:CmhhHeUa8DJB8x1n@dryglobal.nygs81u.mongodb.net')
  .then(() => {
    console.log('Connecté à la base en ligne');
    
    // Simple schema for User
    const userSchema = new mongoose.Schema({
      email: { type: String, required: true, unique: true },
      role: { type: String, default: 'user' },
      novaRole: { type: String, default: null }
    }, { collection: 'users', timestamps: false });
    
    const User = mongoose.model('User', userSchema);
    
    return User.findOneAndUpdate(
      { email: 'mayalachristgottlieb@gmail.com' },
      { 
        $set: { 
          role: 'admin', 
          novaRole: 'admin' 
        } 
      },
      { new: true, upsert: true }
    );
  })
  .then(result => {
    console.log('--- Résultat ---');
    console.log('email :', result.email);
    console.log('role :', result.role);
    console.log('novaRole :', result.novaRole);
    mongoose.disconnect();
    console.log('✅ Terminé avec succès');
  })
  .catch(err => {
    console.error('Erreur :', err);
    mongoose.disconnect();
  });