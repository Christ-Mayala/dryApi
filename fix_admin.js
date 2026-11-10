const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://cerver-gold-dry:CmhhHeUa8DJB8x1n@dryglobal.nygs81u.mongodb.net')
  .then(() => {
    const userSchema = new mongoose.Schema({
      email: String,
      role: String,
      novaRole: String
    }, { strict: false });
    const User = mongoose.model('User', userSchema);
    
    return User.findOne({ email: 'mayalachristgottlieb@gmail.com' });
  })
  .then(user => {
    console.log('Utilisateur trouvé :', user ? user.email : 'NON TROUVÉ');
    if (!user) {
      console.log('Création nouvel utilisateur admin...');
      return User.create({
        email: 'mayalachristgottlieb@gmail.com',
        role: 'admin',
        novaRole: 'admin'
      });
    }
    console.log('role avant :', user.role, 'novaRole avant :', user.novaRole);
    return User.updateOne(
      { email: 'mayalachristgottlieb@gmail.com' },
      { role: 'admin', novaRole: 'admin' }
    );
  })
  .then(() => User.findOne({ email: 'mayalachristgottlieb@gmail.com' }))
  .then(user => {
    console.log('--- Résultat final ---');
    console.log('email :', user.email);
    console.log('role :', user.role);
    console.log('novaRole :', user.novaRole);
    mongoose.disconnect();
    console.log('✅ Terminé');
  })
  .catch(err => {
    console.error('Erreur :', err);
    mongoose.disconnect();
  });