/**
 * CONFIGURATION API - SPIRIT EMERAUDE
 * Architecture: Multi-Tenant DRY
 */

// URL de base (Change l'URL si tu mets en ligne)
export const API_BASE_URL = "http://localhost:5000";
export const APP_PREFIX = "/api/v1/spiritemeraude";

// URL Complète
const API = `${API_BASE_URL}${APP_PREFIX}`;

export const ENDPOINTS = {
    // --- AUTHENTIFICATION ---
    AUTH: {
        LOGIN:    `${API}/auth/login`,    // POST { email, password }
        REGISTER: `${API}/auth/register`, // POST { name, email, password, role }
        PROFILE:  `${API}/auth/profile`,  // GET (Header: Authorization Bearer token)
    },

    // --- BOUTIQUE (Produits) ---
    PRODUCT: {
        LIST:   `${API}/product`,      // GET (Params: ?category=sac&sort=-price)
        DETAIL: (id) => `${API}/product/${id}`, // GET
        CREATE: `${API}/product`,      // POST (Multipart: name, price, category, images[]) -> ADMIN
        UPDATE: (id) => `${API}/product/${id}`, // PUT (Multipart) -> ADMIN
        DELETE: (id) => `${API}/product/${id}`, // DELETE -> ADMIN
    },

    // --- ATELIERS ---
    ATELIER: {
        LIST:   `${API}/atelier`,
        DETAIL: (id) => `${API}/atelier/${id}`,
        CREATE: `${API}/atelier`,
        UPDATE: (id) => `${API}/atelier/${id}`,
        DELETE: (id) => `${API}/atelier/${id}`,
    },

    // --- IMPACT SOCIAL (Orphelinat) ---
    IMPACT: {
        LIST:   `${API}/impact`,
        CREATE: `${API}/impact`,       // POST (Multipart: images[], videos[]) -> ADMIN
        DELETE: (id) => `${API}/impact/${id}`, // DELETE -> ADMIN
    },

    // --- GALERIE PHOTOS ---
    GALLERY: {
        LIST:   `${API}/gallery`,
        CREATE: `${API}/gallery`,      // POST (Multipart: images[]) -> ADMIN
        DELETE: (id) => `${API}/gallery/${id}`, // DELETE -> ADMIN
    },

    // --- CONTACT (Messagerie) ---
    CONTACT: {
        SEND: `${API}/contact`,        // POST { name, phone, email, subject, message } -> PUBLIC
        LIST: `${API}/contact`,        // GET -> ADMIN (Voir les messages reçus)
    }
};

export const ROLES = {
    ADMIN: 'admin',
    USER: 'user'
};

export const CATEGORIES = {
    PRODUCT: ['sac', 'trousse', 'sandale', 'accessoire', 'personnalise', 'saisonnier'],
    GALLERY: ['atelier', 'creation', 'humanitaire', 'autre']
};