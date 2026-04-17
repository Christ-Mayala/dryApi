const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { getPagination } = require('../../../../../dry/utils/data/pagination');
const LeadSchema = require('../model/lead.schema');
const TradeSchema = require('../../categories/model/trade.schema');
const LeadResponseSchema = require('../model/lead-response.schema.js');

exports.createLead = asyncHandler(async (req, res) => {
  const { serviceType, description, location } = req.body;
  const Lead = req.getModel('Lead', LeadSchema);
  const Trade = req.getModel('Trade', TradeSchema);

  const tradeExists = await Trade.findOne({
    name: { $regex: new RegExp(`^${serviceType}$`, 'i') },
  });
  if (!tradeExists) {
    throw new Error(`Le type de service "${serviceType}" n'est pas reconnu.`);
  }

  let createdByRole = 'client';
  if (['prestataire', 'professional'].includes(req.user.role)) {
    createdByRole = 'professional';
  } else if (req.user.role === 'admin') {
    createdByRole = 'professional';
  }

  const lead = await Lead.create({
    serviceType,
    description,
    location,
    userId: req.user._id,
    createdByRole,
    isPremiumCreator: req.user.isPremium === true,
  });

  return sendResponse(res, lead, 'Demande de service creee avec succes');
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
      .populate('professionalId', 'name email telephone')
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
