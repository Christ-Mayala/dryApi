const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse').default || require('pdf-parse');

const upload = multer({ storage: multer.memoryStorage() });

function createPDFRouter() {
  const router = express.Router();

  router.post('/extract-text', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const data = await pdfParse(req.file.buffer);
      
      res.json({
        success: true,
        text: data.text,
        numPages: data.numpages,
        metadata: data.metadata
      });
    } catch (error) {
      console.error('PDF extraction error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to extract text from PDF',
        details: error.message 
      });
    }
  });

  return router;
}

module.exports = { createPDFRouter };
