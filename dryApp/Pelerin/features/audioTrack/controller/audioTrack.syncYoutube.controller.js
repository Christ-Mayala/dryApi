const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const AudioTrackSchema = require('../model/audioTrack.schema');
const { syncYoutubeAudioTracks } = require('../../../services/youtubeAudio.service');

/**
 * POST /audioTrack/sync-youtube — admin. Lance immédiatement une passe de
 * découverte « audio chrétien YouTube » (même pipeline que le cron).
 */
module.exports = asyncHandler(async (req, res) => {
  const Track = req.getModel('AudioTrack', AudioTrackSchema);
  const result = await syncYoutubeAudioTracks(Track);
  return sendResponse(res, result, 'Découverte audio YouTube terminée');
});
