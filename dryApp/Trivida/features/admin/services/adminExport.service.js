/**
 * Service d'export — Trivida Admin Panel
 * 
 * Génère des fichiers CSV et Excel (via exceljs) pour :
 *   - Liste des utilisateurs avec filtres
 *   - Statistiques globales
 *   - Historique des métriques quotidiennes
 * 
 * Utilise exceljs (déjà installé dans dryApi) pour Excel
 * et json2csv pour CSV.
 */
const ExcelJS = require('exceljs');

/**
 * Générer un fichier Excel à partir d'un tableau de données
 * @param {Object} params
 * @param {string} params.sheetName - Nom de la feuille Excel
 * @param {string[]} params.headers - En-têtes de colonnes
 * @param {Array<Array>} params.rows - Données (tableau de tableaux)
 * @param {string} [params.filename] - Nom du fichier (sans extension)
 * @returns {Buffer} Le fichier Excel en buffer
 */
async function generateExcel({ sheetName, headers, rows, filename }) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Trivida Admin';
    workbook.created = new Date();
    
    const sheet = workbook.addWorksheet(sheetName);
    
    // Style des en-têtes
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2563EB' }, // blue-600
    };
    sheet.getRow(1).alignment = { horizontal: 'center' };
    
    // En-têtes
    sheet.columns = headers.map((h, i) => ({
        header: h,
        key: `col${i}`,
        width: Math.max(h.length + 4, 15),
    }));
    
    // Données
    rows.forEach(row => {
        sheet.addRow(row);
    });
    
    // Bordures fines
    sheet.eachRow((row) => {
        row.eachCell((cell) => {
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            };
        });
    });
    
    // Auto-filter
    if (rows.length > 0) {
        sheet.autoFilter = {
            from: { row: 1, column: 1 },
            to: { row: 1, column: headers.length },
        };
    }
    
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
}

/**
 * Générer un fichier CSV simple
 * @param {string[]} headers - En-têtes
 * @param {Array<Array>} rows - Données
 * @returns {string} Le contenu CSV
 */
function generateCSV(headers, rows) {
    const escapeCSV = (val) => {
        if (val === null || val === undefined) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };
    
    const lines = [
        headers.map(escapeCSV).join(','),
        ...rows.map(row => row.map(escapeCSV).join(',')),
    ];
    
    return lines.join('\r\n');
}

/**
 * Formater une date pour l'export
 */
function formatDateForExport(date) {
    if (!date) return '';
    return new Date(date).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

/**
 * Formater un montant XAF
 */
function formatXAF(amount) {
    if (!amount && amount !== 0) return '0';
    return new Intl.NumberFormat('fr-FR').format(amount);
}

module.exports = { 
    generateExcel, 
    generateCSV, 
    formatDateForExport, 
    formatXAF 
};
