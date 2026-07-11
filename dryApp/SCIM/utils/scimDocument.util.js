const path = require('path');
const fs = require('fs');

const GOLD = '#92700a';
const DARK = '#18181b';
const GREY = '#71717a';
const LIGHT_GREY = '#e4e4e7';

const LOGO_PATH = path.join(__dirname, '..', 'assets', 'scim-logo.jpg');
const HAS_LOGO = fs.existsSync(LOGO_PATH);

// Largeur d'un bloc de contenu centré sur la page (au lieu d'utiliser toute la
// largeur utile) afin que les documents aient une allure de courrier officiel.
const CONTENT_WIDTH = 460;

const formatMoney = (amount, currency = 'XAF') => {
    const n = Number(amount || 0);
    const formatted = new Intl.NumberFormat('fr-FR').format(Math.round(n));
    return `${formatted} ${currency}`;
};

const formatDateFr = (value) => {
    if (!value) return '—';
    try {
        return new Intl.DateTimeFormat('fr-FR', {
            year: 'numeric', month: 'long', day: '2-digit',
        }).format(new Date(value));
    } catch (_) {
        return '—';
    }
};

const formatDateTimeFr = (value) => {
    if (!value) return '—';
    try {
        return new Intl.DateTimeFormat('fr-FR', {
            year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
        }).format(new Date(value));
    } catch (_) {
        return '—';
    }
};

// `name` et `nom` contiennent généralement la même valeur (le formulaire d'inscription
// ne collecte qu'un seul champ "nom complet", dupliqué côté backend) : on ne les
// concatène donc pas, au risque d'afficher "Prénom Nom Prénom Nom".
const personName = (person) => {
    if (!person) return '—';
    return person.nom || person.name || person.email || '—';
};

const contentX = (doc) => (doc.page.width - CONTENT_WIDTH) / 2;

const drawHeader = (doc, { title, subtitle, reference }) => {
    const bandHeight = 105;
    doc.rect(0, 0, doc.page.width, bandHeight).fill(DARK);

    const centerX = doc.page.width / 2;
    const logoRadius = 22;
    const logoY = 12;

    if (HAS_LOGO) {
        doc.save();
        doc.circle(centerX, logoY + logoRadius, logoRadius).clip();
        doc.image(LOGO_PATH, centerX - logoRadius, logoY, { width: logoRadius * 2, height: logoRadius * 2 });
        doc.restore();
        doc.circle(centerX, logoY + logoRadius, logoRadius).lineWidth(1.5).strokeColor(GOLD).stroke();
    }

    doc.fillColor(GOLD)
        .font('Helvetica-Bold')
        .fontSize(15)
        .text('SCIM IMMOBILIER', 0, logoY + logoRadius * 2 + 6, { align: 'center', width: doc.page.width });

    doc.fillColor('#ffffff')
        .font('Helvetica')
        .fontSize(8)
        .text(subtitle || '', 0, logoY + logoRadius * 2 + 23, { align: 'center', width: doc.page.width, characterSpacing: 0.4 });

    if (reference) {
        doc.fillColor(GOLD)
            .font('Helvetica-Bold')
            .fontSize(9)
            .text(`Réf. ${reference}`, 0, 14, { align: 'right', width: doc.page.width - 30 });
    }

    doc.fillColor(DARK)
        .font('Helvetica-Bold')
        .fontSize(15)
        .text(title, 0, bandHeight + 14, { align: 'center', width: doc.page.width });

    doc.moveTo(contentX(doc), bandHeight + 38).lineTo(contentX(doc) + CONTENT_WIDTH, bandHeight + 38)
        .strokeColor(LIGHT_GREY).lineWidth(1).stroke();

    doc.x = contentX(doc);
    doc.y = bandHeight + 50;
};

