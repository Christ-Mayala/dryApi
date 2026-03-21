const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { getPagination } = require('../../../../../dry/utils/data/pagination');
const LeadSchema = require('../model/lead.schema');
const TradeSchema = require('../../categories/model/trade.schema');
const LeadResponseSchema = require('../model/lead-response.schema.js');

// --- CREATE LEAD ---
exports.createLead = asyncHandler(async (req, res) => {
  const { serviceType, description, location, estimatedPrice } = req.body;
  const Lead = req.getModel('Lead', LeadSchema);
  const Trade = req.getModel('Trade', TradeSchema);

  // 1. Validation du serviceType (Strict Trade lookup)
  const tradeExists = await Trade.findOne({ name: { $regex: new RegExp(`^${serviceType}$`, 'i') } });
  if (!tradeExists) {
    throw new Error(`Le type de service "${serviceType}" n'est pas reconnu.`);
  }

  // 2. Détermination du rôle du créateur
  let createdByRole = 'client';
  if (['prestataire', 'professional'].includes(req.user.role)) {
    createdByRole = 'professional';
  } else if (req.user.role === 'admin') {
    createdByRole = 'professional'; // Admin can act as pro
  }

  const lead = await Lead.create({
    serviceType,
    description,
    location,
    userId: req.user._id,
    createdByRole,
    isPremiumCreator: req.user.isPremium === true,
  });

  return sendResponse(res, lead, 'Demande de service (Lead) créée avec succès');
});

// --- GET LEADS (Provider Feed) ---
exports.getLeads = asyncHandler(async (req, res) => {
  const Lead = req.getModel('Lead', LeadSchema);
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 20, maxLimit: 50 });

  const isPremium = req.user.isPremium === true;

  // Tout utilisateur connecté voit le flux des leads 'open'
  // Un utilisateur voit aussi ses propres leads (peu importe le statut)
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

  const processedItems = items.map(lead => {
    // Le créateur voit son propre lead complètement
    if (lead.userId && lead.userId.toString() === req.user._id.toString()) {
      return { ...lead, isOwner: true };
    }

    const hasUnlocked = lead.unlockedBy && lead.unlockedBy.some(id => id.toString() === req.user._id.toString());

    // Premium ou lead débloqué → accès complet
    if (isPremium || req.user.role === 'admin' || hasUnlocked) return lead;

    // Non-premium : teaser (encourage à souscrire)
    return {
      _id: lead._id,
      serviceType: lead.serviceType,
      estimatedPrice: lead.estimatedPrice,
      createdByRole: lead.createdByRole,
      description: (lead.description || '').substring(0, 50) + '...',
      location: lead.location ? lead.location.split(',')[0].trim() + ', ■■■' : '■■■',
      status: lead.status,
      createdAt: lead.createdAt,
      isLocked: true
    };
  });

  return sendResponse(
    res,
    { items: processedItems, totalPages: Math.ceil(total / limit), currentPage: page, total, isPremium },
    'Flux d\'opportunités récupéré'
  );
});

// --- GET SINGLE LEAD ---
exports.getLeadById = asyncHandler(async (req, res) => {
  const { leadId } = req.params;
  const Lead = req.getModel('Lead', LeadSchema);
  const LeadResponse = req.getModel('LeadResponse', LeadResponseSchema);

  const lead = await Lead.findById(leadId).populate('userId', 'name email telephone isPremium avatarUrl').lean();
  if (!lead) throw new Error("Mission introuvable");

  // Le propriétaire du lead voit tout + les répondants avec leurs coordonnées
  if (lead.userId._id.toString() === req.user._id.toString() || req.user.role === 'admin') {
    const responses = await LeadResponse.find({ leadId })
      .populate('professionalId', 'name email telephone')
      .lean();
    return sendResponse(res, { ...lead, responses, isOwner: true }, "Détails de la mission");
  }

  // Tout utilisateur authentifié peut voir le détail
  // S'il est premium ou a débloqué ce lead → accès complet (coordonnées visibles)
  const isPremium = req.user.isPremium === true;
  const hasUnlocked = lead.unlockedBy && lead.unlockedBy.some(id => id.toString() === req.user._id.toString());

  if (isPremium || hasUnlocked) {
    return sendResponse(res, { ...lead, isUnlocked: hasUnlocked }, "Détails de la mission");
  }

  // Non premium : aperçu avec invitation à payer
  return sendResponse(res, {
    _id: lead._id,
    serviceType: lead.serviceType,
    createdByRole: lead.createdByRole,
    estimatedPrice: lead.estimatedPrice,
    description: (lead.description || '').substring(0, 80) + '...',
    location: lead.location ? lead.location.split(',')[0].trim() + ', ■■■' : '■■■',
    status: lead.status,
    createdAt: lead.createdAt,
    isLocked: true
  }, "Aperçu de la mission");
});

