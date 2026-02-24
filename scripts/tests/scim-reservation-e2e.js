require('dotenv').config({ quiet: true });

const BASE_URL = String(process.env.E2E_SCIM_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');
const API = `${BASE_URL}/api/v1/scim`;
const ALLOW_REMOTE = String(process.env.E2E_SCIM_ALLOW_REMOTE || '').toLowerCase() === 'true';

const ADMIN_EMAIL = process.env.E2E_SCIM_ADMIN_EMAIL || process.env.SEED_ADMIN_EMAIL || 'admin@admin.com';
const ADMIN_PASSWORD = process.env.E2E_SCIM_ADMIN_PASSWORD || process.env.SEED_ADMIN_PASSWORD || 'Admin@2026';

const REQUESTER_EMAIL = process.env.E2E_SCIM_REQUESTER_EMAIL || '';
const REQUESTER_PASSWORD = process.env.E2E_SCIM_REQUESTER_PASSWORD || '';
const REQUESTER_PHONE = process.env.E2E_SCIM_REQUESTER_PHONE || '';
const TEST_ACK = String(process.env.E2E_SCIM_TEST_ACK || '').toLowerCase() === 'true';

const PROPERTY_ID = process.env.E2E_SCIM_PROPERTY_ID || '';
const SCIM_OFFSET = Number(process.env.SCIM_TZ_OFFSET_MINUTES || 60);

const ensureFetch = () => {
    if (typeof fetch !== 'function') {
        throw new Error('Global fetch is unavailable. Use Node 18+.');
    }
};

const isLocalBaseUrl = (url) => {
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(String(url || '').trim());
};

const toId = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return String(value._id || value.id || '');
};

const statusText = (value) => String(value || '').toLowerCase();

const buildScimLocalDate = ({ offsetMinutes = 60, dayOffset = 1, hour = 11, minute = 0 }) => {
    const now = new Date();
    const local = new Date(now.getTime() + offsetMinutes * 60 * 1000);
    local.setUTCDate(local.getUTCDate() + dayOffset);
    local.setUTCHours(hour, minute, 0, 0);

    const pad = (n) => String(n).padStart(2, '0');
    const y = local.getUTCFullYear();
    const m = pad(local.getUTCMonth() + 1);
    const d = pad(local.getUTCDate());
    const hh = pad(local.getUTCHours());
    const mm = pad(local.getUTCMinutes());
    return `${y}-${m}-${d}T${hh}:${mm}`;
};

const callApi = async (url, { method = 'GET', token = '', body } = {}) => {
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let json = null;
    try {
        json = text ? JSON.parse(text) : null;
    } catch (_) {}

    return { res, text, json };
};

const requireSuccess = (result, label) => {
    if (result?.json?.success === true) return result.json.data;
    const errorMessage = result?.json?.message || result?.text || 'Unknown error';
    throw new Error(`${label} failed: ${errorMessage}`);
};

const ensureReady = async () => {
    const result = await callApi(`${BASE_URL}/health/ready`);
    if (!result.res.ok) {
        throw new Error(`Healthcheck failed with status ${result.res.status}`);
    }
    if (result.json && result.json.status && result.json.status !== 'READY') {
        throw new Error(`Server is not READY (status: ${result.json.status})`);
    }
};

const login = async (email, password, label) => {
    const result = await callApi(`${API}/users/login`, {
        method: 'POST',
        body: { identifier: email, password },
    });
    const data = requireSuccess(result, `Login ${label}`);
    const token = data?.token;
    const user = data?.user || {};
    if (!token) throw new Error(`Login ${label} returned no token`);
    return { token, user };
};

const registerRequester = async () => {
    const stamp = Date.now();
    const password = `E2Escim!${stamp}`;
    const email = `e2e.scim.${stamp}@example.test`;

    const result = await callApi(`${API}/users/register`, {
        method: 'POST',
        body: {
            name: `E2E Client ${stamp}`,
            email,
            password,
            telephone: '+242060000000',
        },
    });

    const data = requireSuccess(result, 'Register temporary requester');
    const token = data?.token;
    const user = data?.user || {};
    if (!token) throw new Error('Temporary requester register returned no token');
    return { token, user, email, password };
};

const pickPropertyOwnerId = (property) => toId(property?.utilisateur);

const getPropertyById = async (id) => {
    const result = await callApi(`${API}/property/${id}`);
    return requireSuccess(result, 'Load forced property');
};

const pickProperty = async (requesterId) => {
    if (PROPERTY_ID) {
        const forced = await getPropertyById(PROPERTY_ID);
        const property = forced?.property || forced;
        if (!toId(property)) throw new Error('E2E_SCIM_PROPERTY_ID is invalid.');
        return property;
    }

    const result = await callApi(`${API}/property?limit=50`);
    const data = requireSuccess(result, 'List properties');
    const properties = Array.isArray(data?.properties) ? data.properties : [];

    if (properties.length === 0) {
        throw new Error('No property found. Create at least one active property first.');
    }

    const candidate = properties.find((p) => pickPropertyOwnerId(p) && pickPropertyOwnerId(p) !== requesterId);
    if (!candidate) {
        throw new Error('No property available for requester. Set E2E_SCIM_PROPERTY_ID to a property not owned by requester.');
    }

    return candidate;
};

