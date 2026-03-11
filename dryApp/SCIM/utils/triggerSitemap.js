const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const DEFAULT_SCRIPT_PATH = path.resolve(__dirname, '../../../../SCIM/scripts/generateSitemap.js');

const toBool = (value) => String(value || '').toLowerCase() === 'true';

const resolveScriptPath = () => {
    if (process.env.FRONTEND_SITEMAP_SCRIPT) {
        return path.resolve(process.env.FRONTEND_SITEMAP_SCRIPT);
    }

    if (process.env.SCIM_FRONTEND_PATH) {
        return path.resolve(process.env.SCIM_FRONTEND_PATH, 'scripts/generateSitemap.js');
    }

    return DEFAULT_SCRIPT_PATH;
};

const triggerSitemapRegeneration = (reason = 'property-change') => {
    if (toBool(process.env.DISABLE_SITEMAP_TRIGGER)) {
        return false;
    }

    const scriptPath = resolveScriptPath();
    if (!fs.existsSync(scriptPath)) {
        console.warn(`[SCIM:SITEMAP] Script introuvable: ${scriptPath}`);
        return false;
    }

    try {
        const child = spawn(process.execPath, [scriptPath], {
            cwd: path.dirname(scriptPath),
            detached: false,
            stdio: 'ignore',
            windowsHide: true,
        });

        child.unref();
        console.log(`[SCIM:SITEMAP] Regeneration declenchee (${reason}).`);
        return true;
    } catch (error) {
        console.warn(`[SCIM:SITEMAP] Echec declenchement (${reason}): ${error.message}`);
        return false;
    }
};

module.exports = { triggerSitemapRegeneration };
