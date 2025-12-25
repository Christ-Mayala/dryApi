const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/response');

const ReportSchema = require('../../reports/model/report.schema');
const ProfessionalSchema = require('../../professionals/model/professional.schema');

module.exports = asyncHandler(async (req, res) => {
  if (!req.user?._id) throw new Error('Non autorisé');

  const Report = req.getModel('Report', ReportSchema);
  const User = req.getModel('User');

  const { id } = req.params;
  const { decision, note } = req.body || {};
  if (decision !== 'keep' && decision !== 'delete') throw new Error('Décision invalide');

  const report = await Report.findById(id);
  if (!report) throw new Error('Signalement introuvable');
  if (report.status === 'resolved') throw new Error('Signalement déjà traité');

  if (decision === 'delete') {
    await User.findByIdAndUpdate(report.targetUser, { status: 'deleted' }, { new: false });

    const Professional = req.getModel('Professional', ProfessionalSchema);
    await Professional.updateMany({ createdBy: report.targetUser }, { $set: { approvalStatus: 'rejected' } });
  }

  report.status = 'resolved';
  report.decision = decision;
  report.decisionNote = note ? String(note).trim() : '';
  report.decidedBy = req.user._id;
  report.decidedAt = new Date();
  await report.save();

  const updated = await Report.findById(report._id)
    .populate('reporter', 'name email')
    .populate('targetUser', 'name email role status')
    .populate('targetProfessional', 'name ville quartier');

  return sendResponse(res, updated, 'Signalement traité');
});
