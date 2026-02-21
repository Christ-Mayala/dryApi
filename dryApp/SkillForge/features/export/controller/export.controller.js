const asyncHandler = require('express-async-handler');
const ExportService = require('../../../../../dry/services/export/export.service');
const sendResponse = require('../../../../../dry/utils/http/response');

/**
 * Exporter des données
 * GET /api/v1/skillforge/export
 */
exports.exportData = asyncHandler(async (req, res) => {
  const { format, entity } = req.query;
  
  if (!entity) {
    res.status(400);
    throw new Error('Entité requise (paramètre query "entity")');
  }

  // Récupération dynamique du modèle
  let Model;
  try {
    Model = req.getModel(entity);
  } catch (error) {
    res.status(400);
    throw new Error('Entité inconnue ou modèle non trouvé: ' + entity);
  }
  
  // On récupère tout pour l'instant (ajouter filtres si nécessaire)
  const data = await Model.find().lean();
  const fields = data.length > 0 ? Object.keys(data[0]).filter(k => k !== '__v' && k !== 'password') : [];
  
  if (format === 'csv') {
    return ExportService.toCSV(data, fields, res, entity + '_export');
  } else if (format === 'excel') {
    const columns = fields.map(f => ({ header: f.toUpperCase(), key: f, width: 30 }));
    return ExportService.toExcel(data, columns, res, entity + '_export');
  }
  
  sendResponse(res, null, 'Format non supporté (utiliser csv ou excel)', 400);
});