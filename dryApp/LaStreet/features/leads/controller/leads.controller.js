const mongoose = require('mongoose');
const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { getPagination } = require('../../../../../dry/utils/data/pagination');
const LeadSchema = require('../model/lead.schema');
const TradeSchema = require('../../categories/model/trade.schema');
const ProfessionalSchema = require('../../professionals/model/professional.schema');
const UserSchema = require('../../../../../dry/modules/user/user.schema');
const emailService = require('../../../../../dry/services/auth/email.service');
const LeadResponseSchema = require('../model/lead-response.schema.js');

exports.createLead = asyncHandler(async (req, res) => {
  const { serviceType, description, location, urgency, estimatedPrice } = req.body;
  const Lead = req.getModel('Lead', LeadSchema);
  const Trade = req.getModel('Trade', TradeSchema);
  const Professional = req.getModel('Professional', ProfessionalSchema);
  const User = req.getModel('User', UserSchema);

  const serviceTypeTrimmed = (serviceType || '').trim();
  const tradeExists = await Trade.findOne({
    name: { $regex: new RegExp(`^${serviceTypeTrimmed}$`, 'i') },
  });

  if (!tradeExists) {
    console.error(`[Notification] Service non trouvé dans la base: "${serviceTypeTrimmed}"`);
    throw new Error(`Le type de service "${serviceTypeTrimmed}" n'est pas reconnu.`);
  }

  let createdByRole = 'client';
  if (['prestataire', 'professional'].includes(req.user.role)) {
    createdByRole = 'professional';
  } else if (req.user.role === 'admin') {
    createdByRole = 'professional';
  }

  // --- LIMITATION GRATUITE (1 LEAD PAR MOIS) ---
  if (!req.user.isPremium && req.user.role !== 'admin') {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const leadCount = await Lead.countDocuments({
      userId: req.user._id,
      createdAt: { $gte: startOfMonth }
    });

    if (leadCount >= 1) {
      return sendResponse(res, null, 'Limite gratuite atteinte (1 lead par mois). Passez au Premium pour publier sans limites.', false);
    }
  }

  const lead = await Lead.create({
    serviceType,
    description,
    location,
    urgency: urgency || 'flexible',
    estimatedPrice,
    userId: req.user._id,
    createdByRole,
    isPremiumCreator: req.user.isPremium === true,
  });

  // --- NOTIFICATION DES PROFESSIONNELS PAR EMAIL ---
  try {
    console.log(`[Notification] Début recherche pros pour tradeId: ${tradeExists._id} (${tradeExists.name})`);
    
    // 1. Trouver les pros qui ont ce métier (tradeId ou tradeIds)
    const pros = await Professional.find({
      $or: [
        { tradeId: tradeExists._id },
        { tradeIds: tradeExists._id }
      ],
      approvalStatus: 'approved'
    }).select('createdBy name');

    console.log(`[Notification] Pros approuvés trouvés pour ce métier: ${pros.length}`);

    if (pros.length > 0) {
      const userIds = [...new Set(pros.map(p => p.createdBy).filter(Boolean).map(id => id.toString()))];
      console.log(`[Notification] IDs utilisateurs uniques à notifier: ${userIds.join(', ')}`);
      
      const users = await User.find({ _id: { $in: userIds.map(id => new mongoose.Types.ObjectId(id)) } }).select('email name');
      console.log(`[Notification] Utilisateurs trouvés en base: ${users.length}`);

      const prosCount = users.length;

      for (const user of users) {
        if (user.email) {
          console.log(`[Notification] Préparation email pour ${user.email}`);
          const html = emailService.generateLeadNotificationTemplate(lead, user.name, req.appName, prosCount);
          emailService.sendGenericEmail({
            email: user.email,
            subject: `Nouveau client dans votre zone : ${lead.serviceType} à ${lead.location || 'votre ville'}`,
            html
          })
          .then(() => console.log(`[Notification] Email envoyé avec succès à ${user.email}`))
          .catch(e => console.error(`[Notification] Erreur lors de l'envoi à ${user.email}:`, e.message));
        } else {
          console.warn(`[Notification] L'utilisateur ${user.name} (${user._id}) n'a pas d'adresse email.`);
        }
      }
    } else {
      // Debug: Chercher même les non approuvés
      const allProsForTrade = await Professional.find({
        $or: [
          { tradeId: tradeExists._id },
          { tradeIds: tradeExists._id }
        ]
      });
      console.log(`[Notification] Aucun pro approuvé. Total pros pour ce métier (tous statuts): ${allProsForTrade.length}`);
      if (allProsForTrade.length > 0) {
        console.log(`[Notification] Statuts des pros non notifiés: ${allProsForTrade.map(p => p.approvalStatus).join(', ')}`);
      }
    }
  } catch (err) {
    console.error('[Notification] Erreur critique:', err);
  }

  // --- MATCHING AUTOMATIQUE (PHASE 3) ---
  const recommendedPros = await Professional.find({
    $or: [
      { tradeId: tradeExists._id },
      { tradeIds: tradeExists._id }
    ],
    approvalStatus: 'approved'
  })
  .sort({ isPremium: -1, rating: -1 })
  .limit(3)
  .select('name ville profileImage.url rating isPremium');

  const leadData = lead.toObject();
  leadData.recommendedPros = recommendedPros;

  return sendResponse(res, leadData, 'Demande de service creee avec succes');
});

