const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const { pickDefined } = require('../../../../../dry/utils/data/pick');
const AudioTrackSchema = require('../model/audioTrack.schema');

const CATEGORIES = AudioTrackSchema.statics.CATEGORIES;

// POST /audioTrack — admin. Deux sources possibles pour l'audio : un fichier
// uploade (champ "audio", -> Cloudinary) OU un lien direct dans req.body.url
// (YouTube/Spotify/flux mp3 externe) — au moins l'un des deux est requis.
module.exports = asyncHandler(async (req, res) => {
  const Model = req.getModel('AudioTrack', AudioTrackSchema);

  const { title, category } = req.body;
  if (!title) throw httpError('title est requis', 400);
  if (!category || !CATEGORIES.includes(category)) {
    throw httpError(`category invalide : attendu ${CATEGORIES.join(', ')}`, 400);
  }

  const audioFile = req.files?.audio?.[0];
  const coverFile = req.files?.cover?.[0];
  const linkUrl = (req.body.url || '').trim();

  if (!audioFile && !linkUrl) {
    throw httpError('Fournis un fichier audio ou un lien.', 400);
  }

  const payload = {
    ...pickDefined(req.body, ['title', 'artist', 'category', 'duration']),
    url: audioFile ? audioFile.path : linkUrl,
  };
  if (audioFile) payload.audioPublicId = audioFile.filename;
  if (coverFile) {
    payload.coverUrl = coverFile.path;
    payload.coverPublicId = coverFile.filename;
  } else if (req.body.coverUrl) {
    payload.coverUrl = req.body.coverUrl.trim();
  }

  const track = await Model.create(payload);
  return sendResponse(res, track, 'Piste créée');
});