const drawFooter = (doc, note) => {
    // Le texte doit rester nettement au-dessus de la marge basse (page.height - margins.bottom)
    // sous peine de déclencher un saut de page automatique de PDFKit pour une simple ligne de pied de page.
    const maxY = doc.page.height - doc.page.margins.bottom;
    const bottom = maxY - 26;
    doc.moveTo(contentX(doc), bottom).lineTo(contentX(doc) + CONTENT_WIDTH, bottom).strokeColor(LIGHT_GREY).lineWidth(1).stroke();
    doc.fillColor(GREY)
        .font('Helvetica')
        .fontSize(8)
        .text(note || `SCIM Immobilier — Congo-Brazzaville — Document généré le ${formatDateTimeFr(new Date())}`, 0, bottom + 8, {
            width: doc.page.width,
            align: 'center',
        });
};

const drawSectionTitle = (doc, text) => {
    doc.moveDown(0.5);
    doc.x = contentX(doc);
    doc.fillColor(GOLD).font('Helvetica-Bold').fontSize(10).text(text.toUpperCase(), contentX(doc), doc.y, { width: CONTENT_WIDTH, characterSpacing: 0.5 });
    doc.moveDown(0.2);
};

const drawKeyValueRow = (doc, label, value) => {
    const startX = contentX(doc);
    const y = doc.y;
    doc.fillColor(GREY).font('Helvetica-Bold').fontSize(9).text(label, startX, y, { width: 145 });
    const valueHeight = doc.fillColor(DARK).font('Helvetica').fontSize(9.5)
        .heightOfString(String(value ?? '—'), { width: CONTENT_WIDTH - 145 });
    doc.text(String(value ?? '—'), startX + 145, y, { width: CONTENT_WIDTH - 145 });
    doc.y = y + Math.max(13, valueHeight) + 4;
    doc.x = contentX(doc);
};

/**
 * Bloc de signatures centré : client d'un côté, cachet/représentant SCIM de l'autre.
 */
const drawSignatureBlock = (doc, { leftLabel = 'Signature du client', rightLabel = 'Cachet et signature SCIM Immobilier' } = {}) => {
    doc.moveDown(1);
    const startX = contentX(doc);
    const colWidth = CONTENT_WIDTH / 2 - 10;

    doc.fillColor(GREY).font('Helvetica').fontSize(9)
        .text(`Fait à Brazzaville, le ${formatDateFr(new Date())}`, startX, doc.y, { width: CONTENT_WIDTH, align: 'center' });

    doc.moveDown(1.8);
    const signY = doc.y;

    doc.moveTo(startX, signY).lineTo(startX + colWidth, signY).strokeColor(LIGHT_GREY).stroke();
    doc.moveTo(startX + CONTENT_WIDTH - colWidth, signY).lineTo(startX + CONTENT_WIDTH, signY).strokeColor(LIGHT_GREY).stroke();

    doc.fillColor(GREY).font('Helvetica').fontSize(8);
    doc.text(leftLabel, startX, signY + 6, { width: colWidth, align: 'center' });
    doc.text(rightLabel, startX + CONTENT_WIDTH - colWidth, signY + 6, { width: colWidth, align: 'center' });

    doc.x = startX;
    doc.y = signY + 22;
};

const requestTypeLabel = (requestType) => {
    if (requestType === 'location') return 'Location';
    if (requestType === 'achat') return 'Achat';
    return 'Visite';
};

// Retrouve le motif éventuel saisi lors d'un changement de statut (les notes sont
// formées "Raison générique — motif libre" ; on ne garde que la partie libre).
const getReasonFromHistory = (reservation, statusKey) => {
    const history = Array.isArray(reservation?.statusHistory) ? reservation.statusHistory : [];
    const entry = [...history].reverse().find((h) => h?.status === statusKey);
    const note = String(entry?.note || '').trim();
    const idx = note.lastIndexOf('—');
    return idx >= 0 ? note.slice(idx + 1).trim() : '';
};

