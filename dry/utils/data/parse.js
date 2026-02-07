const parseBoolean = (value) => {
    if (value === true || value === false) return value;
    if (value === undefined || value === null) return undefined;
    const v = String(value).trim().toLowerCase();
    if (v === 'true' || v === '1' || v === 'yes' || v === 'y') return true;
    if (v === 'false' || v === '0' || v === 'no' || v === 'n') return false;
    return undefined;
};

const parseCsv = (value) => {
    if (value === undefined || value === null) return [];
    if (Array.isArray(value)) {
        return value.flatMap((x) => String(x).split(',')).map((s) => s.trim()).filter(Boolean);
    }
    return String(value)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
};

const parseNumber = (value) => {
    if (value === undefined || value === null || value === '') return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
};

module.exports = { parseBoolean, parseCsv, parseNumber };
