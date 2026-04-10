// main.js
import dataQuadri from './electricalPanelData.js';
import {
    getPanelAreaM2,
    getLiquidReceiverVolume,
    isPanelRecommendedByReceiverVolume,
    getPanelAreaLimitByReceiverVolume
} from './electricalPanelRules.js';

// Wait for the DOM to be fully loaded before running the script
document.addEventListener('DOMContentLoaded', () => {

    /**
     * Debounce function to limit the rate at which a function gets called.
     * This is used to prevent the resize event from firing the visualization update too frequently.
     * @param {Function} func The function to debounce.
     * @param {number} wait The delay in milliseconds.
     * @returns {Function} The debounced function.
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    let currentMachineWidth = 1200; // Global variable for machine width
    let machineHeight = 0; // Global variable for machine height
    let tanksSectionWidth = 1200; // Global variable for tanks section width
    let isManualOverrideActive = false; // Flag to track if override is active
    const manualOverrides = {
        tanks: { width: null, height: null },
        compressors: { width: null, height: null },
        head: { length: null, width: null, height: null },
        b2b: { length: null, width: null, height: null }
    };

    function getOverrideValue(value) {
        return Number.isFinite(value) && value > 0 ? value : null;
    }

    // --- GENERAL CONFIG ---
    const configurationRadios = document.querySelectorAll('input[name="configuration"]');
    const sumConfigRadios = document.querySelectorAll('input[name="sum-config"]');
    const sumConfigCard = document.querySelector('input[name="sum-config"]').closest('.card');
    const claddingRadios = document.querySelectorAll('input[name="cladding"]');
    const connectionsRadios = document.querySelectorAll('input[name="connections"]');

    // --- MODAL (Config Options) ---
    const showConfigOptionsBtn = document.getElementById('show-config-options-btn');
    const closeConfigOptionsBtn = document.getElementById('close-config-options-btn');
    const configOptionsModal = document.getElementById('config-options-modal');

    // --- TANKS SECTION ---
    const tankTypeRadios = document.querySelectorAll('input[name="tank-type"]');
    const singleTankGroup = document.getElementById('single-tank-group');
    const coupledTanksGroup = document.getElementById('coupled-tanks-group');
    const liquidReceiverSelect = document.getElementById('liquid-receiver-volume');
    const coupledLiquidReceiverSelect = document.getElementById('coupled-liquid-receiver-volume');
    const mtSuctionAccumulatorSelect = document.getElementById('mt-suction-accumulator-volume');
    const secondaryLineAccumulatorSelect = document.getElementById('secondary-line-accumulator');
    const airConditioningSelect = document.getElementById('air-conditioning');
    const tanksLengthOutput = document.getElementById('tanks-length');
    const tanksWidthOutput = document.getElementById('tanks-width');
    const machineHeightOutput = document.getElementById('machine-height');
    const tanksCard = document.getElementById('card-tanks');
    const compressorsCard = document.getElementById('card-compressors');
    const panelsCard = document.getElementById('card-panels');

    function getGeneralConfig() {
        const configuration = document.querySelector('input[name="configuration"]:checked').value;
        const connections = document.querySelector('input[name="connections"]:checked').value;
        return { configuration, connections };
    }

    function updateSumConfigState() {
        const receiverSelected = (liquidReceiverSelect.value !== '') || 
                               (coupledLiquidReceiverSelect.value !== '');
        const mtAccumulatorSelected = mtSuctionAccumulatorSelect.value !== '';
        const tanksDefined = receiverSelected && mtAccumulatorSelected;

        const compressorsDefined = (parseInt(numMtSelect.value) > 0) || (parseInt(numAuxSelect.value) > 0) || (parseInt(numLtSelect.value) > 0) || (oilSeparatorSelect.value !== '') || (parseInt(heatRecoveriesSelect.value) > 0);

        const panelDefined = b2bPanelModelSelect.value !== '' || headPanelModelSelect.value !== '';

        const hasCladding = document.querySelector('input[name="cladding"]:checked').value !== 'no';

        const isEnabled = tanksDefined && compressorsDefined && panelDefined && !hasCladding;

        // Disable all radio buttons in the group if conditions are not met
        sumConfigRadios.forEach(radio => {
            radio.disabled = !isEnabled;
        });

        if (sumConfigCard) {
            sumConfigCard.style.opacity = isEnabled ? '1' : '0.6';
            let title = '';
            if (!tanksDefined || !compressorsDefined || !panelDefined) {
                title = 'Please define Tanks, Compressors, and Electrical Panel sections first.';
            } else if (hasCladding) {
                title = 'Sum configuration is disabled when cladding is active.';
            }
            sumConfigCard.title = title;
        }

        // If the section becomes disabled, reset the selection to "None"
        // and update the visualization to remove any summed dimension lines.
        if (!isEnabled) {
            const noneRadio = document.querySelector('input[name="sum-config"][value="none"]');
            if (noneRadio && !noneRadio.checked) {
                noneRadio.checked = true;
                // A change event will be fired by the browser, which in turn calls updateVisualization()
            }
        }
    }

    // Function to calculate and update the tanks section length
    function calculateTanksLength() {
        const tankType = document.querySelector('input[name="tank-type"]:checked').value;
        const claddingValue = document.querySelector('input[name="cladding"]:checked').value;
        let baseLength = 0;
        let baseHeight = 0;
 
        // Reset height at the start of calculation
        machineHeight = 0;

        if (tankType === 'single') {
            const selectedVolume = liquidReceiverSelect.value;
            // Set tanks section width based on selection
            if (selectedVolume === '150L/185L' || selectedVolume === '300L' || selectedVolume === '350L') {
                tanksSectionWidth = 1000;
            } else if (selectedVolume === '460L') {
                tanksSectionWidth = 1100;
            } else {
                tanksSectionWidth = 1200;
            }
            // Base length based on liquid receiver volume
            const tankBaseLengths = {
                "150L/185L": 600,
                "300L": 800,
                "350L": 800,
                "460L": 800,
                "700L": 1000,
                "1000L": 1100
            };
            baseLength = tankBaseLengths[selectedVolume] || 0;

            const singleTankHeights = {
                "150L/185L": 2000,
                "300L": 2000,
                "350L": 2300,
                "460L": 2000,
                "700L": 2000,
                "1000L": 2500
            };
            baseHeight = singleTankHeights[selectedVolume] || 0;
        } else { // 'coupled'
            tanksSectionWidth = 1200;
            const selectedCoupledVolume = coupledLiquidReceiverSelect.value;
            const coupledTankBaseLengths = {
                "350+310L": 1400,
                "350+350L": 1550,
                "570+350L": 1550,
                "570+570L": 1600,
                "2x430L": 2000,
                "2x1000L": 2000
            };
            baseLength = coupledTankBaseLengths[selectedCoupledVolume] || 0;

            const coupledTankHeights = {
                "350+310L": 2300,
                "350+350L": 2300,
                "570+350L": 2500,
                "570+570L": 2500
            };
            baseHeight = coupledTankHeights[selectedCoupledVolume] || 0;
        }

        // Apply cladding logic to height
        if (claddingValue === 'yes' || claddingValue === 'yes_walk_in') {
            // If cladding is present, add 300mm to baseHeight, but cap at 2500mm.
            // If baseHeight is 0 (no tank selected), it becomes 300mm (or 2500mm if that's the cap).
            machineHeight = Math.min(baseHeight + 300, 2500);
        } else {
            // No cladding, so machineHeight is just the baseHeight from the tank.
            machineHeight = baseHeight;
        }

        // Get value from MT Suction Accumulator
        const mtAccumulatorVolume = mtSuctionAccumulatorSelect.value;
        const mtAccumulatorLengths = {
            "122L": 900,
            "200L": 900,
            "275L": 1100
        };
        const mtAccumulatorLength = mtAccumulatorLengths[mtAccumulatorVolume] || 0;

        // Get value from Secondary Line Accumulator
        const hasSecondaryAccumulator = secondaryLineAccumulatorSelect.value === 'yes';
        const secondaryAccumulatorLength = hasSecondaryAccumulator ? 500 : 0;

        // Get the value from the Air Conditioning dropdown
        const hasAirConditioning = airConditioningSelect.value === 'yes';
        // Get the value from the Liquid Subcooler dropdown
        const { configuration, connections } = getGeneralConfig();

        // Add 1000mm if Air Conditioning is selected
        let finalLength = baseLength;
        finalLength += mtAccumulatorLength;
        finalLength += secondaryAccumulatorLength;

        if (hasAirConditioning) {
            finalLength += 800;
        }

        // Add 100mm if configuration is "Two Parts"
        if (configuration === 'two_parts') {
            finalLength += 100;
        }

        // Add 100mm for K65 in two parts mode
        if (connections === 'k65' && configuration === 'two_parts') {
            finalLength += 100;
        }

        // Update the output display
        tanksLengthOutput.textContent = `${finalLength} mm`;
        tanksWidthOutput.textContent = finalLength > 0 ? `${tanksSectionWidth} mm` : '0 mm';
        machineHeightOutput.textContent = `${machineHeight} mm`;
        updatePanelPreferenceHints();
        updateVisualization();
        updateSumConfigState();
    }

    function handleTankTypeChange() {
        const selectedType = document.querySelector('input[name="tank-type"]:checked').value;

        if (selectedType === 'single') {
            singleTankGroup.classList.remove('hidden');
            coupledTanksGroup.classList.add('hidden');
            // Reset coupled tank selection to avoid using its value in calculations
            coupledLiquidReceiverSelect.value = '';
        } else { // 'coupled'
            singleTankGroup.classList.add('hidden');
            coupledTanksGroup.classList.remove('hidden');
            // Reset single tank selection to avoid using its value in calculations
            liquidReceiverSelect.value = '';
        }

        // Recalculate length after switching
        calculateTanksLength();
    }

    // Add event listeners for the tanks section
    tankTypeRadios.forEach(radio => radio.addEventListener('change', handleTankTypeChange));
    liquidReceiverSelect.addEventListener('change', calculateTanksLength);
    coupledLiquidReceiverSelect.addEventListener('change', calculateTanksLength);
    mtSuctionAccumulatorSelect.addEventListener('change', calculateTanksLength);
    secondaryLineAccumulatorSelect.addEventListener('change', calculateTanksLength);
    airConditioningSelect.addEventListener('change', calculateTanksLength);

    // --- COMPRESSORS SECTION ---
    // New compressor elements
    const numMtSelect = document.getElementById('num-mt');
    const typeMtGroup = document.getElementById('type-mt-group');
    const numAuxSelect = document.getElementById('num-aux');
    const typeAuxGroup = document.getElementById('type-aux-group');
    const numLtSelect = document.getElementById('num-lt');
    const typeLtGroup = document.getElementById('type-lt-group');

    const oilSeparatorSelect = document.getElementById('oil-separator');
    const magicCompileOilSeparatorBtn = document.getElementById('magic-compile-oil-separator-btn');
    const heatRecoveriesSelect = document.getElementById('heat-recoveries');
    const lowerDeckLengthOutput = document.getElementById('lower-deck-length');
    const upperDeckLengthOutput = document.getElementById('upper-deck-length');
    const compressorsLengthOutput = document.getElementById('compressors-length');
    const compressorsWidthOutput = document.getElementById('compressors-width');

    // --- VISUALIZATION CONTAINERS ---
    const singleVisualizationContainer = document.getElementById('single-visualization-container');
    const multiVisualizationContainer = document.getElementById('multi-visualization-container');

    // --- SINGLE VISUALIZATION ELEMENTS ---
    const visualizationWrapper = document.getElementById('visualization-wrapper');
    const partsContainer = document.getElementById('parts-container');
    const sideViewWrapper = document.getElementById('side-view-wrapper');
    const sideViewContainer = document.getElementById('side-view-container');
    const dimensionsContainer = document.getElementById('dimensions-container');
    const overallDimensionsDisplay = document.getElementById('overall-dimensions-display');
    const overallLengthOutput = document.getElementById('overall-length-output');
    const overallWidthOutput = document.getElementById('overall-width-output');
    const overallHeightOutput = document.getElementById('overall-height-output');

    // --- DUAL VISUALIZATION ELEMENTS (B2B) ---
    const visualizationWrapperB2B = document.getElementById('visualization-wrapper-b2b');
    const partsContainerB2B = document.getElementById('parts-container-b2b');
    const sideViewWrapperB2B = document.getElementById('side-view-wrapper-b2b');
    const sideViewContainerB2B = document.getElementById('side-view-container-b2b');
    const dimensionsContainerB2B = document.getElementById('dimensions-container-b2b');
    const overallDimensionsDisplayB2B = document.getElementById('overall-dimensions-display-b2b');
    const overallLengthOutputB2B = document.getElementById('overall-length-output-b2b');
    const overallWidthOutputB2B = document.getElementById('overall-width-output-b2b');
    const overallHeightOutputB2B = document.getElementById('overall-height-output-b2b');
    const overallLengthLabelB2B = document.getElementById('overall-length-label-b2b');
    const overallWidthLabelB2B = document.getElementById('overall-width-label-b2b');
    const overallHeightLabelB2B = document.getElementById('overall-height-label-b2b');

    // --- DUAL VISUALIZATION ELEMENTS (HEAD) ---
    const visualizationWrapperHeadAligned = document.getElementById('visualization-wrapper-head-aligned');
    const partsContainerHeadAligned = document.getElementById('parts-container-head-aligned');
    const sideViewWrapperHeadAligned = document.getElementById('side-view-wrapper-head-aligned');
    const sideViewContainerHeadAligned = document.getElementById('side-view-container-head-aligned');
    const dimensionsContainerHeadAligned = document.getElementById('dimensions-container-head-aligned');
    const overallDimensionsDisplayHeadAligned = document.getElementById('overall-dimensions-display-head-aligned');
    const overallLengthOutputHeadAligned = document.getElementById('overall-length-output-head-aligned');
    const overallWidthOutputHeadAligned = document.getElementById('overall-width-output-head-aligned');
    const overallHeightOutputHeadAligned = document.getElementById('overall-height-output-head-aligned');
    const overallLengthLabelHeadAligned = document.getElementById('overall-length-label-head-aligned');
    const overallWidthLabelHeadAligned = document.getElementById('overall-width-label-head-aligned');
    const overallHeightLabelHeadAligned = document.getElementById('overall-height-label-head-aligned');

    // --- NEW VISUALIZATION ELEMENTS (HEAD - PERP) ---
    const visualizationWrapperHeadPerp = document.getElementById('visualization-wrapper-head-perp');
    const partsContainerHeadPerp = document.getElementById('parts-container-head-perp');
    const sideViewWrapperHeadPerp = document.getElementById('side-view-wrapper-head-perp');
    const sideViewContainerHeadPerp = document.getElementById('side-view-container-head-perp');
    const dimensionsContainerHeadPerp = document.getElementById('dimensions-container-head-perp');
    const overallDimensionsDisplayHeadPerp = document.getElementById('overall-dimensions-display-head-perp');
    const overallLengthOutputHeadPerp = document.getElementById('overall-length-output-head-perp');
    const overallWidthOutputHeadPerp = document.getElementById('overall-width-output-head-perp');
    const overallHeightOutputHeadPerp = document.getElementById('overall-height-output-head-perp');
    const overallLengthLabelHeadPerp = document.getElementById('overall-length-label-head-perp');
    const overallWidthLabelHeadPerp = document.getElementById('overall-width-label-head-perp');
    const overallHeightLabelHeadPerp = document.getElementById('overall-height-label-head-perp');
    
    function handleCompressorNumberChange(numSelect, typeGroup) {
        const num = parseInt(numSelect.value);
        typeGroup.classList.toggle('hidden', num === 0);
        calculateCompressorsLength();
    }

    // Function to calculate and update the compressors section length
    function calculateCompressorsLength() {
        // Get values from the new selectors
        const numMt = parseInt(numMtSelect.value) || 0;
        const typeMt = numMt > 0 ? document.querySelector('input[name="type-mt"]:checked').value : '4cyl';
        const numAux = parseInt(numAuxSelect.value) || 0;
        const typeAux = numAux > 0 ? document.querySelector('input[name="type-aux"]:checked').value : '4cyl';
        const numLt = parseInt(numLtSelect.value) || 0;
        const typeLt = numLt > 0 ? document.querySelector('input[name="type-lt"]:checked').value : '4cyl';

        // --- LOGIC FOR COMPRESSOR SECTION WIDTH ---
        // This logic runs unless a manual override is active.
        if (!isManualOverrideActive) {
            const has6Cyl = (numMt > 0 && typeMt === '6cyl') ||
                            (numAux > 0 && typeAux === '6cyl') ||
                            (numLt > 0 && typeLt === '6cyl');

            if (has6Cyl) {
                currentMachineWidth = 1200; // Presence of any 6-cyl compressor
            } else if (numLt > 0) { // No 6-cyl, LT compressors determine the width
                if (typeLt === '2cyl') {
                    currentMachineWidth = 1000;
                } else if (typeLt === '4cyl') {
                    currentMachineWidth = 1100;
                }
            } else { // No 6-cyl and no LT compressors, use default width
                currentMachineWidth = 1000;
            }
        }

        const numHeatRecoveries = parseInt(heatRecoveriesSelect.value) || 0;

        // Helper to get length per compressor based on cylinder type
        const getCompressorLength = (type) => (type === '6cyl' ? 700 : 500);

        // --- Lower Deck Calculation ---
        let lowerDeckLength = 0;

        // MT compressors go to lower deck
        if (numMt > 0) {
            lowerDeckLength += numMt * getCompressorLength(typeMt);
        }

        // Aux compressors go to lower deck
        if (numAux > 0) {
            lowerDeckLength += numAux * getCompressorLength(typeAux);
        }

        // LT 6-cylinder compressors go to lower deck
        if (numLt > 0 && typeLt === '6cyl') {
            lowerDeckLength += numLt * getCompressorLength(typeLt);
        }

        // Add length from oil separator
        let oilSeparatorLength = 0;
        const selectedOilSeparator = oilSeparatorSelect.value;
        const oilSeparatorLengths = {
            "BOS4-CDH-1AFO": 400,
            "BOS4-CDH-1BFO": 600,
            "BOS4-CDH-1NFO": 600,
            "BOS4-CDH-1CFO": 1000,
            "BOS4-CDH-1DFO": 1000,
            "2x-BOS4-CDH-1DFO": 2000
        };

        if (selectedOilSeparator in oilSeparatorLengths) {
            oilSeparatorLength = oilSeparatorLengths[selectedOilSeparator];
        }
        lowerDeckLength += oilSeparatorLength;

        // --- Upper Deck Calculation ---
        let upperDeckLength = 0;

        // LT 2- or 4-cylinder compressors go to upper deck
        if (numLt > 0 && (typeLt === '2cyl' || typeLt === '4cyl')) {
            upperDeckLength += numLt * getCompressorLength(typeLt);
        }

        // Add length from heat recoveries
        const heatRecoveriesLength = numHeatRecoveries * 500;
        upperDeckLength += heatRecoveriesLength;

        // Add fixed length for oil reserve
        const oilReserveLength = 600;
        upperDeckLength += oilReserveLength;

        // Also add oil separator length to the upper deck
        upperDeckLength += oilSeparatorLength;

        // Update the output displays
        lowerDeckLengthOutput.textContent = `${lowerDeckLength} mm`;
        upperDeckLengthOutput.textContent = `${upperDeckLength} mm`;

        // --- Final Length Calculation ---
        let finalLength = Math.max(lowerDeckLength, upperDeckLength);

        const { configuration, connections } = getGeneralConfig();

        // Add 100mm for K65 in two parts mode
        if (connections === 'k65' && configuration === 'two_parts') {
            finalLength += 100;
        }

        compressorsLengthOutput.textContent = `${finalLength} mm`;
        compressorsWidthOutput.textContent = finalLength > 0 ? `${currentMachineWidth} mm` : '0 mm';
        updateVisualization();
        updateSumConfigState();
    }

    // Add event listeners for the compressors section
    numMtSelect.addEventListener('change', () => handleCompressorNumberChange(numMtSelect, typeMtGroup));
    document.querySelectorAll('input[name="type-mt"]').forEach(radio => radio.addEventListener('change', calculateCompressorsLength));
    numAuxSelect.addEventListener('change', () => handleCompressorNumberChange(numAuxSelect, typeAuxGroup));
    document.querySelectorAll('input[name="type-aux"]').forEach(radio => radio.addEventListener('change', calculateCompressorsLength));
    numLtSelect.addEventListener('change', () => handleCompressorNumberChange(numLtSelect, typeLtGroup));
    document.querySelectorAll('input[name="type-lt"]').forEach(radio => radio.addEventListener('change', calculateCompressorsLength));
    oilSeparatorSelect.addEventListener('change', calculateCompressorsLength);
    heatRecoveriesSelect.addEventListener('change', calculateCompressorsLength);

    function applyMagicCompileOilSeparator() {
        const numMt = parseInt(numMtSelect.value) || 0;
        const numAux = parseInt(numAuxSelect.value) || 0;
        const totalMtAux = numMt + numAux;

        let suggestedModel = "BOS4-CDH-1BFO";

        // Assumption: the "<4" threshold includes 4 to avoid an undefined gap.
        if (totalMtAux >= 14) {
            suggestedModel = "2x-BOS4-CDH-1DFO";
        } else if (totalMtAux >= 7) {
            suggestedModel = "BOS4-CDH-1DFO";
        } else if (totalMtAux >= 5) {
            suggestedModel = "BOS4-CDH-1CFO";
        } else {
            suggestedModel = "BOS4-CDH-1BFO";
        }

        oilSeparatorSelect.value = suggestedModel;
        calculateCompressorsLength();
        updateSumConfigState();
    }

    if (magicCompileOilSeparatorBtn) {
        magicCompileOilSeparatorBtn.addEventListener('click', applyMagicCompileOilSeparator);
    }

    // --- ELECTRICAL PANEL SECTION ---
    const b2bPanelGroup = document.getElementById('b2b-panel-group');
    const headPanelGroup = document.getElementById('head-panel-group');
    const b2bPanelModelSelect = document.getElementById('b2b-panel-model');
    const headPanelModelSelect = document.getElementById('head-panel-model');
    const b2bPanelCards = document.getElementById('b2b-panel-cards');
    const headPanelCards = document.getElementById('head-panel-cards');
    const orientationGroup = document.getElementById('orientation-group');
    const orientationSelect = document.getElementById('electrical-panel-orientation');
    const magicFillPanelsBtn = document.getElementById('magic-fill-panels-btn');

    function updatePanelPreferenceHints() {
        const refreshSelectState = (selectElement) => {
            selectElement.classList.remove('non-preferred-selection');
        };

        refreshSelectState(b2bPanelModelSelect);
        refreshSelectState(headPanelModelSelect);

        const refreshCardsState = (cardsContainer, selectedValue) => {
            if (!cardsContainer) return;
            const cardButtons = cardsContainer.querySelectorAll('.panel-card');
            cardButtons.forEach((card) => {
                const isSelected = card.dataset.optionValue === selectedValue;
                card.classList.toggle('selected', isSelected);
            });
        };

        refreshCardsState(b2bPanelCards, b2bPanelModelSelect.value);
        refreshCardsState(headPanelCards, headPanelModelSelect.value);
    }

    function getPanelDimensions(panelType, orientationOverride = null) {
        const isB2B = panelType === 'b2b';
        const selectedIndex = isB2B ? b2bPanelModelSelect.value : headPanelModelSelect.value;
        const orientation = orientationOverride || orientationSelect.value;

        if (selectedIndex === "") {
            return { length: 0, width: 0 };
        }

        const panelData = dataQuadri[selectedIndex];
        if (!panelData) return { length: 0, width: 0 };
        const panelOverrides = isB2B ? manualOverrides.b2b : manualOverrides.head;
        const overrideWidth = getOverrideValue(panelOverrides.width);
        const overrideLength = getOverrideValue(panelOverrides.length);
        const panelWidth = overrideWidth ?? panelData.W;
        const panelLength = overrideLength ?? panelData.L;

        // The orientation option is only available for 'T' type panels (which are 'head' panels)
        if (!isB2B && panelData.typ === 'T' && orientation === 'perpendicular') {
            // Rotated
            return { length: panelWidth, width: panelLength };
        } else {
            // Aligned or B2B
            return { length: panelLength, width: panelWidth };
        }
    }

    function getPanelHeight(panelType) {
        const isB2B = panelType === 'b2b';
        const selectedIndex = isB2B ? b2bPanelModelSelect.value : headPanelModelSelect.value;
        const overrideHeight = getOverrideValue(isB2B ? manualOverrides.b2b.height : manualOverrides.head.height);
        if (overrideHeight) return overrideHeight;
        if (selectedIndex === "") return 0;
        const panelData = dataQuadri[selectedIndex];
        return panelData ? panelData.H : 0;
    }

    function calculatePanelLengths() {
        updateVisualization();
        updateSumConfigState();
    }

    // --- VISUALIZATION ---
    function drawMachineVisualization(elements, panelType, orientationOverride = null) {
        const {
            wrapper, partsContainer, sideWrapper, sidePartsContainer, dimensionsContainer,
            overallDimensionsDisplay, overallLengthOutput, overallWidthOutput, overallHeightOutput,
            overallLengthLabel, overallWidthLabel, overallHeightLabel
        } = elements;

        const tanksLength = parseInt(tanksLengthOutput.textContent) || 0;
        const compressorsLength = parseInt(compressorsLengthOutput.textContent) || 0;
        const { length: electricalPanelLength, width: electricalPanelWidth } = getPanelDimensions(panelType, orientationOverride);

        // --- Cladding Logic ---
        const claddingValue = document.querySelector('input[name="cladding"]:checked').value;
        const hasCladding = claddingValue !== 'no';
        const isWalkIn = claddingValue === 'yes_walk_in';
        const claddingThickness = 50; // mm
    
        const finalSharedWidth = Math.max(tanksSectionWidth, currentMachineWidth);
        const totalLength = tanksLength + compressorsLength + electricalPanelLength;
    
        // --- Special Alignment Logic Check ---
        const currentOrientation = orientationOverride || orientationSelect.value;
        const isHeadPanelAligned = panelType === 'head' && currentOrientation === 'aligned';
        const alignPanelTop = isHeadPanelAligned;
    
        partsContainer.innerHTML = '';
        if (sidePartsContainer) sidePartsContainer.innerHTML = '';
        dimensionsContainer.innerHTML = '';
    
        wrapper.style.padding = '0';
        wrapper.style.backgroundColor = '';
        wrapper.style.border = '';
        if (sideWrapper) {
            sideWrapper.style.padding = '0';
            sideWrapper.style.backgroundColor = '';
            sideWrapper.style.border = '';
            sideWrapper.style.height = '';
        }
        overallDimensionsDisplay.classList.add('hidden');
    
        if (totalLength === 0) {
            wrapper.style.height = '';
            return;
        }
    
        // clientWidth excludes borders and avoids tiny overflow with styled wrappers.
        const canvasWidth = wrapper.clientWidth;
    
        const configuration = document.querySelector('input[name="configuration"]:checked').value;
        const sumConfig = document.querySelector('input[name="sum-config"]:checked').value;
        const gapSize = 20;
    
        const hasManualSectionWidth = getOverrideValue(manualOverrides.tanks.width) !== null ||
            getOverrideValue(manualOverrides.compressors.width) !== null;
        const tanksWidth = hasManualSectionWidth
            ? (getOverrideValue(manualOverrides.tanks.width) ?? tanksSectionWidth)
            : finalSharedWidth;
        const compressorsWidth = hasManualSectionWidth
            ? (getOverrideValue(manualOverrides.compressors.width) ?? currentMachineWidth)
            : finalSharedWidth;

        const parts = [];
        if (tanksLength > 0) parts.push({ name: 'Tanks', length: tanksLength, color: 'blue-bg', width: tanksWidth });
        if (compressorsLength > 0) parts.push({ name: 'Compressors', length: compressorsLength, color: 'purple-bg', width: compressorsWidth });
        if (electricalPanelLength > 0) parts.push({ name: 'Electrical Panel', length: electricalPanelLength, color: 'orange-bg', width: electricalPanelWidth });
    
        let totalGapWidth = 0;
        const gaps = [];
        if (parts.length > 1) {
            for (let i = 1; i < parts.length; i++) {
                const prevPart = parts[i - 1];
                const currentPart = parts[i];
                // Gaps are only for 'two_parts' config, which is disabled with cladding.
                // This check ensures no gaps appear if cladding is active.
                let needsGap = (configuration === 'two_parts' && !hasCladding);
                if (needsGap) {
                    if (sumConfig === 'tanks_compressors' && prevPart.name === 'Tanks' && currentPart.name === 'Compressors') needsGap = false;
                    else if (sumConfig === 'compressors_panel' && prevPart.name === 'Compressors' && currentPart.name === 'Electrical Panel') needsGap = false;
                    else if (sumConfig === 'all') needsGap = false;
                }
                gaps[i] = needsGap;
                if (needsGap) totalGapWidth += gapSize;
            }
        }
    
        const availableWidthForParts = canvasWidth - totalGapWidth;

        let extraRightPadding = 0;
        if (claddingValue === 'no' && panelType === 'head' && currentOrientation === 'perpendicular') {
            extraRightPadding = 0; // Add virtual space for the label
        }

        const walkInSpace = isWalkIn ? 1000 : 0;
        const maxWidth = Math.max(...parts.map(p => p.width));

        const effectiveTotalLength = totalLength + (hasCladding ? claddingThickness * 2 : 0) + extraRightPadding;
        const effectiveMaxWidth = maxWidth + (hasCladding ? claddingThickness * 2 : 0) + walkInSpace;
    
        const scale = availableWidthForParts > 0 ? availableWidthForParts / effectiveTotalLength : 0;
    
        const machinePixelHeight = maxWidth * scale;
        const borderPx = hasCladding ? claddingThickness * scale : 0;
        const walkInPixelHeight = walkInSpace * scale;

        // Keep wrapper height aligned with actual rendered borders to avoid vertical overflow/scrollbars.
        const baseBorderPx = hasCladding ? borderPx : 1;
        const wrapperHeight = machinePixelHeight + (baseBorderPx * 2) + walkInPixelHeight;
        wrapper.style.height = `${wrapperHeight}px`;
        partsContainer.style.height = `${machinePixelHeight}px`;
        partsContainer.style.width = `${totalLength * scale + totalGapWidth}px`;
    
        if (hasCladding) {
            wrapper.style.border = `${borderPx}px solid var(--line-strong)`;
        }
    
        const createDrawingPart = (name, length, colorClass, widthOverride) => {
            const partWidth = length * scale;
            const part = document.createElement('div');
            part.className = `drawing-part ${colorClass}`;
            part.style.width = `${partWidth}px`;
            part.style.height = `${(widthOverride / maxWidth) * 100}%`;
            part.appendChild(document.createTextNode(name));
            const dimDiv = document.createElement('div');
            dimDiv.className = 'part-dimensions';
            dimDiv.innerHTML = `L: ${length} mm <br> W: ${widthOverride} mm`;
            part.appendChild(dimDiv);
            return part;
        };
    
        parts.forEach((part, i) => {
            const partDiv = createDrawingPart(part.name, part.length, part.color, part.width);

            if (part.name === 'Electrical Panel') {
                const createOpeningLabel = (positionClass) => {
                    const label = document.createElement('span');
                    label.className = `opening-label ${positionClass}`;
                    label.textContent = 'opening';
                    return label;
                };

                if (panelType === 'b2b') {
                    partDiv.appendChild(createOpeningLabel('top'));
                    partDiv.appendChild(createOpeningLabel('bottom'));
                } else { // panelType === 'head'
                    const orientation = orientationOverride || orientationSelect.value;
                    if (orientation === 'aligned') {
                        partDiv.appendChild(createOpeningLabel('bottom'));
                    } else { // perpendicular
                        partDiv.appendChild(createOpeningLabel('right'));
                    }
                }
            }

            if (part.name === 'Electrical Panel' && alignPanelTop) {
                partDiv.style.alignSelf = 'flex-start';
            }
            if (gaps[i]) {
                partDiv.style.marginLeft = `${gapSize}px`;
            }

            partsContainer.appendChild(partDiv);
        });

        if (sideWrapper && sidePartsContainer) {
            const tanksHeight = getOverrideValue(manualOverrides.tanks.height) ?? machineHeight;
            const compressorsHeight = getOverrideValue(manualOverrides.compressors.height) ?? machineHeight;
            const panelHeight = getPanelHeight(panelType) + 150;

            const sideParts = [];
            if (tanksLength > 0) sideParts.push({ name: 'Tanks', length: tanksLength, height: tanksHeight, color: 'blue-bg' });
            if (compressorsLength > 0) sideParts.push({ name: 'Compressors', length: compressorsLength, height: compressorsHeight, color: 'purple-bg' });
            if (electricalPanelLength > 0) sideParts.push({ name: 'Electrical Panel', length: electricalPanelLength, height: panelHeight, color: 'orange-bg' });

            const maxHeight = Math.max(...sideParts.map(p => p.height));
            if (maxHeight > 0) {
                const sideBorderPx = hasCladding ? claddingThickness * scale : 0;
                const sideBaseBorderPx = hasCladding ? sideBorderPx : 1;
                const sideWrapperHeight = (maxHeight * scale) + (sideBaseBorderPx * 2);

                sideWrapper.style.height = `${sideWrapperHeight}px`;
                sidePartsContainer.style.height = `${maxHeight * scale}px`;
                sidePartsContainer.style.width = `${totalLength * scale + totalGapWidth}px`;

                if (hasCladding) {
                    sideWrapper.style.border = `${sideBorderPx}px solid var(--line-strong)`;
                }

                sideParts.forEach((part, i) => {
                    const partWidth = part.length * scale;
                    const partDiv = document.createElement('div');
                    partDiv.className = `side-part ${part.color}`;
                    partDiv.style.width = `${partWidth}px`;
                    partDiv.style.height = `${(part.height / maxHeight) * 100}%`;
                    const heightDiv = document.createElement('div');
                    heightDiv.className = 'side-dimensions';
                    heightDiv.textContent = `H: ${part.height} mm`;
                    partDiv.appendChild(heightDiv);
                    if (gaps[i]) {
                        partDiv.style.marginLeft = `${gapSize}px`;
                    }
                    sidePartsContainer.appendChild(partDiv);
                });
            }
        }

        drawSumDimensions(dimensionsContainer, parts, scale, gaps, gapSize);
    
        // Update labels based on cladding. This applies to the multi-visualization containers.
        if (overallLengthLabel && overallWidthLabel && overallHeightLabel) {
            if (hasCladding) {
                overallLengthLabel.textContent = 'Overall Length (with Cladding):';
                overallWidthLabel.textContent = 'Overall Width (with Cladding):';
                overallHeightLabel.textContent = 'Overall Height (with Cladding):';
            } else {
                // Reset to default when cladding is removed
                overallLengthLabel.textContent = 'Overall Length:';
                overallWidthLabel.textContent = 'Overall Width:';
                overallHeightLabel.textContent = 'Overall Height:';
            }
        }

        overallLengthOutput.textContent = `${effectiveTotalLength} mm`;
        overallWidthOutput.textContent = `${effectiveMaxWidth} mm`;
        const heightValues = [
            getOverrideValue(manualOverrides.tanks.height) ?? machineHeight,
            getOverrideValue(manualOverrides.compressors.height) ?? machineHeight,
            getOverrideValue(panelType === 'b2b' ? manualOverrides.b2b.height : manualOverrides.head.height) ?? machineHeight
        ];
        const effectiveHeight = Math.max(...heightValues.filter(v => v > 0));
        overallHeightOutput.textContent = `${effectiveHeight} mm`;
        overallDimensionsDisplay.classList.remove('hidden');
    }

    function hasAllRequiredSelectionsForVisualization() {
        const tankType = document.querySelector('input[name="tank-type"]:checked').value;
        const receiverSelected = tankType === 'single'
            ? liquidReceiverSelect.value !== ''
            : coupledLiquidReceiverSelect.value !== '';
        const mtAccumulatorSelected = mtSuctionAccumulatorSelect.value !== '';
        const oilSeparatorSelected = oilSeparatorSelect.value !== '';
        const panelSelected = b2bPanelModelSelect.value !== '' || headPanelModelSelect.value !== '';

        return receiverSelected && mtAccumulatorSelected && oilSeparatorSelected && panelSelected;
    }

    function renderVisualizationLockedState(elements) {
        const { wrapper, partsContainer, sideWrapper, sidePartsContainer, dimensionsContainer, overallDimensionsDisplay } = elements;
        partsContainer.innerHTML = '<div class="placeholder-text">Complete all required fields to display 2D visualization.</div>';
        if (sidePartsContainer) {
            sidePartsContainer.innerHTML = '<div class="placeholder-text">Complete all required fields to display side view.</div>';
        }
        dimensionsContainer.innerHTML = '';
        wrapper.style.height = '';
        if (sideWrapper) {
            sideWrapper.style.height = '';
            sideWrapper.style.border = '';
        }
        overallDimensionsDisplay.classList.add('hidden');
    }

    function updateVisualization() {
        const claddingValue = document.querySelector('input[name="cladding"]:checked').value;
        const readyForVisualization = hasAllRequiredSelectionsForVisualization();

        const elementsSingle = {
            wrapper: visualizationWrapper,
            partsContainer: partsContainer,
            sideWrapper: sideViewWrapper,
            sidePartsContainer: sideViewContainer,
            dimensionsContainer: dimensionsContainer,
            overallDimensionsDisplay: overallDimensionsDisplay,
            overallLengthOutput: overallLengthOutput,
            overallWidthOutput: overallWidthOutput,
            overallHeightOutput: overallHeightOutput
        };

        const elementsB2B = {
            wrapper: visualizationWrapperB2B,
            partsContainer: partsContainerB2B,
            sideWrapper: sideViewWrapperB2B,
            sidePartsContainer: sideViewContainerB2B,
            dimensionsContainer: dimensionsContainerB2B,
            overallDimensionsDisplay: overallDimensionsDisplayB2B,
            overallLengthOutput: overallLengthOutputB2B,
            overallWidthOutput: overallWidthOutputB2B,
            overallHeightOutput: overallHeightOutputB2B,
            overallLengthLabel: overallLengthLabelB2B,
            overallWidthLabel: overallWidthLabelB2B,
            overallHeightLabel: overallHeightLabelB2B
        };

        const elementsHeadAligned = {
            wrapper: visualizationWrapperHeadAligned,
            partsContainer: partsContainerHeadAligned,
            sideWrapper: sideViewWrapperHeadAligned,
            sidePartsContainer: sideViewContainerHeadAligned,
            dimensionsContainer: dimensionsContainerHeadAligned,
            overallDimensionsDisplay: overallDimensionsDisplayHeadAligned,
            overallLengthOutput: overallLengthOutputHeadAligned,
            overallWidthOutput: overallWidthOutputHeadAligned,
            overallHeightOutput: overallHeightOutputHeadAligned,
            overallLengthLabel: overallLengthLabelHeadAligned,
            overallWidthLabel: overallWidthLabelHeadAligned,
            overallHeightLabel: overallHeightLabelHeadAligned
        };

        const elementsHeadPerp = {
            wrapper: visualizationWrapperHeadPerp,
            partsContainer: partsContainerHeadPerp,
            sideWrapper: sideViewWrapperHeadPerp,
            sidePartsContainer: sideViewContainerHeadPerp,
            dimensionsContainer: dimensionsContainerHeadPerp,
            overallDimensionsDisplay: overallDimensionsDisplayHeadPerp,
            overallLengthOutput: overallLengthOutputHeadPerp,
            overallWidthOutput: overallWidthOutputHeadPerp,
            overallHeightOutput: overallHeightOutputHeadPerp,
            overallLengthLabel: overallLengthLabelHeadPerp,
            overallWidthLabel: overallWidthLabelHeadPerp,
            overallHeightLabel: overallHeightLabelHeadPerp
        };

        if (claddingValue === 'no') {
            // For "No" cladding, show THREE visualizations
            singleVisualizationContainer.classList.add('hidden');
            multiVisualizationContainer.classList.add('compact-view');
            multiVisualizationContainer.classList.remove('hidden');
            // Make sure all 3 are visible
            multiVisualizationContainer.children[0].classList.remove('hidden');
            multiVisualizationContainer.children[1].classList.remove('hidden');
            multiVisualizationContainer.children[2].classList.remove('hidden');

            if (!readyForVisualization) {
                renderVisualizationLockedState(elementsSingle);
                renderVisualizationLockedState(elementsB2B);
                renderVisualizationLockedState(elementsHeadAligned);
                renderVisualizationLockedState(elementsHeadPerp);
                return;
            }

            // Draw B2B version
            drawMachineVisualization(elementsB2B, 'b2b');

            // Draw Head ALIGNED version
            drawMachineVisualization(elementsHeadAligned, 'head', 'aligned');

            // Draw Head PERPENDICULAR version
            drawMachineVisualization(elementsHeadPerp, 'head', 'perpendicular');

        } else {
            // For "Yes" or "Yes + Walk-in", show TWO visualizations
            singleVisualizationContainer.classList.add('hidden');
            multiVisualizationContainer.classList.remove('compact-view');
            multiVisualizationContainer.classList.remove('hidden');
            // Show first two, hide the third
            multiVisualizationContainer.children[0].classList.remove('hidden');
            multiVisualizationContainer.children[1].classList.remove('hidden');
            multiVisualizationContainer.children[2].classList.add('hidden');

            if (!readyForVisualization) {
                renderVisualizationLockedState(elementsSingle);
                renderVisualizationLockedState(elementsB2B);
                renderVisualizationLockedState(elementsHeadAligned);
                return;
            }

            // Draw B2B version
            drawMachineVisualization(elementsB2B, 'b2b');

            // Draw Head version (respecting the disabled 'aligned' state)
            // The target for this is the "head-aligned" container
            drawMachineVisualization(elementsHeadAligned, 'head'); // No override, uses select value which is forced to 'aligned'
        }
    }

    function drawSumDimensions(container, parts, scale, gaps, gapSize) {
        const sumConfig = document.querySelector('input[name="sum-config"]:checked').value;
        if (sumConfig === 'none') return;

        const partMap = new Map(parts.map(p => [p.name, p]));

        const createDimLine = (partNames) => {
            let groupLengthMm = 0;
            let groupWidthPx = 0;
            let startPx = 0;

            // Find the starting position of the group
            for (let i = 0; i < parts.length; i++) {
                if (parts[i].name === partNames[0]) break;
                startPx += parts[i].length * scale;
                if (gaps[i + 1]) startPx += gapSize;
            }

            // Calculate total size of the group
            for (const name of partNames) {
                if (partMap.has(name)) {
                    const part = partMap.get(name);
                    groupLengthMm += part.length;
                    groupWidthPx += part.length * scale;
                }
            }

            if (groupLengthMm > 0) {
                const dimLine = document.createElement('div');
                dimLine.className = 'dimension-line';
                dimLine.style.left = `${startPx}px`;
                dimLine.style.width = `${groupWidthPx}px`;

                const dimText = document.createElement('span');
                dimText.className = 'dimension-text';
                dimText.textContent = `${groupLengthMm} mm`;

                dimLine.appendChild(dimText);
                container.appendChild(dimLine);
            }
        };

        if (sumConfig === 'tanks_compressors') createDimLine(['Tanks', 'Compressors']);
        if (sumConfig === 'compressors_panel') createDimLine(['Compressors', 'Electrical Panel']);
        if (sumConfig === 'all') createDimLine(parts.map(p => p.name));
    }

    function populatePanelSelectors() {
        const prevB2B = b2bPanelModelSelect.value;
        const prevHead = headPanelModelSelect.value;

        b2bPanelModelSelect.innerHTML = '<option value="" selected>Select a B2B panel...</option>';
        headPanelModelSelect.innerHTML = '<option value="" selected>Select a Head panel...</option>';

        dataQuadri.forEach((panel, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `L=${panel.L}, W=${panel.W}, H=${panel.H}`;
            
            if (panel.typ === 'B2B') {
                b2bPanelModelSelect.appendChild(option);
            } else if (panel.typ === 'T') {
                headPanelModelSelect.appendChild(option);
            }
        });

        b2bPanelModelSelect.value = prevB2B;
        headPanelModelSelect.value = prevHead;
        renderPanelCards();
        updatePanelPreferenceHints();

        if (b2bPanelModelSelect.value !== prevB2B || headPanelModelSelect.value !== prevHead) {
            updateVisualization();
        }
    }

    function updatePanelOrientationState() {
        const claddingValue = document.querySelector('input[name="cladding"]:checked').value;

        const selectedIndex = headPanelModelSelect.value;
        const isHeadPanelSelected = selectedIndex !== "";

        // Hide orientation select if no cladding (as all options are shown) or if no head panel is selected
        orientationGroup.classList.toggle('hidden', claddingValue === 'no' || !isHeadPanelSelected);

        if (isHeadPanelSelected) {
            if (claddingValue === 'yes' || claddingValue === 'yes_walk_in') {
                // If 'Yes' or 'Yes + Walk-in' cladding is selected, force 'Aligned' orientation and disable the select.
                orientationSelect.disabled = true;
                orientationSelect.value = 'aligned';
            } else {
                orientationSelect.disabled = false; // Re-enable it, even though it's hidden, for consistency
            }
        }
    }

    function handlePanelChange() {
        updatePanelOrientationState();
        updatePanelPreferenceHints();
        updateVisualization();
        updateSumConfigState();
        updateCompletionHints();
    }

    function renderPanelCards() {
        const buildCards = (selectElement, container, title) => {
            if (!container) return;
            container.innerHTML = '';

            const groupedByHeight = new Map();
            Array.from(selectElement.options).forEach((option) => {
                if (option.value === '') return;
                const panel = dataQuadri[parseInt(option.value, 10)];
                if (!panel) return;
                if (!groupedByHeight.has(panel.H)) {
                    groupedByHeight.set(panel.H, []);
                }
                groupedByHeight.get(panel.H).push({ option, panel });
            });

            Array.from(groupedByHeight.keys())
                .sort((a, b) => a - b)
                .forEach((height) => {
                    const group = document.createElement('div');
                    group.className = 'panel-height-group';

                    const label = document.createElement('div');
                    label.className = 'panel-height-label';
                    label.textContent = `H ${height} mm`;

                    const row = document.createElement('div');
                    row.className = 'panel-height-row';

                    groupedByHeight.get(height).forEach(({ option, panel }) => {
                        const card = document.createElement('button');
                        card.type = 'button';
                        card.className = 'panel-card';
                        if (panel.nonStandard) {
                            card.classList.add('non-standard');
                        }
                        card.dataset.optionValue = option.value;
                        card.dataset.panelHeight = panel.H;
                        const areaM2 = getPanelAreaM2(panel).toFixed(1);
                        const areaPill = `<span class="panel-pill">${areaM2} m<sup>2</sup></span>`;
                        const tagPill = panel.tag ? `<span class="panel-pill panel-pill--tag">${panel.tag}</span>` : '';
                        card.innerHTML = `${tagPill}${areaPill}<span class="panel-title">${title}</span><span class="panel-dims">L=${panel.L}, W=${panel.W}, H=${panel.H}</span>`;

                        card.addEventListener('click', () => {
                            selectElement.value = option.value;
                            handlePanelChange();
                        });

                        row.appendChild(card);
                    });

                    group.appendChild(label);
                    group.appendChild(row);
                    container.appendChild(group);
                });
        };

        buildCards(b2bPanelModelSelect, b2bPanelCards, 'B2B');
        buildCards(headPanelModelSelect, headPanelCards, 'Head');
    }

    function applyMagicFillPanels() {
        const tankType = document.querySelector('input[name="tank-type"]:checked').value;
        const receiverVolume = getLiquidReceiverVolume(
            tankType,
            liquidReceiverSelect.value,
            coupledLiquidReceiverSelect.value
        );
        const areaLimit = getPanelAreaLimitByReceiverVolume(receiverVolume);

        const pickBestOption = (selectElement) => {
            const options = Array.from(selectElement.options)
                .filter((option) => option.value !== '')
                .map((option) => ({
                    option,
                    panel: dataQuadri[parseInt(option.value, 10)]
                }))
                .filter(({ panel }) => panel);

            if (options.length === 0) return;

            const candidates = areaLimit === null
                ? options
                : options.filter(({ panel }) => isPanelRecommendedByReceiverVolume(panel, receiverVolume));

            const pool = candidates.length > 0 ? candidates : options;

            const best = pool.reduce((acc, current) => {
                const area = getPanelAreaM2(current.panel);
                if (!acc || area > acc.area) {
                    return { ...current, area };
                }
                return acc;
            }, null);

            if (best) {
                selectElement.value = best.option.value;
            }
        };

        pickBestOption(b2bPanelModelSelect);

        const b2bSelectedIndex = b2bPanelModelSelect.value !== ''
            ? parseInt(b2bPanelModelSelect.value, 10)
            : null;
        const b2bPanel = b2bSelectedIndex !== null ? dataQuadri[b2bSelectedIndex] : null;
        const headLengthMap = {
            800: 1400,
            1000: 1800,
            1200: 2200,
            1400: 2400
        };

        if (b2bPanel && headLengthMap[b2bPanel.L]) {
            const targetHeadLength = headLengthMap[b2bPanel.L];
            const headOption = Array.from(headPanelModelSelect.options).find((option) => {
                if (option.value === '') return false;
                const panel = dataQuadri[parseInt(option.value, 10)];
                return panel && panel.typ === 'T' && panel.L === targetHeadLength;
            });
            if (headOption) {
                headPanelModelSelect.value = headOption.value;
            }
        } else {
            pickBestOption(headPanelModelSelect);
        }
        handlePanelChange();
    }

    function setFieldRequiredHint(field, isRequired, isMissing) {
        if (!field) return;
        const inputGroup = field.closest('.input-group');
        const shouldHighlight = isRequired && isMissing;

        field.classList.toggle('needs-input', shouldHighlight);
        if (inputGroup) {
            inputGroup.classList.toggle('needs-input', shouldHighlight);
        }
    }

    function updateCompletionHints() {
        const tankType = document.querySelector('input[name="tank-type"]:checked').value;
        const isSingle = tankType === 'single';

        setFieldRequiredHint(liquidReceiverSelect, isSingle, liquidReceiverSelect.value === '');
        setFieldRequiredHint(coupledLiquidReceiverSelect, !isSingle, coupledLiquidReceiverSelect.value === '');
        setFieldRequiredHint(mtSuctionAccumulatorSelect, true, mtSuctionAccumulatorSelect.value === '');
        setFieldRequiredHint(oilSeparatorSelect, true, oilSeparatorSelect.value === '');

        const noPanelSelected = b2bPanelModelSelect.value === '' && headPanelModelSelect.value === '';
        setFieldRequiredHint(b2bPanelModelSelect, true, noPanelSelected);
        setFieldRequiredHint(headPanelModelSelect, true, noPanelSelected);

        const tanksMissing = (isSingle && liquidReceiverSelect.value === '') ||
            (!isSingle && coupledLiquidReceiverSelect.value === '') ||
            mtSuctionAccumulatorSelect.value === '';
        const compressorsMissing = oilSeparatorSelect.value === '';
        const panelsMissing = noPanelSelected;

        if (tanksCard) tanksCard.classList.toggle('needs-input-section', tanksMissing);
        if (compressorsCard) compressorsCard.classList.toggle('needs-input-section', compressorsMissing);
        if (panelsCard) panelsCard.classList.toggle('needs-input-section', panelsMissing);

        if (magicCompileOilSeparatorBtn) {
            magicCompileOilSeparatorBtn.classList.toggle('pulse-attention', compressorsMissing);
        }
        if (magicFillPanelsBtn) {
            magicFillPanelsBtn.classList.toggle('pulse-attention', panelsMissing);
        }
    }

    b2bPanelModelSelect.addEventListener('change', handlePanelChange);
    headPanelModelSelect.addEventListener('change', handlePanelChange);
    orientationSelect.addEventListener('change', handlePanelChange);
    if (magicFillPanelsBtn) {
        magicFillPanelsBtn.addEventListener('click', applyMagicFillPanels);
    }

    function handleConfigurationChange() {
        calculateTanksLength();
        calculateCompressorsLength();
        updateCompletionHints();
    }

    function handleCladdingChange() {
        const claddingValue = document.querySelector('input[name="cladding"]:checked').value;
        const onePartRadio = document.querySelector('input[name="configuration"][value="one_part"]');
        const twoPartsRadio = document.querySelector('input[name="configuration"][value="two_parts"]');
        
        const hasCladding = claddingValue !== 'no';

        if (hasCladding) {
            // If cladding is present, force "One Part" and disable the "Two Parts" option.
            twoPartsRadio.disabled = true;
            showConfigOptionsBtn.disabled = false;
            showConfigOptionsBtn.title = 'With cladding active, configuration is forced to One Part.';
            // If not already one part, switch to it
            if (!onePartRadio.checked) {
                onePartRadio.checked = true;
                // Manually trigger the change event to ensure all related logic runs
                onePartRadio.dispatchEvent(new Event('change', { bubbles: true }));
            }
        } else {
            // If cladding is not present, re-enable the "Two Parts" option.
            twoPartsRadio.disabled = false;
            showConfigOptionsBtn.disabled = false;
            showConfigOptionsBtn.title = '';
            // Default to "Two Parts" if not already selected
            if (!twoPartsRadio.checked) {
                twoPartsRadio.checked = true;
                twoPartsRadio.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }

        // Check if this change affects panel orientation
        updatePanelOrientationState();
        updateSumConfigState();
        calculateTanksLength(); // Recalculates tanks length/height and calls updateVisualization
        updateCompletionHints();
    }

    // --- GENERAL CONFIG LISTENERS ---
    connectionsRadios.forEach(radio => radio.addEventListener('change', () => {
        calculateTanksLength();
        calculateCompressorsLength();
    }));
    claddingRadios.forEach(radio => radio.addEventListener('change', handleCladdingChange));
    configurationRadios.forEach(radio => radio.addEventListener('change', handleConfigurationChange));
    sumConfigRadios.forEach(radio => radio.addEventListener('change', updateVisualization));

    // --- INITIAL CALCULATIONS ON PAGE LOAD ---
    calculateTanksLength();
    calculateCompressorsLength();
    // Set initial visibility for compressor type dropdowns
    handleCompressorNumberChange(numMtSelect, typeMtGroup);
    handleCompressorNumberChange(numAuxSelect, typeAuxGroup);
    handleCompressorNumberChange(numLtSelect, typeLtGroup);
    // ---
    populatePanelSelectors();
    handlePanelChange();
    handleCladdingChange(); // Set initial state for cladding-dependent options
    updateCompletionHints();

    // --- MODAL LOGIC (Config Options) ---
    showConfigOptionsBtn.addEventListener('click', () => {
        configOptionsModal.classList.remove('hidden');
    });

    closeConfigOptionsBtn.addEventListener('click', () => {
        configOptionsModal.classList.add('hidden');
    });

    configOptionsModal.addEventListener('click', (event) => {
        if (event.target === configOptionsModal) {
            configOptionsModal.classList.add('hidden');
        }
    });

    // --- MODAL LOGIC ---
    const showRulesBtn = document.getElementById('show-rules-btn');
    const closeRulesBtn = document.getElementById('close-rules-btn');
    const rulesModal = document.getElementById('rules-modal');

    showRulesBtn.addEventListener('click', () => {
        rulesModal.classList.remove('hidden');
    });

    closeRulesBtn.addEventListener('click', () => {
        rulesModal.classList.add('hidden');
    });

    // Close modal if user clicks on the overlay
    rulesModal.addEventListener('click', (event) => {
        // We check if the clicked element is the overlay itself, not a child element
        if (event.target === rulesModal) {
            rulesModal.classList.add('hidden');
        }
    });

    // Add a global change listener to reset manual overrides when any option is changed.
    const configuratorContainer = document.querySelector('.configurator-container');
    if (configuratorContainer) {
        configuratorContainer.addEventListener('change', (event) => {
            // Ignore changes originating from within the override modal itself
            if (event.target.closest('#override-modal')) {
                return;
            }

            if (isManualOverrideActive) {
                // This is the first change after an override was applied.
                // Reset the flag.
                isManualOverrideActive = false;
                // Reset machine width to its default. Lengths are reset automatically
                // because their calculation functions will run and overwrite the display.
                currentMachineWidth = 1200;
                manualOverrides.tanks.width = null;
                manualOverrides.tanks.height = null;
                manualOverrides.compressors.width = null;
                manualOverrides.compressors.height = null;
                manualOverrides.head.length = null;
                manualOverrides.head.width = null;
                manualOverrides.head.height = null;
                manualOverrides.b2b.length = null;
                manualOverrides.b2b.width = null;
                manualOverrides.b2b.height = null;
                setOverrideIndicator(false);
            }

            updateCompletionHints();
        });
    }

    // --- MODAL LOGIC (Override) ---
    const showOverrideBtn = document.getElementById('show-override-btn');
    const closeOverrideBtn = document.getElementById('close-override-btn');
    const applyOverrideBtn = document.getElementById('apply-override-btn');
    const overrideModal = document.getElementById('override-modal');
    const manualTanksLength = document.getElementById('manual-tanks-length');
    const manualCompressorsLength = document.getElementById('manual-compressors-length');
    const manualTanksWidth = document.getElementById('manual-tanks-width');
    const manualTanksHeight = document.getElementById('manual-tanks-height');
    const manualCompressorsWidth = document.getElementById('manual-compressors-width');
    const manualCompressorsHeight = document.getElementById('manual-compressors-height');
    const manualHeadLength = document.getElementById('manual-head-length');
    const manualHeadWidth = document.getElementById('manual-head-width');
    const manualHeadHeight = document.getElementById('manual-head-height');
    const manualB2BLength = document.getElementById('manual-b2b-length');
    const manualB2BWidth = document.getElementById('manual-b2b-width');
    const manualB2BHeight = document.getElementById('manual-b2b-height');
    const overrideActiveIndicator = document.getElementById('override-active-indicator');

    const setOverrideIndicator = (isActive) => {
        if (!overrideActiveIndicator) return;
        overrideActiveIndicator.classList.toggle('hidden', !isActive);
    };

    showOverrideBtn.addEventListener('click', () => {
        // Populate modal with current values before showing
        manualTanksLength.value = parseInt(tanksLengthOutput.textContent) || '';
        manualCompressorsLength.value = parseInt(compressorsLengthOutput.textContent) || '';
        manualTanksWidth.value = getOverrideValue(manualOverrides.tanks.width) ?? (parseInt(tanksWidthOutput.textContent) || '');
        manualTanksHeight.value = getOverrideValue(manualOverrides.tanks.height) ?? (machineHeight || '');
        manualCompressorsWidth.value = getOverrideValue(manualOverrides.compressors.width) ?? (parseInt(compressorsWidthOutput.textContent) || '');
        manualCompressorsHeight.value = getOverrideValue(manualOverrides.compressors.height) ?? (machineHeight || '');

        const selectedHeadPanel = headPanelModelSelect.value !== ''
            ? dataQuadri[parseInt(headPanelModelSelect.value, 10)]
            : null;
        const selectedB2BPanel = b2bPanelModelSelect.value !== ''
            ? dataQuadri[parseInt(b2bPanelModelSelect.value, 10)]
            : null;

        manualHeadLength.value = getOverrideValue(manualOverrides.head.length) ?? (selectedHeadPanel ? selectedHeadPanel.L : '');
        manualHeadWidth.value = getOverrideValue(manualOverrides.head.width) ?? (selectedHeadPanel ? selectedHeadPanel.W : '');
        manualHeadHeight.value = getOverrideValue(manualOverrides.head.height) ?? (selectedHeadPanel ? selectedHeadPanel.H : '');
        manualB2BLength.value = getOverrideValue(manualOverrides.b2b.length) ?? (selectedB2BPanel ? selectedB2BPanel.L : '');
        manualB2BWidth.value = getOverrideValue(manualOverrides.b2b.width) ?? (selectedB2BPanel ? selectedB2BPanel.W : '');
        manualB2BHeight.value = getOverrideValue(manualOverrides.b2b.height) ?? (selectedB2BPanel ? selectedB2BPanel.H : '');
        overrideModal.classList.remove('hidden');
    });

    const closeOverrideModal = () => {
        overrideModal.classList.add('hidden');
    };

    closeOverrideBtn.addEventListener('click', closeOverrideModal);
    overrideModal.addEventListener('click', (event) => {
        if (event.target === overrideModal) {
            closeOverrideModal();
        }
    });

    applyOverrideBtn.addEventListener('click', () => {
        const newTanksLength = parseInt(manualTanksLength.value);
        const newCompressorsLength = parseInt(manualCompressorsLength.value);
        const newTanksWidth = parseInt(manualTanksWidth.value);
        const newTanksHeight = parseInt(manualTanksHeight.value);
        const newCompressorsWidth = parseInt(manualCompressorsWidth.value);
        const newCompressorsHeight = parseInt(manualCompressorsHeight.value);
        const newHeadLength = parseInt(manualHeadLength.value);
        const newHeadWidth = parseInt(manualHeadWidth.value);
        const newHeadHeight = parseInt(manualHeadHeight.value);
        const newB2BLength = parseInt(manualB2BLength.value);
        const newB2BWidth = parseInt(manualB2BWidth.value);
        const newB2BHeight = parseInt(manualB2BHeight.value);

        let overrideApplied = false;

        // Update values if the inputs are not empty/invalid
        if (!isNaN(newTanksLength) && newTanksLength >= 0) {
            tanksLengthOutput.textContent = `${newTanksLength} mm`;
            overrideApplied = true;
        }
        if (!isNaN(newCompressorsLength) && newCompressorsLength >= 0) {
            compressorsLengthOutput.textContent = `${newCompressorsLength} mm`;
            overrideApplied = true;
        }
        if (!isNaN(newTanksWidth) && newTanksWidth > 0) {
            manualOverrides.tanks.width = newTanksWidth;
            tanksWidthOutput.textContent = `${newTanksWidth} mm`;
            overrideApplied = true;
        } else {
            manualOverrides.tanks.width = null;
            tanksWidthOutput.textContent = `${tanksSectionWidth} mm`;
        }
        if (!isNaN(newTanksHeight) && newTanksHeight > 0) {
            manualOverrides.tanks.height = newTanksHeight;
            overrideApplied = true;
        } else {
            manualOverrides.tanks.height = null;
        }
        if (!isNaN(newCompressorsWidth) && newCompressorsWidth > 0) {
            manualOverrides.compressors.width = newCompressorsWidth;
            compressorsWidthOutput.textContent = `${newCompressorsWidth} mm`;
            overrideApplied = true;
        } else {
            manualOverrides.compressors.width = null;
            compressorsWidthOutput.textContent = `${currentMachineWidth} mm`;
        }
        if (!isNaN(newCompressorsHeight) && newCompressorsHeight > 0) {
            manualOverrides.compressors.height = newCompressorsHeight;
            overrideApplied = true;
        } else {
            manualOverrides.compressors.height = null;
        }
        if (!isNaN(newHeadWidth) && newHeadWidth > 0) {
            manualOverrides.head.width = newHeadWidth;
            overrideApplied = true;
        } else {
            manualOverrides.head.width = null;
        }
        if (!isNaN(newHeadLength) && newHeadLength > 0) {
            manualOverrides.head.length = newHeadLength;
            overrideApplied = true;
        } else {
            manualOverrides.head.length = null;
        }
        if (!isNaN(newHeadHeight) && newHeadHeight > 0) {
            manualOverrides.head.height = newHeadHeight;
            overrideApplied = true;
        } else {
            manualOverrides.head.height = null;
        }
        if (!isNaN(newB2BWidth) && newB2BWidth > 0) {
            manualOverrides.b2b.width = newB2BWidth;
            overrideApplied = true;
        } else {
            manualOverrides.b2b.width = null;
        }
        if (!isNaN(newB2BLength) && newB2BLength > 0) {
            manualOverrides.b2b.length = newB2BLength;
            overrideApplied = true;
        } else {
            manualOverrides.b2b.length = null;
        }
        if (!isNaN(newB2BHeight) && newB2BHeight > 0) {
            manualOverrides.b2b.height = newB2BHeight;
            overrideApplied = true;
        } else {
            manualOverrides.b2b.height = null;
        }

        const overrideHeights = [
            manualOverrides.tanks.height,
            manualOverrides.compressors.height,
            manualOverrides.head.height,
            manualOverrides.b2b.height
        ].filter((value) => value && value > 0);
        if (overrideHeights.length > 0) {
            machineHeight = Math.max(...overrideHeights);
            machineHeightOutput.textContent = `${machineHeight} mm`;
        }

        if (overrideApplied) {
            isManualOverrideActive = true;
            setOverrideIndicator(true);
        } else {
            isManualOverrideActive = false;
            setOverrideIndicator(false);
        }

        updatePanelPreferenceHints();
        // Redraw and close
        updateVisualization();
        closeOverrideModal();
    });

    // --- EXPORT FUNCTIONALITY ---
    const copySummaryBtn = document.getElementById('copy-summary-btn');
    const downloadPdfBtn = document.getElementById('download-pdf-btn');

    // --- PDF MODAL ELEMENTS ---
    const pdfOptionsModal = document.getElementById('pdf-options-modal');
    const closePdfOptionsBtn = document.getElementById('close-pdf-options-btn');
    const pdfPreviewsContainer = document.getElementById('pdf-previews-container');
    const generateSelectedPdfBtn = document.getElementById('generate-selected-pdf-btn');


    function getElementValue(id, isSelectText = false) {
        const element = document.getElementById(id);
        if (!element) {
            // Check for radio button group by name
            const radio = document.querySelector(`input[name="${id}"]:checked`);
            if (radio) {
                if (radio.closest('.hidden')) return 'N/A';
                // isSelectText is true for this case. I want the label text.
                return radio.parentElement.textContent.trim();
            }
            return 'N/A';
        }
        if (isSelectText) {
            // For disabled selects, return N/A
            if (element.closest('.hidden') || element.disabled) return 'N/A';
            return element.options[element.selectedIndex].text;
        }
        return element.value || 'Not specified';
    }

    function getOutputValue(id) {
        const element = document.getElementById(id);
        return element ? element.textContent : 'N/A';
    }

    function buildPdfFileName() {
        const jobNameInput = document.getElementById('job-name');
        const offerNumberInput = document.getElementById('offer-number');

        const rawJobName = jobNameInput ? jobNameInput.value.trim() : '';
        const rawOfferNumber = offerNumberInput ? offerNumberInput.value.trim() : '';

        const baseName = rawJobName || rawOfferNumber || 'Project';
        const sanitizedBaseName = baseName
            .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
            .replace(/\s+/g, '_')
            .replace(/_+/g, '_')
            .replace(/^[._-]+|[._-]+$/g, '');

        const finalBaseName = sanitizedBaseName || 'Project';
        return `Preliminary_Dimensions_${finalBaseName}.pdf`;
    }

    function generateSummaryText() {
        const claddingValue = document.querySelector('input[name="cladding"]:checked').value;
        const hasCladding = claddingValue !== 'no';

        const tanksLength = parseInt(getOutputValue('tanks-length')) || 0;
        const compressorsLength = parseInt(getOutputValue('compressors-length')) || 0;
        
        const { length: b2bPanelLength, width: b2bPanelWidth } = getPanelDimensions('b2b');
        const { length: headPanelLength, width: headPanelWidth } = getPanelDimensions('head');

        let summary = `
Machine Size Configurator Summary
================================
Job Information
- Job Year: ${getElementValue('job-year')}
- Offer Number: ${getElementValue('offer-number')}
- Job Number: ${getElementValue('job-number')}
- Job Name: ${getElementValue('job-name')}

================================
General
- Cladding Present: ${getElementValue('cladding', true)}
- Machine Configuration: ${getElementValue('configuration', true)}
`;

        summary += `
================================
Electrical Panel
- B2B Panel Model: ${getElementValue('b2b-panel-model', true)}
- Head Panel Model: ${getElementValue('head-panel-model', true)}
`;
        // Clean up whitespace for a neat summary
        return summary.trim().replace(/^\s+/gm, '');
    }

    copySummaryBtn.addEventListener('click', () => {
        const summaryText = generateSummaryText();
        navigator.clipboard.writeText(summaryText).then(() => {
            const originalText = copySummaryBtn.textContent;
            copySummaryBtn.textContent = 'Copied!';
            setTimeout(() => {
                copySummaryBtn.textContent = originalText;
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            alert('Could not copy summary to clipboard.');
        });
    });

    downloadPdfBtn.addEventListener('click', () => {
        pdfPreviewsContainer.innerHTML = ''; // Clear previous previews
    
        const visibleVisualizations = Array.from(multiVisualizationContainer.querySelectorAll('.card.drawing-container:not(.hidden)'));
    
        visibleVisualizations.forEach((vizCard, index) => {
            const title = vizCard.querySelector('h2').textContent;
            const vizClone = vizCard.cloneNode(true); // Deep clone the visualization card
            
            // Remove IDs from the clone to avoid duplicates in the DOM
            vizClone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
    
            const previewWrapper = document.createElement('div');
            previewWrapper.className = 'pdf-preview-item';
    
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `pdf-option-${index}`;
            // Store a reference to the original card's index relative to all cards in the container
            const originalIndex = Array.from(multiVisualizationContainer.children).indexOf(vizCard);
            checkbox.dataset.sourceCardIndex = originalIndex;
            checkbox.checked = true; // Default to selected
    
            const label = document.createElement('label');
            label.htmlFor = `pdf-option-${index}`;
            label.textContent = title;
    
            const header = document.createElement('div');
            header.className = 'pdf-preview-header';
            header.appendChild(checkbox);
            header.appendChild(label);
            
            // Create a wrapper for scaling the preview content
            const previewContentWrapper = document.createElement('div');
            previewContentWrapper.className = 'pdf-preview-content-wrapper';
            previewContentWrapper.appendChild(vizClone);

            previewWrapper.appendChild(header);
            previewWrapper.appendChild(previewContentWrapper);
    
            pdfPreviewsContainer.appendChild(previewWrapper);
        });
    
        pdfOptionsModal.classList.remove('hidden');
    });

    // PDF Modal close logic
    closePdfOptionsBtn.addEventListener('click', () => pdfOptionsModal.classList.add('hidden'));
    pdfOptionsModal.addEventListener('click', (event) => {
        if (event.target === pdfOptionsModal) {
            pdfOptionsModal.classList.add('hidden');
        }
    });

    generateSelectedPdfBtn.addEventListener('click', () => {
        const selectedCheckboxes = pdfPreviewsContainer.querySelectorAll('input[type="checkbox"]:checked');

        if (selectedCheckboxes.length === 0) {
            alert('Please select at least one configuration to include in the PDF.');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const summaryText = generateSummaryText();
        const claddingValue = document.querySelector('input[name="cladding"]:checked').value;

        const originalBtnText = generateSelectedPdfBtn.textContent;
        generateSelectedPdfBtn.textContent = 'Generating...';
        generateSelectedPdfBtn.disabled = true;
        downloadPdfBtn.disabled = true; // Also disable the main button

        document.body.classList.add('pdf-export-active');

        // Use a short timeout to allow the browser to apply the 'pdf-export-active' styles
        setTimeout(() => {
            const margin = 15;
            const contentWidth = doc.internal.pageSize.getWidth() - (margin * 2);

            // --- Get the cards that were selected for rendering ---
            const vizCardsToRender = [];
            selectedCheckboxes.forEach(checkbox => {
                const sourceIndex = parseInt(checkbox.dataset.sourceCardIndex);
                const originalCard = multiVisualizationContainer.children[sourceIndex];
                if (originalCard) {
                    vizCardsToRender.push(originalCard);
                }
            });

            // --- Temporarily change visualization titles for PDF ---
            const originalTitles = [];

            // --- Add checkbox options for PDF ---
            const addedCheckboxes = [];
            if (claddingValue === 'no') {
                vizCardsToRender.forEach(card => {
                    const checkboxContainer = document.createElement('div');
                    checkboxContainer.className = 'pdf-checkbox-options';
                    checkboxContainer.innerHTML = `<div class="pdf-option-line"><strong>Tanks:</strong><span>☐ Attached</span><span>☐ Not Attached</span></div><div class="pdf-option-line"><strong>El. Panel:</strong><span>☐ Attached</span><span>☐ Not Attached</span></div><div class="pdf-option-line"><strong>Distance Comp-Panel (if not attached):</strong><span>__________ mm</span></div>`;
                    card.appendChild(checkboxContainer);
                    addedCheckboxes.push(checkboxContainer);
                });
            }

            if (vizCardsToRender.length > 0) {
                vizCardsToRender.forEach((card, index) => {
                    const titleElement = card.querySelector('h2');
                    if (titleElement) {
                        originalTitles[index] = titleElement.textContent; // Store original title
                        // Find the original index to create the correct letter (A, B, C)
                        const originalCardIndex = Array.from(multiVisualizationContainer.children).indexOf(card);
                        titleElement.textContent = `☐ Option ${String.fromCharCode(65 + originalCardIndex)}`;
                    }
                });
            }

            // Recalculate layouts under PDF styles to avoid overlaps/clipping
            updateVisualization();

            // Now that the cards are modified for the PDF, generate the canvas promises
            const promises = vizCardsToRender.map(card => html2canvas(card, {
                scale: 2,
                backgroundColor: '#ffffff',
                useCORS: true
            }));

            doc.setFontSize(18);
            doc.text('Machine Size Configurator Summary', margin, 20);
            
            doc.setFontSize(10);
            const textLines = doc.splitTextToSize(summaryText, contentWidth);
            let currentY = 30;
            const lineHeight = 5;

            textLines.forEach(line => {
                // Check for page overflow before drawing a line
                if (currentY > doc.internal.pageSize.getHeight() - margin) {
                    doc.addPage();
                    currentY = margin;
                }

                if (line.startsWith('- ') && line.includes(':')) {
                    const parts = line.split(':');
                    const label = parts[0] + ':';
                    const value = parts.slice(1).join(':').trim();

                    doc.setFont(undefined, 'bold');
                    doc.text(label, margin, currentY);

                    const labelWidth = doc.getTextWidth(label);
                    
                    doc.setFont(undefined, 'normal');
                    doc.text(value, margin + labelWidth + 1, currentY); // +1 for a small space
                } else {
                    doc.setFont(undefined, 'normal');
                    doc.text(line, margin, currentY);
                }
                currentY += lineHeight;
            });

            const addImageToPdf = (canvas, yPos) => {
                const imgData = canvas.toDataURL('image/png');
                const imgProps = doc.getImageProperties(imgData);
                const imgWidth = contentWidth;
                const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

                if (yPos + imgHeight > doc.internal.pageSize.getHeight() - margin) {
                    doc.addPage();
                    yPos = margin;
                }
                doc.addImage(imgData, 'PNG', margin, yPos, imgWidth, imgHeight);
                return yPos + imgHeight + 20; // Return new Y position, with further reduced space
            };

            const cleanup = () => {
                document.body.classList.remove('pdf-export-active'); // Deactivate PDF styles

                // --- Remove added checkboxes ---
                addedCheckboxes.forEach(el => el.remove());

                // --- Restore original titles on the rendered cards ---
                if (vizCardsToRender.length > 0) {
                    vizCardsToRender.forEach((card, index) => {
                        const titleElement = card.querySelector('h2');
                        if (titleElement && originalTitles[index]) {
                            titleElement.textContent = originalTitles[index];
                        }
                    });
                }
                
                generateSelectedPdfBtn.textContent = originalBtnText;
                generateSelectedPdfBtn.disabled = false;
                downloadPdfBtn.disabled = false;
            };

            const addImagesAndSave = (canvases) => {
                // --- Disclaimer Logic ---
                const disclaimerTitle = "Disclaimer";
                const disclaimerText = "The measurements below are indicative and are intended to help in choosing the machine configuration. If the measurements are not satisfactory, please request a custom quotation. Please note that if no option is selected below, we will choose the configuration that best suits our needs.";
                const disclaimerTitleLines = doc.splitTextToSize(disclaimerTitle, contentWidth);
                const disclaimerLines = doc.splitTextToSize(disclaimerText, contentWidth);
                const disclaimerHeight = (disclaimerTitleLines.length + disclaimerLines.length) * lineHeight;

                // --- Suggestions Logic ---
                const suggestionsTitle = "Customer Suggestions";
                const suggestionLinesContent = [
                    "- If access behind the machine is possible, a Back to Back (B2B) electrical panel is suggested as it saves space.",
                    "- If access behind the machine is not possible, a Head electrical panel is suggested."
                ];
                const titleLines = doc.splitTextToSize(suggestionsTitle, contentWidth);
                const contentLines = doc.splitTextToSize(suggestionLinesContent.join("\n"), contentWidth);
                const suggestionsHeight = ((titleLines.length + contentLines.length) * lineHeight) + 5; // +5 for spacing

                // Calculate height of the first image to check for page break
                const firstCanvas = canvases[0];
                const imgProps = doc.getImageProperties(firstCanvas.toDataURL('image/png'));
                const firstImageHeight = (imgProps.height * contentWidth) / imgProps.width;

                // Always start the disclaimer section on a new page
                doc.addPage();
                currentY = margin;

                // Write disclaimer
                doc.setFont(undefined, 'bold');
                doc.text(disclaimerTitleLines, margin, currentY);
                currentY += disclaimerTitleLines.length * lineHeight;

                doc.setFont(undefined, 'italic');
                doc.text(disclaimerLines, margin, currentY);
                currentY += disclaimerLines.length * lineHeight;

                // Write suggestions
                currentY += 5; // Add a bit of space between sections

                doc.setFont(undefined, 'bold');
                doc.text(titleLines, margin, currentY);
                currentY += titleLines.length * lineHeight;

                doc.setFont(undefined, 'normal');
                doc.text(contentLines, margin, currentY);
                currentY += contentLines.length * lineHeight;
                
                let imageY = currentY + 5; // Start images after suggestions, with reduced space

                // Add all canvases to the PDF
                canvases.forEach(canvas => {
                    imageY = addImageToPdf(canvas, imageY);
                });

                doc.save(buildPdfFileName());
            };

            Promise.all(promises).then(addImagesAndSave).catch(err => {
                console.error('Failed to generate PDF:', err);
                alert('An error occurred while generating the PDF.');
            }).finally(() => {
                cleanup();
                pdfOptionsModal.classList.add('hidden');
            });
        }, 100); // 100ms delay
    });

    // --- RESIZE HANDLING ---
    // Redraw visualization on window resize to ensure it scales correctly.
    // Use debounce to prevent excessive recalculations during resizing.
    window.addEventListener('resize', debounce(updateVisualization, 200));
});
