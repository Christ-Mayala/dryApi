const PDFDocument = require('pdfkit');

class PdfService {
  /**
   * Construit un PDF à partir d'une fonction de dessin et retourne un Buffer.
   * @param {Function} draw - Reçoit le PDFDocument, dessine le contenu (peut être async).
   * @param {Object} options - Options PDFKit (size, margins, ...).
   */
  static async build(draw, options = {}) {
    const doc = new PDFDocument({ size: 'A4', margin: 50, ...options });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    const done = new Promise((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    await draw(doc);
    doc.end();

    return done;
  }

  /**
   * Construit un PDF et le transmet directement en téléchargement via la réponse Express.
   */
  static async stream(draw, res, filename = 'document.pdf', options = {}) {
    const buffer = await this.build(draw, options);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    return res.send(buffer);
  }
}

module.exports = PdfService;