const createReservation = async ({ token, propertyId, date, telephone = '' }) => {
    const result = await callApi(`${API}/reservation`, {
        method: 'POST',
        token,
        body: { propertyId, date, ...(telephone ? { telephone } : {}) },
    });
    const data = requireSuccess(result, `Create reservation (${date})`);
    const reservation = data?.reservation || data;
    const id = toId(reservation);
    if (!id) throw new Error('Create reservation returned no id');
    return {
        id,
        reservation,
        support: data?.support || reservation?.support || null,
    };
};

const patchReservation = async ({ token, id, action }) => {
    const result = await callApi(`${API}/reservation/${id}/${action}`, {
        method: 'PATCH',
        token,
    });
    return requireSuccess(result, `${action} reservation ${id}`);
};

const getReservation = async ({ token, id }) => {
    const result = await callApi(`${API}/reservation/${id}`, {
        method: 'GET',
        token,
    });
    return requireSuccess(result, `Get reservation ${id}`);
};

const assertConfirmed = (reservation) => {
    const s = statusText(reservation?.status);
    if (!s.includes('confirm')) {
        throw new Error(`Expected confirmed status, got "${reservation?.status}"`);
    }
};

const assertCancelled = (reservation) => {
    const s = statusText(reservation?.status);
    if (!s.includes('annul') && !s.includes('cancel')) {
        throw new Error(`Expected cancelled status, got "${reservation?.status}"`);
    }
};

const main = async () => {
    ensureFetch();
    if (!isLocalBaseUrl(BASE_URL) && !ALLOW_REMOTE) {
        throw new Error(
            `Refus URL distante: ${BASE_URL}. Utilise E2E_SCIM_BASE_URL=http://localhost:5000 (ou E2E_SCIM_ALLOW_REMOTE=true si tu veux vraiment tester en ligne).`,
        );
    }

    console.log('[SCIM E2E] Start reservation flow check');
    console.log(`[SCIM E2E] API: ${BASE_URL}`);

    await ensureReady();
    console.log('[SCIM E2E] Server READY');

    const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD, 'admin');
    console.log(`[SCIM E2E] Admin authenticated: ${admin.user.email || ADMIN_EMAIL}`);

    let requester = null;
    let requesterLabel = 'temporary requester';

    if (REQUESTER_EMAIL && REQUESTER_PASSWORD) {
        requester = await login(REQUESTER_EMAIL, REQUESTER_PASSWORD, 'requester');
        requesterLabel = REQUESTER_EMAIL;
    } else {
        requester = await registerRequester();
        requesterLabel = requester.email;
    }
    console.log(`[SCIM E2E] Requester ready: ${requesterLabel}`);

    const requesterId = toId(requester.user);
    const property = await pickProperty(requesterId);
    const propertyId = toId(property);
    const propertyTitle = property?.titre || property?.title || propertyId;
    console.log(`[SCIM E2E] Selected property: ${propertyTitle} (${propertyId})`);

    const visit1 = buildScimLocalDate({ offsetMinutes: SCIM_OFFSET, dayOffset: 1, hour: 11, minute: 0 });
    const requesterPhone = String(requester?.user?.telephone || requester?.telephone || REQUESTER_PHONE || '').trim();
    const first = await createReservation({
        token: requester.token,
        propertyId,
        date: visit1,
        telephone: requesterPhone,
    });
    await patchReservation({
        token: admin.token,
        id: first.id,
        action: 'confirm',
    });
    const firstState = await getReservation({ token: admin.token, id: first.id });
    assertConfirmed(firstState);
    console.log(`[SCIM E2E] Confirmed reservation: ${first.reservation?.reference || first.id}`);

    if (TEST_ACK) {
        await patchReservation({
            token: requester.token,
            id: first.id,
            action: 'ack',
        });
        const ackState = await getReservation({ token: requester.token, id: first.id });
        if (!ackState?.support?.acknowledgedAt) {
            throw new Error(`Expected acknowledgedAt on reservation ${first.id}`);
        }
        console.log(`[SCIM E2E] Acknowledged reservation: ${first.reservation?.reference || first.id}`);
    }

    const visit2 = buildScimLocalDate({ offsetMinutes: SCIM_OFFSET, dayOffset: 2, hour: 14, minute: 0 });
    const second = await createReservation({
        token: requester.token,
        propertyId,
        date: visit2,
        telephone: requesterPhone,
    });
    await patchReservation({
        token: requester.token,
        id: second.id,
        action: 'cancel',
    });
    const secondState = await getReservation({ token: requester.token, id: second.id });
    assertCancelled(secondState);
    console.log(`[SCIM E2E] Cancelled reservation: ${second.reservation?.reference || second.id}`);

    const summary = {
        propertyId,
        confirmedReservation: {
            id: first.id,
            reference: first.reservation?.reference || '',
            status: firstState?.status,
        },
        cancelledReservation: {
            id: second.id,
            reference: second.reservation?.reference || '',
            status: secondState?.status,
        },
        support: first.support || second.support || null,
    };

    console.log('[SCIM E2E] Done');
    console.log(JSON.stringify(summary, null, 2));
};

main().catch((error) => {
    console.error('[SCIM E2E] Failed');
    console.error(error && error.message ? error.message : error);
    process.exit(1);
});
