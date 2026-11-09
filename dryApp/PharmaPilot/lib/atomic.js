/**
 * Execution atomique d'operations multi-documents.
 *
 * Principe : toute operation qui modifie plus d'un document (reception,
 * sortie, inventaire, ajustement) doit s'executer dans une transaction
 * MongoDB afin de ne jamais laisser d'etat partiellement applique.
 *
 * Le cluster cible (Atlas / replica set) supporte les transactions.
 * Un repli non transactionnel est prevu uniquement pour un Mongo standalone
 * de developpement, et journalise un avertissement explicite.
 */

const TX_UNSUPPORTED = /Transaction numbers are only allowed|does not support transactions|replica set|mongos/i;

/**
 * @param {import('mongoose').Connection} conn - connexion du tenant (Model.db)
 * @param {(session: import('mongoose').ClientSession|null) => Promise<any>} fn
 * @returns {Promise<any>}
 */
const runAtomic = async (conn, fn) => {
  if (!conn || typeof conn.startSession !== 'function') {
    return fn(null);
  }

  let session = null;
  try {
    session = await conn.startSession();
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } catch (err) {
    if (TX_UNSUPPORTED.test(err.message || '')) {
      console.warn('[PharmaPilot][atomic] Transactions indisponibles sur ce cluster — repli non transactionnel.');
      return fn(null);
    }
    throw err;
  } finally {
    if (session) {
      try { await session.endSession(); } catch (_) { /* ignore */ }
    }
  }
};

module.exports = { runAtomic };
