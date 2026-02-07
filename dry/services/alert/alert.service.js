const emailService = require('../auth/email.service');

const postJson = async (url, payload, headers = {}) => {
  if (!url || typeof fetch !== 'function') return false;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (err) {
    return false;
  }
};

const eventMeta = (event) => {
  if (event === 'DRY_HEALTH_RECOVERED') {
    return { title: 'Serveur retabli', tone: 'ok', color: '#1b5e20', bg: '#e8f5e9', label: 'OK' };
  }
  if (event === 'DRY_DAILY_SUMMARY' || event === 'DRY_LOGS_SUMMARY') {
    return { title: 'Resume monitoring', tone: 'summary', color: '#0d47a1', bg: '#e3f2fd', label: 'RESUME' };
  }
  if (event === 'DRY_HEALTH_NOT_READY') {
    return { title: 'Serveur non pret', tone: 'alert', color: '#b71c1c', bg: '#ffebee', label: 'ALERTE' };
  }
  if (event === 'DRY_HEALTH_ERROR') {
    return { title: 'Erreur de monitoring', tone: 'alert', color: '#b71c1c', bg: '#ffebee', label: 'ALERTE' };
  }
  return { title: 'Alerte DRY', tone: 'alert', color: '#b71c1c', bg: '#ffebee', label: 'ALERTE' };
};

const formatDateTime = (value) => {
  try {
    const d = value ? new Date(value) : new Date();
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'full',
      timeStyle: 'medium',
    }).format(d);
  } catch (e) {
    return value || new Date().toISOString();
  }
};

const buildText = (payload) => {
  const meta = eventMeta(payload.event);
  const parts = [
    `${meta.title}`,
    `Event: ${payload.event || 'ALERT'}`,
    `Status: ${payload.status || 'UNKNOWN'}`,
    `HTTP: ${payload.http || 'N/A'}`,
    `URL: ${payload.url || 'N/A'}`,
    `Tenant: ${payload.tenant || 'N/A'}`,
    `Downtime(s): ${payload.downtimeSeconds ?? 'N/A'}`,
    `Time: ${payload.timestamp || new Date().toISOString()}`,
  ];
  if (payload.error) parts.push(`Error: ${payload.error}`);
  return parts.join(' | ');
};

const buildEmailHtml = (payload) => {
  const meta = eventMeta(payload.event);
  const rows = [
    { label: 'Evenement', value: payload.event || 'ALERT' },
    { label: 'Statut', value: payload.status || 'UNKNOWN' },
    { label: 'HTTP', value: payload.http || 'N/A' },
    { label: 'URL', value: payload.url || 'N/A' },
    { label: 'Serveur', value: payload.server || 'N/A' },
    { label: 'Tenant', value: payload.tenant || 'N/A' },
    { label: 'Downtime (s)', value: payload.downtimeSeconds ?? 'N/A' },
    { label: 'Downtime (humain)', value: payload.downtimeHuman || 'N/A' },
    { label: 'Debut panne', value: payload.downtimeStart || 'N/A' },
    { label: 'Fin panne', value: payload.downtimeEnd || 'N/A' },
    { label: 'Date / heure', value: formatDateTime(payload.timestamp) },
  ];
  if (payload.error) rows.push({ label: 'Erreur', value: payload.error });
  if (payload.causeProbable) rows.push({ label: 'Cause probable', value: payload.causeProbable });
  if (payload.summaryWindow) rows.push({ label: 'Fenetre resume', value: payload.summaryWindow });
  if (payload.summaryCount !== undefined) rows.push({ label: 'Nombre d incidents', value: payload.summaryCount });
  if (payload.summaryLines && payload.summaryLines.length) {
    rows.push({ label: 'Details', value: payload.summaryLines.join(' | ') });
  }

  const rowsHtml = rows
    .map((r) => `<tr><td style="padding:6px 10px;font-weight:600;">${r.label}</td><td style="padding:6px 10px;">${r.value}</td></tr>`)
    .join('');

  const intro =
    meta.tone === 'ok'
      ? 'Le serveur est a nouveau disponible. Tout est revenu a la normale.'
      : meta.tone === 'summary'
        ? 'Voici un resume des incidents detectes par le monitoring DRY.'
        : 'Une anomalie a ete detectee par le monitoring DRY.';

  const actions =
    meta.tone === 'alert'
      ? `
  <p style="margin:12px 0 0 0;">
    Actions recommandees:
    <br/>1) Verifie que le serveur repond: <code>${payload.url || ''}</code>
    <br/>2) Verifie les logs du serveur (Render / PM2)
    <br/>3) Si c'est une erreur reseau, verifie DNS et connectivite
  </p>`
      : '';

  return `
<div style="font-family: Arial, sans-serif; color: #222;">
  <div style="padding:10px 14px; background:${meta.bg}; border-left:6px solid ${meta.color}; margin-bottom:12px;">
    <div style="font-size:12px; letter-spacing:0.5px; color:${meta.color}; font-weight:700;">${meta.label}</div>
    <h2 style="margin:4px 0 0 0; color:${meta.color};">${meta.title}</h2>
  </div>
  <p style="margin:0 0 12px 0;">${intro}</p>
  <table style="border-collapse: collapse; border: 1px solid #ddd; width:100%; max-width:720px;">
    ${rowsHtml}
  </table>
  ${actions}
</div>`;
};

const sendAlert = async (payload) => {
  const text = buildText(payload);

  const genericWebhook = process.env.ALERT_WEBHOOK_URL || '';
  const slackWebhook = process.env.SLACK_WEBHOOK_URL || '';
  const discordWebhook = process.env.DISCORD_WEBHOOK_URL || '';
  const emailTo = process.env.ALERT_EMAIL_TO || '';

  const genericOk = genericWebhook ? await postJson(genericWebhook, payload) : null;
  const slackOk = slackWebhook ? await postJson(slackWebhook, { text }) : null;
  const discordOk = discordWebhook ? await postJson(discordWebhook, { content: text }) : null;

  let emailOk = null;
  if (emailTo) {
    try {
      const meta = eventMeta(payload.event);
      const subject = `[DRY ${meta.label}] ${meta.title} - ${payload.event || 'ALERT'}`;
      const html = buildEmailHtml(payload);
      await emailService.sendGenericEmail({ email: emailTo, subject, html });
      emailOk = true;
    } catch (err) {
      emailOk = false;
    }
  }

  return {
    webhook: {
      generic: genericOk,
      slack: slackOk,
      discord: discordOk,
    },
    email: emailOk,
  };
};

module.exports = { sendAlert };
