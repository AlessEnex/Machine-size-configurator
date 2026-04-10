/**
 * electricalPanelData.js - Data and types for electrical panels.
 * Contains a catalog of available electrical panels with their dimensions.
 * Data sourced from user-provided script 'classificazione_quadri.js'.
 */

// Elenco delle configurazioni uniche
// Raggruppate per Tipologia (typ), Lunghezza (L), Altezza (H) e Larghezza (W)
const dataQuadri = [
    // --- TIPOLOGIA: B2B ---
    { typ: "B2B", L: 800, H: 1800, W: 800 },
    { typ: "B2B", L: 1000, H: 1800, W: 800 },
    { typ: "B2B", L: 1200, H: 1800, W: 1000 },
    { typ: "B2B", L: 1400, H: 2000, W: 1000 },

    // --- TIPOLOGIA: T (Testa/Head) --- // L -> length, W -> width
    { typ: "T", L: 1400, H: 1800, W: 500 },
    { typ: "T", L: 1800, H: 1800, W: 500 },
    { typ: "T", L: 2200, H: 1800, W: 500 },
    { typ: "T", L: 2400, H: 2000, W: 500 },
    { typ: "T", L: 2800, H: 2000, W: 500, tag: "JUMBO" }
];

export default dataQuadri;
