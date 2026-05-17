const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { getPagination } = require('../../../../../dry/utils/data/pagination');

const PropertySubmissionSchema = require('../../property/model/propertySubmission.schema');

module.exports = asyncHandler(async (req, res) => {
    const PropertySubmission = req.getModel('PropertySubmission', PropertySubmissionSchema);
    const { page, limit, skip } = getPagination(req.query, { defaultLimit: 10, maxLimit: 100 });

    const query = {};
    const status = String(req.query.status || '').trim();
    if (status && status !== 'all') query.status = status;

    if (req.query.search) {
        const searchRegex = { $regex: req.query.search, $options: 'i' };
        const searchOr = [
            { 'propertyData.titre': searchRegex },
            { 'propertyData.ville': searchRegex },
            { 'submitter.name': searchRegex },
            { 'submitter.email': searchRegex }
        ];

        if (Object.keys(query).length > 0) {
            query.$and = query.$and || [];
            query.$and.push({ $or: searchOr });
        } else {
            query.$or = searchOr;
        }
    }

    const [items, total] = await Promise.all([
        PropertySubmission.find(query)
            .populate('submitter.user', 'name nom email telephone')
            .populate('reviewedBy', 'name nom email')
            .populate('createdProperty', 'titre status')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        PropertySubmission.countDocuments(query),
    ]);

    return sendResponse(res, {
        items,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
    }, 'Soumissions de biens');
});