// --- RESPOND TO LEAD ---
exports.respondToLead = asyncHandler(async (req, res) => {
  const { leadId, message } = req.body;
  const Lead = req.getModel('Lead', LeadSchema);
  const LeadResponse = req.getModel('LeadResponse', LeadResponseSchema);

  const lead = await Lead.findById(leadId);
  if (!lead) throw new Error("Mission introuvable");
  if (lead.status !== 'open') throw new Error("Cette mission n'est plus disponible");

  // Ne pas répondre à sa propre mission
  if (lead.userId.toString() === req.user._id.toString()) {
    return sendResponse(res, null, "Vous ne pouvez pas répondre à votre propre mission", 400);
  }

  // Un utilisateur doit être premium OU avoir débloqué ce lead pour postuler
  const hasUnlocked = lead.unlockedBy && lead.unlockedBy.some(id => id.toString() === req.user._id.toString());
  if (!req.user.isPremium && !hasUnlocked && req.user.role !== 'admin') {
    return sendResponse(res, null, "Abonnement Premium ou déblocage (500 FCFA) requis pour postuler", 403);
  }

  const response = await LeadResponse.create({ leadId, professionalId: req.user._id, message });
  return sendResponse(res, response, "Proposition envoyée au client");
});

// --- ASSIGN LEAD --- (Feature réservée à la version mobile)
exports.assignLead = asyncHandler(async (req, res) => {
  return sendResponse(res, null, "La sélection d'un prestataire est gérée depuis l'application mobile", 501);
});

// --- REQUEST LEAD UNLOCK (500 FCFA) ---
exports.requestLeadUnlock = asyncHandler(async (req, res) => {
  const { leadId, transactionCode } = req.body;
  const Lead = req.getModel('Lead', LeadSchema);
  const SubscriptionRequest = req.getModel('SubscriptionRequest', require('../../subscriptions/model/subscription-request.schema'));

  // Montant forcé côté serveur
  const SERVER_UNLOCK_PRICE = 500;

  let proofImageUrl = req.body.proofImage;
  let proofPublicId = null;

  if (req.file) {
    proofImageUrl = req.file.path || req.file.secure_url || req.file.url;
    proofPublicId = req.file.filename || req.file.public_id;
  }

  // 1. Validation : preuve requise
  if (!proofImageUrl && !transactionCode) {
    return sendResponse(res, null, "Veuillez fournir un code de transaction ou une capture d'écran.", 400);
  }

  // 2. Validation du code de transaction
  if (transactionCode) {
    const codeClean = String(transactionCode).trim();
    if (codeClean.length < 4) throw new Error("Code de transaction trop court (minimum 4 caractères)");
    const duplicateCode = await SubscriptionRequest.findOne({ transactionCode: codeClean });
    if (duplicateCode) throw new Error("Ce code de transaction a déjà été utilisé.");
  }

  // 3. Vérification du rôle
  if (req.user.subtype !== 'prestataire' && req.user.role !== 'admin' && req.user.role !== 'professional') {
    return sendResponse(res, null, "Seuls les prestataires peuvent débloquer des missions", 403);
  }

  const lead = await Lead.findById(leadId);
  if (!lead) throw new Error("Mission introuvable");
  if (lead.status !== 'open') throw new Error("Cette mission n'est plus ouverte");

  // 4. Vérifier qu'il n'a pas déjà débloqué ce lead
  if (lead.unlockedBy && lead.unlockedBy.some(id => id.toString() === req.user._id.toString())) {
    throw new Error("Vous avez déjà accès à cette mission.");
  }

  // 5. Vérifier s'il a déjà fait une demande pour ce lead
  const existing = await SubscriptionRequest.findOne({ 
    userId: req.user._id, 
    leadId, 
    plan: 'pay-per-lead',
    status: 'pending' 
  });
  
  if (existing) {
    throw new Error("Vous avez déjà une demande de déblocage en cours pour cette mission.");
  }

  const unlockReq = await SubscriptionRequest.create({
    userId: req.user._id,
    plan: 'pay-per-lead',
    leadId,
    amount: SERVER_UNLOCK_PRICE,
    proofImage: proofImageUrl || null,
    proofPublicId: proofPublicId || null,
    transactionCode: transactionCode ? String(transactionCode).trim() : null,
    status: 'pending'
  });

  return sendResponse(res, unlockReq, "Votre demande de déblocage a été envoyée et est en attente de vérification.", 201);
});