exports.getLeads = asyncHandler(async (req, res) => {
  const Lead = req.getModel('Lead', LeadSchema);
  const { page, limit, skip } = getPagination(req.query, {
    defaultLimit: 20,
    maxLimit: 50,
  });

  const isPremium = req.user.isPremium === true;
  const openQuery = { status: 'open' };

  if (req.query.serviceType) {
    openQuery.serviceType = { $regex: String(req.query.serviceType), $options: 'i' };
  }

  const [items, total] = await Promise.all([
    Lead.find(openQuery)
      .populate('userId', 'name isPremium avatarUrl')
      .sort({ isPremiumCreator: -1, createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean(),
    Lead.countDocuments(openQuery),
  ]);

  const processedItems = items.map((lead) => {
    if (lead.userId && lead.userId.toString() === req.user._id.toString()) {
      return { ...lead, isOwner: true };
    }

    const hasUnlocked =
      lead.unlockedBy && lead.unlockedBy.some((id) => id.toString() === req.user._id.toString());

    if (isPremium || req.user.role === 'admin' || hasUnlocked) {
      return lead;
    }

    return {
      _id: lead._id,
      serviceType: lead.serviceType,
      estimatedPrice: lead.estimatedPrice,
      createdByRole: lead.createdByRole,
      description: `${(lead.description || '').substring(0, 50)}...`,
      location: lead.location ? `${lead.location.split(',')[0].trim()}, XXX` : 'XXX',
      status: lead.status,
      createdAt: lead.createdAt,
      isLocked: true,
    };
  });

  return sendResponse(
    res,
    {
      items: processedItems,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
      isPremium,
    },
    "Flux d'opportunites recupere"
  );
});

exports.getLeadById = asyncHandler(async (req, res) => {
  const { leadId } = req.params;
  const Lead = req.getModel('Lead', LeadSchema);
  const LeadResponse = req.getModel('LeadResponse', LeadResponseSchema);

  const lead = await Lead.findById(leadId)
    .populate('userId', 'name email telephone isPremium avatarUrl')
    .lean();
  if (!lead) throw new Error('Mission introuvable');

  if (lead.userId._id.toString() === req.user._id.toString() || req.user.role === 'admin') {
    const responses = await LeadResponse.find({ leadId })
      .populate('professionalId', 'name email telephone avatarUrl isPremium')
      .sort({ createdAt: 1 })
      .lean();
    return sendResponse(res, { ...lead, responses, isOwner: true }, 'Details de la mission');
  }

  const isPremium = req.user.isPremium === true;
  const hasUnlocked =
    lead.unlockedBy && lead.unlockedBy.some((id) => id.toString() === req.user._id.toString());

  if (isPremium || hasUnlocked) {
    return sendResponse(res, { ...lead, isUnlocked: hasUnlocked }, 'Details de la mission');
  }

  return sendResponse(
    res,
    {
      _id: lead._id,
      serviceType: lead.serviceType,
      createdByRole: lead.createdByRole,
      estimatedPrice: lead.estimatedPrice,
      description: `${(lead.description || '').substring(0, 80)}...`,
      location: lead.location ? `${lead.location.split(',')[0].trim()}, XXX` : 'XXX',
      status: lead.status,
      createdAt: lead.createdAt,
      isLocked: true,
    },
    'Apercu de la mission'
  );
});

exports.respondToLead = asyncHandler(async (req, res) => {
  const { leadId, message } = req.body;
  const Lead = req.getModel('Lead', LeadSchema);
  const LeadResponse = req.getModel('LeadResponse', LeadResponseSchema);

  const lead = await Lead.findById(leadId);
  if (!lead) throw new Error('Mission introuvable');
  if (lead.status !== 'open') throw new Error("Cette mission n'est plus disponible");

  if (lead.userId.toString() === req.user._id.toString()) {
    return sendResponse(res, null, "Vous ne pouvez pas repondre a votre propre mission", false);
  }

  const hasUnlocked =
    lead.unlockedBy && lead.unlockedBy.some((id) => id.toString() === req.user._id.toString());
  if (!req.user.isPremium && !hasUnlocked && req.user.role !== 'admin') {
    return sendResponse(
      res,
      null,
      'Abonnement Premium ou deblocage (500 FCFA) requis pour postuler',
      false
    );
  }

  const response = await LeadResponse.create({
    leadId,
    professionalId: req.user._id,
    message,
  });

  return sendResponse(res, response, 'Proposition envoyee au client');
});

exports.assignLead = asyncHandler(async (req, res) => {
  const { leadId, professionalId } = req.body;
  const Lead = req.getModel('Lead', LeadSchema);
  const LeadResponse = req.getModel('LeadResponse', LeadResponseSchema);

  const lead = await Lead.findById(leadId);
  if (!lead) throw new Error('Mission introuvable');

  if (lead.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return sendResponse(
      res,
      null,
      'Seul le proprietaire de la mission peut assigner un prestataire',
      false
    );
  }

  const response = await LeadResponse.findOne({ leadId, professionalId });
  if (!response && req.user.role !== 'admin') {
    return sendResponse(
      res,
      null,
      "Ce prestataire n'a pas encore repondu a la mission",
      false
    );
  }

  lead.assignedTo = professionalId;
  lead.status = 'assigned';
  await lead.save();

  if (response) {
    response.status = 'accepted';
    await response.save();
  }

  return sendResponse(res, lead, 'Prestataire assigne avec succes');
});

exports.requestLeadUnlock = asyncHandler(async (req, res) => {
  const { leadId, transactionCode } = req.body;
  const Lead = req.getModel('Lead', LeadSchema);
  const SubscriptionRequest = req.getModel(
    'SubscriptionRequest',
    require('../../subscriptions/model/subscription-request.schema')
  );

  const SERVER_UNLOCK_PRICE = 500;
  let proofImageUrl = req.body.proofImage;
  let proofPublicId = null;

  if (req.file) {
    proofImageUrl = req.file.path || req.file.secure_url || req.file.url;
    proofPublicId = req.file.filename || req.file.public_id;
  }

  if (!proofImageUrl && !transactionCode) {
    return sendResponse(
      res,
      null,
      "Veuillez fournir un code de transaction ou une capture d'ecran.",
      false
    );
  }

  if (transactionCode) {
    const codeClean = String(transactionCode).trim();
    if (codeClean.length < 4) {
      throw new Error('Code de transaction trop court (minimum 4 caracteres)');
    }
    const duplicateCode = await SubscriptionRequest.findOne({ transactionCode: codeClean });
    if (duplicateCode) {
      throw new Error("Ce code de transaction a deja ete utilise.");
    }
  }

  if (
    req.user.subtype !== 'prestataire' &&
    req.user.role !== 'admin' &&
    req.user.role !== 'professional'
  ) {
    return sendResponse(res, null, 'Seuls les prestataires peuvent debloquer des missions', false);
  }

  const lead = await Lead.findById(leadId);
  if (!lead) throw new Error('Mission introuvable');
  if (lead.status !== 'open') throw new Error("Cette mission n'est plus ouverte");

  if (lead.unlockedBy && lead.unlockedBy.some((id) => id.toString() === req.user._id.toString())) {
    throw new Error('Vous avez deja acces a cette mission.');
  }

  const existing = await SubscriptionRequest.findOne({
    userId: req.user._id,
    leadId,
    plan: 'pay-per-lead',
    status: 'pending',
  });

  if (existing) {
    throw new Error('Vous avez deja une demande de deblocage en cours pour cette mission.');
  }

  const unlockReq = await SubscriptionRequest.create({
    userId: req.user._id,
    plan: 'pay-per-lead',
    leadId,
    amount: SERVER_UNLOCK_PRICE,
    proofImage: proofImageUrl || null,
    proofPublicId: proofPublicId || null,
    transactionCode: transactionCode ? String(transactionCode).trim() : null,
    status: 'pending',
  });

  return sendResponse(
    res,
    unlockReq,
    "Votre demande de deblocage a ete envoyee et est en attente de verification."
  );
});

exports.deleteLead = asyncHandler(async (req, res) => {
  const { leadId } = req.params;
  const Lead = req.getModel('Lead', LeadSchema);

  const lead = await Lead.findById(leadId);
  if (!lead) throw new Error('Mission introuvable');

  // Seul l'admin peut supprimer une mission
  if (req.user.role !== 'admin') {
    return sendResponse(res, null, 'Seul un administrateur peut supprimer une mission.', false);
  }

  await lead.deleteOne();

  return sendResponse(res, null, 'Mission supprimee avec succes');
});
