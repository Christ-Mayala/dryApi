const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

module.exports = asyncHandler(async (_req, res) => {
  const data = {
    platforms: [
      { id: 'youtube', label: 'YouTube', mediaTypes: ['video', 'audio', 'image'] },
      { id: 'facebook', label: 'Facebook', mediaTypes: ['video', 'image'] },
      { id: 'instagram', label: 'Instagram', mediaTypes: ['video', 'image'] },
      { id: 'pinterest', label: 'Pinterest', mediaTypes: ['video', 'image'] },
      { id: 'tiktok', label: 'TikTok', mediaTypes: ['video'] }
    ],
    audioOnlyPlatforms: ['youtube'],
    maxHeights: [2160, 1440, 1080, 720, 480, 360, 240]
  };
  return sendResponse(res, data, 'Plateformes supportees', true);
});
