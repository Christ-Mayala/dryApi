const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const mongoose = require('mongoose');

// Importer le schéma User
const UserSchema = require('../../modules/user/user.schema');

// Enregistrer le modèle User s'il ne l'est pas déjà
const User = mongoose.models.User || mongoose.model('User', UserSchema);

const initialize = (app) => {
    app.use(passport.initialize());
    app.use(passport.session());

    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    passport.deserializeUser((id, done) => {
        User.findById(id, (err, user) => {
            done(err, user);
        });
    });

    // Stratégie Google
    passport.use(new GoogleStrategy({
            clientID: process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID',
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'YOUR_GOOGLE_CLIENT_SECRET',
            callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback'
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                let user = await User.findOne({ googleId: profile.id });

                if (user) {
                    return done(null, user);
                }

                user = await User.findOne({ email: profile.emails[0].value });

                if (user) {
                    user.googleId = profile.id;
                    await user.save();
                    return done(null, user);
                }

                const newUser = new User({
                    googleId: profile.id,
                    name: profile.displayName,
                    nom: profile.displayName,
                    email: profile.emails[0].value,
                    avatarUrl: profile.photos?.[0]?.value,
                    emailVerified: true,
                    isEmailVerified: true,
                    password: Math.random().toString(36).slice(-8), // Mot de passe aléatoire
                    role: 'user'
                });

                await newUser.save();
                done(null, newUser);
            } catch (err) {
                done(err, false);
            }
        }
    ));

    // Stratégie Facebook
    passport.use(new FacebookStrategy({
            clientID: process.env.FACEBOOK_APP_ID || 'YOUR_FACEBOOK_APP_ID',
            clientSecret: process.env.FACEBOOK_APP_SECRET || 'YOUR_FACEBOOK_APP_SECRET',
            callbackURL: process.env.FACEBOOK_CALLBACK_URL || '/api/auth/facebook/callback',
            profileFields: ['id', 'displayName', 'emails']
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                let user = await User.findOne({ facebookId: profile.id });

                if (user) {
                    return done(null, user);
                }

                if (profile.emails && profile.emails[0] && profile.emails[0].value) {
                    user = await User.findOne({ email: profile.emails[0].value });

                    if (user) {
                        user.facebookId = profile.id;
                        await user.save();
                        return done(null, user);
                    }
                }

                const newUser = new User({
                    facebookId: profile.id,
                    name: profile.displayName,
                    nom: profile.displayName,
                    email: profile.emails ? profile.emails[0].value : null,
                    avatarUrl: profile.photos?.[0]?.value,
                    emailVerified: true,
                    isEmailVerified: true,
                    password: Math.random().toString(36).slice(-8), // Mot de passe aléatoire
                    role: 'user'
                });

                await newUser.save();
                done(null, newUser);
            } catch (err) {
                done(err, false);
            }
        }
    ));

    console.log('Passport plugin initialized.');
};

module.exports = {
    initialize,
    name: 'passport',
    version: '1.0.0',
    description: 'Passport.js authentication plugin for social logins'
};