const NEXT_STEPS_BY_TYPE = {
    visite: "Merci de vous présenter à la date convenue, muni(e) d'une pièce d'identité valide. Notre agent vous accueillera sur place.",
    location: "Notre équipe vous contactera prochainement pour finaliser le dossier de location : pièces justificatives, garantie locative et signature du bail.",
    achat: "Notre équipe vous contactera prochainement pour la suite du processus d'acquisition : vérification des documents, modalités de financement et signature de l'acte de vente.",
};

const buildStatusAwareClosingText = (reservation, typeLbl) => {
    const statusKey = String(reservation?.status || 'en_attente');

    if (statusKey === 'annulee') {
        const reason = getReasonFromHistory(reservation, 'annulee');
        return reason
            ? `Cette demande a été annulée. Motif : ${reason}. N'hésitez pas à nous contacter pour toute question ou pour soumettre une nouvelle demande.`
            : `Cette demande a été annulée. N'hésitez pas à nous contacter pour toute question ou pour soumettre une nouvelle demande.`;
    }
    if (statusKey === 'confirmee') {
        const steps = NEXT_STEPS_BY_TYPE[reservation?.requestType] || NEXT_STEPS_BY_TYPE.visite;
        return `Votre demande a été confirmée. ${steps}`;
    }
    if (statusKey === 'terminee') {
        return `Cette ${typeLbl.toLowerCase()} est à présent terminée. Merci pour votre confiance — SCIM Immobilier reste à votre disposition pour vos futurs projets immobiliers.`;
    }
    return 'Ce reçu confirme l\'enregistrement de votre demande auprès de SCIM Immobilier. Il ne constitue pas un contrat et ne vaut pas confirmation définitive tant que le statut n\'indique pas "Confirmée".';
};

/**
 * Reçu / accusé de réception d'une demande de réservation (visite, location ou achat).
 */
const buildReservationReceiptPdf = (doc, { reservation, property, client } = {}) => {
    const typeLabel = requestTypeLabel(reservation?.requestType);

    drawHeader(doc, {
        title: `Reçu — Demande de ${typeLabel.toLowerCase()}`,
        subtitle: 'Accusé de réception de votre demande',
        reference: reservation?.reference || String(reservation?._id || ''),
    });

    drawSectionTitle(doc, 'Bien concerné');
    drawKeyValueRow(doc, 'Titre', property?.titre);
    drawKeyValueRow(doc, 'Ville', property?.ville);
    drawKeyValueRow(doc, 'Adresse', property?.adresse || '—');
    drawKeyValueRow(doc, 'Prix', formatMoney(property?.prix, property?.devise || 'XAF'));

    drawSectionTitle(doc, 'Demandeur');
    drawKeyValueRow(doc, 'Nom', personName(client));
    drawKeyValueRow(doc, 'Email', client?.email || '—');
    drawKeyValueRow(doc, 'Téléphone', client?.telephone || reservation?.support?.requesterPhone || '—');

    drawSectionTitle(doc, 'Détails de la demande');
    drawKeyValueRow(doc, 'Type de demande', typeLabel);
    drawKeyValueRow(doc, 'Date souhaitée', formatDateTimeFr(reservation?.date));
    drawKeyValueRow(doc, 'Statut', reservation?.statusLabel || reservation?.status || 'En attente');
    drawKeyValueRow(doc, 'Émis le', formatDateTimeFr(new Date()));

    doc.moveDown(1);
    doc.fillColor(GREY).font('Helvetica').fontSize(9).text(
        buildStatusAwareClosingText(reservation, typeLabel),
        contentX(doc), doc.y, { width: CONTENT_WIDTH, align: 'center' },
    );

    drawSignatureBlock(doc);
    drawFooter(doc);
};

/**
 * Contrat de location ou de vente généré une fois la réservation confirmée.
 */
