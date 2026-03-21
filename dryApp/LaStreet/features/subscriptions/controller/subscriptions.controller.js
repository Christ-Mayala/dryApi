const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const SubscriptionRequestSchema = require('../model/subscription-request.schema');
const UserSchema = require('../../../../../dry/modules/user/user.schema');
const ProfessionalSchema = require('../../professionals/model/professional.schema');
const LeadSchema = require('../../leads/model/lead.schema');
const emailService = require('../../../../../dry/services/auth/email.service');
const logger = require('../../../../../dry/utils/logging/logger');

// --- PRICING (source de vérité serveur) ---
const PRICING = { starter: 2000, standard: 5000, premium: 10000, 'pay-per-lead': 500 };

// --- REQUEST SUBSCRIPTION ---
exports.requestSubscription = asyncHandler(async (req, res) => {
  const { plan, transactionCode, leadId } = req.body;
  const SubscriptionRequest = req.getModel('SubscriptionRequest', SubscriptionRequestSchema);

  let proofImageUrl = req.body.proofImage;
  let proofPublicId = null;

  if (req.file) {
    proofImageUrl = req.file.path || req.file.secure_url || req.file.url;
    proofPublicId = req.file.filename || req.file.public_id;
  }

  // 1. Validation : au moins une preuve est requise
  if (!proofImageUrl && !transactionCode) {
    return sendResponse(res, null, "Veuillez fournir un code de transaction ou une capture d'écran.", 400);
  }

  // 2. Validation du plan
  const finalPlan = plan || (leadId ? 'pay-per-lead' : null);
  if (!PRICING[finalPlan]) throw new Error("Plan invalide");

  // 3. Montant forcé côté serveur (on ignore le client)
  const serverAmount = PRICING[finalPlan];

  // 4. Anti-doublon : vérifier si le même code de transaction a déjà été utilisé
  if (transactionCode) {
    const codeClean = String(transactionCode).trim();
    if (codeClean.length < 4) throw new Error("Code de transaction trop court (minimum 4 caractères)");
    const duplicateCode = await SubscriptionRequest.findOne({ transactionCode: codeClean });
    if (duplicateCode) throw new Error("Ce code de transaction a déjà été utilisé.");
  }

  // 5. Anti-spam : max 3 demandes pending par utilisateur
  const pendingCount = await SubscriptionRequest.countDocuments({ userId: req.user._id, status: 'pending' });
  if (pendingCount >= 3) {
    return sendResponse(res, null, "Vous avez trop de demandes en attente. Patientez qu'un admin les traite.", 429);
  }

  const request = await SubscriptionRequest.create({
    userId: req.user._id,
    plan: finalPlan,
    leadId: leadId || null,
    amount: serverAmount,
    proofImage: proofImageUrl || null,
    proofPublicId: proofPublicId || null,
    transactionCode: transactionCode ? String(transactionCode).trim() : null,
    status: 'pending'
  });

  // --- NOTIFY ADMINS ---
  try {
    const User = req.getModel('User', UserSchema);
    const admins = await User.find({ role: 'admin', status: 'active' });
    
    if (admins.length > 0) {
      const adminEmails = admins.map(a => a.email).filter(Boolean);
      const dashboardUrl = 'https://la-street.netlify.app/admin'; // TODO: Get from config if possible
      
      const emailPromises = adminEmails.map(email => 
        emailService.sendGenericEmail({
          email,
          subject: `🔔 Nouveau paiement à valider - ${finalPlan.toUpperCase()}`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
              <h2 style="color: #f5c518;">Nouvelle demande de paiement</h2>
              <p>Un utilisateur a soumis une preuve de paiement sur <strong>La STREET</strong>.</p>
              <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr>
                  <td style="padding: 10px; border: 1px solid #eee; font-weight: bold;">Utilisateur:</td>
                  <td style="padding: 10px; border: 1px solid #eee;">${req.user.name} (${req.user.email})</td>
                </tr>
                <tr>
                  <td style="padding: 10px; border: 1px solid #eee; font-weight: bold;">Plan/Objet:</td>
                  <td style="padding: 10px; border: 1px solid #eee;">${finalPlan}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; border: 1px solid #eee; font-weight: bold;">Montant:</td>
                  <td style="padding: 10px; border: 1px solid #eee;">${serverAmount} FCFA</td>
                </tr>
              </table>
              <div style="margin-top: 30px;">
                <a href="${dashboardUrl}" style="background-color: #f5c518; color: #000; padding: 12px 25px; text-decoration: none; font-weight: bold; border-radius: 8px;">Voir sur le Dashboard Admin</a>
              </div>
              <p style="margin-top: 30px; font-size: 12px; color: #888;">Ceci est une notification automatique de La STREET.</p>
            </div>
          `
        })
      );
      
      await Promise.all(emailPromises);
    }
  } catch (err) {
    logger(`Erreur lors de la notification admin: ${err.message}`, 'error');
    // On ne bloque pas la réponse client si l'email échoue
  }

  return sendResponse(res, request, "Votre demande a été envoyée. Un administrateur la validera sous peu.");
});


// --- ADMIN: GET ALL REQUESTS ---
exports.getAllSubscriptionRequests = asyncHandler(async (req, res) => {
  req.getModel('Lead', LeadSchema);
  const SubscriptionRequest = req.getModel('SubscriptionRequest', SubscriptionRequestSchema);
  const requests = await SubscriptionRequest.find()
    .populate('userId', 'name email role')
    .populate('leadId') // Indispensable pour voir quelle mission est débloquée
    .sort({ createdAt: -1 });
    
  return sendResponse(res, requests, "Liste des demandes récupérée");
});

// --- ADMIN: APPROVE/REJECT SUBSCRIPTION ---
exports.handleSubscriptionDecision = asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const { status, adminNote } = req.body; // status: 'approved' | 'rejected'
  const SubscriptionRequest = req.getModel('SubscriptionRequest', SubscriptionRequestSchema);
  const User = req.getModel('User', UserSchema);
  const Professional = req.getModel('Professional', ProfessionalSchema);
  const Lead = req.getModel('Lead', LeadSchema);

  const request = await SubscriptionRequest.findById(requestId);
  if (!request) throw new Error("Demande introuvable");
  if (request.status !== 'pending') throw new Error("Cette demande a déjà été traitée");

  if (status === 'approved') {
    request.status = 'approved';
    
    // CAS 1: Activation Premium
    if (['starter', 'standard', 'premium'].includes(request.plan)) {
      const user = await User.findById(request.userId);
      if (!user) throw new Error("Utilisateur introuvable");

      const now = user.premiumUntil && user.premiumUntil > new Date() ? user.premiumUntil : new Date();
      const until = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // Add 30 days

      user.isPremium = true;
      user.premiumPlan = request.plan;
      user.premiumUntil = until;
      await user.save();

      // 1. Sync with Professional Profile
      await Professional.updateMany(
        { createdBy: user._id },
        { $set: { isPremium: true, premiumUntil: until } }
      );

      // 2. Sync with existing open Missions (Leads)
      await Lead.updateMany(
        { userId: user._id, status: 'open' },
        { $set: { isPremiumCreator: true } }
      );
    } 
    // CAS 2: Déblocage d'un Lead (Pay-Per-Lead)
    else if (request.plan === 'pay-per-lead' && request.leadId) {
      const lead = await Lead.findById(request.leadId);
      if (lead) {
        if (!lead.unlockedBy) lead.unlockedBy = [];
        if (!lead.unlockedBy.includes(request.userId)) {
          lead.unlockedBy.push(request.userId);
          await lead.save();
        }
      }
    }
  } else if (status === 'rejected') {
    request.status = 'rejected';
  } else {
    throw new Error("Statut invalide (attendu: approved ou rejected)");
  }

  request.adminNote = adminNote;
  await request.save();

  return sendResponse(res, request, status === 'approved' ? "Demande approuvée et action effectuée" : "Demande rejetée");
});
