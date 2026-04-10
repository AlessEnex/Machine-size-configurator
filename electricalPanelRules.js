/**
 * electricalPanelRules.js - Business rules for electrical panel selection.
 */

export function getPanelPreferenceReferenceHeight(machineHeight, machineHeightText) {
    const parsedText = parseInt(machineHeightText, 10);
    return machineHeight || (Number.isFinite(parsedText) ? parsedText : 0);
}

export function isPanelPreferredByHeight(panelHeight, referenceHeight) {
    if (referenceHeight <= 2000) {
        return panelHeight <= 1800;
    }
    return panelHeight === 2000;
}

export function getPanelAreaM2(panel) {
    if (!panel) return 0;
    const areaMultiplier = panel.typ === 'B2B' ? 2 : 1;
    return (panel.L * panel.H * areaMultiplier) / 1_000_000;
}

function parseReceiverVolume(value) {
    if (!value) return 0;
    const normalized = value.replace(/\s+/g, '').toLowerCase();
    const numbers = normalized.match(/\d+/g)?.map(Number) ?? [];
    if (numbers.length === 0) return 0;

    if (normalized.includes('+')) {
        return numbers.reduce((sum, num) => sum + num, 0);
    }

    const multiplyMatch = normalized.match(/(\d+)\s*x\s*(\d+)/i);
    if (multiplyMatch) {
        const qty = parseInt(multiplyMatch[1], 10);
        const each = parseInt(multiplyMatch[2], 10);
        return qty * each;
    }

    if (normalized.includes('/')) {
        return Math.max(...numbers);
    }

    return numbers[0];
}

export function getLiquidReceiverVolume(tankType, singleValue, coupledValue) {
    if (tankType === 'coupled') {
        return parseReceiverVolume(coupledValue);
    }
    return parseReceiverVolume(singleValue);
}

export function getPanelAreaLimitByReceiverVolume(receiverVolume) {
    if (!receiverVolume) return null;
    if (receiverVolume <= 300) return 3;
    if (receiverVolume <= 700) return 5;
    return null;
}

export function isPanelRecommendedByReceiverVolume(panel, receiverVolume) {
    const limit = getPanelAreaLimitByReceiverVolume(receiverVolume);
    if (!limit) return true;
    return getPanelAreaM2(panel) <= limit;
}