const buildReservationContractPdf = (doc, { reservation, property, client, owner } = {}) => {
    const isVente = reservation?.requestType === 'achat';
    const typeLabel = isVente ? 'Vente' : 'Location';

    drawHeader(doc, {
        title: `Contrat de ${typeLabel.toLowerCase()}`,
        subtitle: `Généré automatiquement suite à la confirmation de la réservation`,
        reference: reservation?.reference || String(reservation?._id || ''),
    });

    drawSectionTitle(doc, isVente ? 'Le vendeur (bailleur)' : 'Le bailleur (propriétaire)');
    drawKeyValueRow(doc, 'Nom', personName(owner));
    drawKeyValueRow(doc, 'Email', owner?.email || '—');
    drawKeyValueRow(doc, 'Téléphone', owner?.telephone || '—');

    drawSectionTitle(doc, isVente ? "L'acheteur" : 'Le locataire');
    drawKeyValueRow(doc, 'Nom', personName(client));
    drawKeyValueRow(doc, 'Email', client?.email || '—');
    drawKeyValueRow(doc, 'Téléphone', client?.telephone || reservation?.support?.requesterPhone || '—');

    drawSectionTitle(doc, 'Bien');
    drawKeyValueRow(doc, 'Titre', property?.titre);
    drawKeyValueRow(doc, 'Catégorie', property?.categorie);
    drawKeyValueRow(doc, 'Ville', property?.ville);
    drawKeyValueRow(doc, 'Adresse', property?.adresse || '—');
    drawKeyValueRow(doc, isVente ? 'Prix de vente' : 'Loyer', formatMoney(property?.prix, property?.devise || 'XAF'));

    drawSectionTitle(doc, 'Conditions');
    drawKeyValueRow(doc, 'Référence réservation', reservation?.reference || String(reservation?._id || ''));
    drawKeyValueRow(doc, 'Date de confirmation', formatDateTimeFr(reservation?.support?.confirmedAt || reservation?.updatedAt));
    drawKeyValueRow(doc, isVente ? 'Date souhaitée de vente' : "Date d'entrée souhaitée", formatDateTimeFr(reservation?.date));

    doc.moveDown(1);
    doc.fillColor(DARK).font('Helvetica').fontSize(9).text(
        `Le présent document atteste de l'accord de principe entre les parties ci-dessus concernant le bien désigné, dans le cadre d'une opération de ${typeLabel.toLowerCase()} intermédiée par SCIM Immobilier. Les modalités définitives (durée, garanties, échéancier) seront formalisées entre les parties.`,
        contentX(doc), doc.y, { width: CONTENT_WIDTH, align: 'center' },
    );

    drawSignatureBlock(doc, {
        leftLabel: isVente ? "Signature de l'acheteur" : 'Signature du locataire',
        rightLabel: isVente ? 'Signature du vendeur / SCIM Immobilier' : 'Signature du bailleur / SCIM Immobilier',
    });

    drawFooter(doc, 'Document généré automatiquement — ne remplace pas un acte notarié le cas échéant.');
};

/**
 * Bloc de 4 chiffres-cles mis en avant (cartes arrondies), pour donner une lecture
 * immediate du rapport avant le detail ligne par ligne.
 */
const drawHighlightCards = (doc, cards) => {
    const startX = contentX(doc);
    const gap = 10;
    const cardWidth = (CONTENT_WIDTH - gap * (cards.length - 1)) / cards.length;
    const cardHeight = 60;
    const y = doc.y;

    cards.forEach((card, i) => {
        const x = startX + i * (cardWidth + gap);
        doc.roundedRect(x, y, cardWidth, cardHeight, 10).lineWidth(1).strokeColor(LIGHT_GREY).stroke();
        doc.fillColor(GOLD).font('Helvetica-Bold').fontSize(17).text(String(card.value), x + 2, y + 11, { width: cardWidth - 4, align: 'center' });
        doc.fillColor(GREY).font('Helvetica-Bold').fontSize(7).text(card.label.toUpperCase(), x + 2, y + 38, { width: cardWidth - 4, align: 'center', characterSpacing: 0.3 });
    });

    doc.y = y + cardHeight + 16;
    doc.x = startX;
};

