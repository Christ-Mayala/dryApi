const { Parser } = require('json2csv');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

class ExportService {
  /**
   * Convertit des données JSON en CSV
   * @param {Array} data - Tableau d'objets à exporter
   * @param {Array} fields - Liste des champs (colonnes) à inclure
   * @param {Object} res - Objet Response Express (optionnel, pour téléchargement direct)
   * @param {String} filename - Nom du fichier (sans extension)
   */
  static async toCSV(data, fields, res = null, filename = 'export') {
    try {
      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(data);

      if (res) {
        res.header('Content-Type', 'text/csv');
        res.attachment(`${filename}.csv`);
        return res.send(csv);
      }

      return csv;
    } catch (error) {
      console.error('Erreur export CSV:', error);
      throw new Error('Erreur lors de la génération du CSV');
    }
  }

  /**
   * Génère un fichier Excel (.xlsx)
   * @param {Array} data - Tableau d'objets à exporter
   * @param {Array} columns - Définition des colonnes [{ header: 'Nom', key: 'name', width: 30 }]
   * @param {Object} res - Objet Response Express (optionnel)
   * @param {String} filename - Nom du fichier
   */
  static async toExcel(data, columns, res = null, filename = 'export') {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Données');

    worksheet.columns = columns;
    worksheet.addRows(data);

    // Style de l'en-tête
    worksheet.getRow(1).font = { bold: true };
    
    if (res) {
      res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.attachment(`${filename}.xlsx`);
      await workbook.xlsx.write(res);
      return res.end();
    }

    return await workbook.xlsx.writeBuffer();
  }
}

module.exports = ExportService;