/**
 * Rapport d'activité (admin) sur une période donnée.
 */
const buildActivityReportPdf = (doc, { stats, range, generatedBy, periodLabel } = {}) => {
    drawHeader(doc, {
        title: "Rapport d'activité",
        subtitle: periodLabel
            ? `${periodLabel} · ${formatDateFr(range?.from)} — ${formatDateFr(range?.to)}`
            : `Période : ${formatDateFr(range?.from)} — ${formatDateFr(range?.to)}`,
    });

    const totalReservations = stats?.totalReservations ?? 0;
    const confirmedOrDone = (stats?.reservationsByStatus?.confirmee ?? 0) + (stats?.reservationsByStatus?.terminee ?? 0);
    const confirmationRate = totalReservations ? Math.round((confirmedOrDone / totalReservations) * 100) : 0;

    drawHighlightCards(doc, [
        { value: totalReservations, label: 'Réservations' },
        { value: `${confirmationRate}%`, label: 'Taux confirmation' },
        { value: stats?.newProperties ?? 0, label: 'Nouveaux biens' },
        { value: stats?.newUsers ?? 0, label: 'Nouveaux clients' },
    ]);

    drawSectionTitle(doc, 'Vue d\'ensemble');
    drawKeyValueRow(doc, 'Biens actifs', stats?.activeProperties ?? 0);
    drawKeyValueRow(doc, 'Nouveaux biens (période)', stats?.newProperties ?? 0);
    drawKeyValueRow(doc, 'Utilisateurs', stats?.totalUsers ?? 0);
    drawKeyValueRow(doc, 'Nouveaux utilisateurs (période)', stats?.newUsers ?? 0);

    drawSectionTitle(doc, 'Réservations');
    drawKeyValueRow(doc, 'Total sur la période', stats?.totalReservations ?? 0);
    drawKeyValueRow(doc, '— Visites', stats?.reservationsByType?.visite ?? 0);
    drawKeyValueRow(doc, '— Locations', stats?.reservationsByType?.location ?? 0);
    drawKeyValueRow(doc, '— Achats', stats?.reservationsByType?.achat ?? 0);
    drawKeyValueRow(doc, 'En attente', stats?.reservationsByStatus?.en_attente ?? 0);
    drawKeyValueRow(doc, 'Confirmées', stats?.reservationsByStatus?.confirmee ?? 0);
    drawKeyValueRow(doc, 'Terminées', stats?.reservationsByStatus?.terminee ?? 0);
    drawKeyValueRow(doc, 'Annulées', stats?.reservationsByStatus?.annulee ?? 0);

    drawSectionTitle(doc, 'Messagerie');
    drawKeyValueRow(doc, 'Messages échangés (période)', stats?.newMessages ?? 0);
    drawKeyValueRow(doc, 'Messages non lus', stats?.unreadMessages ?? 0);

    if (Array.isArray(stats?.topProperties) && stats.topProperties.length) {
        drawSectionTitle(doc, 'Biens les plus consultés');
        stats.topProperties.slice(0, 8).forEach((p, idx) => {
            drawKeyValueRow(doc, `${idx + 1}. ${p.titre || 'Bien'}`, `${p.vues ?? 0} vues — ${p.ville || ''}`);
        });
    }

    doc.moveDown(1);
    doc.fillColor(GREY).font('Helvetica').fontSize(8).text(
        `Rapport généré par ${generatedBy || 'l\'administration SCIM'} le ${formatDateTimeFr(new Date())}.`,
        contentX(doc), doc.y, { width: CONTENT_WIDTH, align: 'center' },
    );

    drawFooter(doc);
};

module.exports = {
    formatMoney,
    formatDateFr,
    formatDateTimeFr,
    requestTypeLabel,
    buildReservationReceiptPdf,
    buildReservationContractPdf,
    buildActivityReportPdf,
};
