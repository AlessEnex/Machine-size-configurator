// main.js
import dataQuadri from './electricalPanelData.js';

// Wait for the DOM to be fully loaded before running the script
document.addEventListener('DOMContentLoaded', () => {

    let currentMachineWidth = 1200; // Global variable for machine width
    let isManualOverrideActive = false; // Flag to track if override is active

    // --- GENERAL CONFIG ---
    const configurationRadios = document.querySelectorAll('input[name="configuration"]');
    const sumConfigRadios = document.querySelectorAll('input[name="sum-config"]');
    const sumConfigCard = document.querySelector('input[name="sum-config"]').closest('.card');
    const claddingRadios = document.querySelectorAll('input[name="cladding"]');
    const connectionsRadios = document.querySelectorAll('input[name="connections"]');

    // --- TANKS SECTION ---
    const liquidReceiverSelect = document.getElementById('liquid-receiver-volume');
    const airConditioningSelect = document.getElementById('air-conditioning');
    const liquidSubcoolerSelect = document.getElementById('liquid-subcooler');
    const tanksLengthOutput = document.getElementById('tanks-length');

    function getGeneralConfig() {
        const configuration = document.querySelector('input[name="configuration"]:checked').value;
        const connections = document.querySelector('input[name="connections"]:checked').value;
        return { configuration, connections };
    }

    function updateSumConfigState() {
        const tanksDefined = liquidReceiverSelect.value !== '';
        
        const compressorsDefined = (parseInt(numMtSelect.value) > 0) ||
                                   (parseInt(numAuxSelect.value) > 0) ||
                                   (parseInt(numLtSelect.value) > 0) ||
                                   (oilSeparatorSelect.value !== '') ||
                                   (parseInt(heatRecoveriesSelect.value) > 0);

        const panelDefined = panelModelSelect.value !== '';

        const allDefined = tanksDefined && compressorsDefined && panelDefined;

        // Disable all radio buttons in the group if conditions are not met
        sumConfigRadios.forEach(radio => {
            radio.disabled = !allDefined;
        });
        
        if (sumConfigCard) {
            sumConfigCard.style.opacity = allDefined ? '1' : '0.6';
            sumConfigCard.title = allDefined ? '' : 'Please define Tanks, Compressors, and Electrical Panel sections first.';
        }

        // If the section becomes disabled, reset the selection to "None"
        // and update the visualization to remove any summed dimension lines.
        if (!allDefined) {
            const noneRadio = document.querySelector('input[name="sum-config"][value="none"]');
            if (noneRadio) {
                noneRadio.checked = true;
                updateVisualization();
            }
        }
    }

    // Function to calculate and update the tanks section length
    function calculateTanksLength() {
        const selectedVolume = liquidReceiverSelect.value;

        // Base length based on liquid receiver volume
        const tankBaseLengths = {
            "300L": 1500,
            "460L": 1600,
            "700L": 1900,
            "1000L": 2300,
            "2x570L": 2500
        };

        let baseLength = tankBaseLengths[selectedVolume] || 0;

        // Get the value from the Air Conditioning dropdown
        const hasAirConditioning = airConditioningSelect.value === 'yes';
        // Get the value from the Liquid Subcooler dropdown
        const hasLiquidSubcooler = liquidSubcoolerSelect.value === 'yes';
        const { configuration, connections } = getGeneralConfig();

        // Add 1000mm if Air Conditioning is selected
        let finalLength = baseLength;
        if (hasAirConditioning) {
            finalLength += 1000;
        }
        // Add 300mm if Liquid Subcooler is selected
        if (hasLiquidSubcooler) {
            finalLength += 300;
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
        updateVisualization();
        updateSumConfigState();
    }

    // Add event listeners for the tanks section
    liquidReceiverSelect.addEventListener('change', calculateTanksLength);
    airConditioningSelect.addEventListener('change', calculateTanksLength);
    liquidSubcoolerSelect.addEventListener('change', calculateTanksLength);

    // --- COMPRESSORS SECTION ---
    // New compressor elements
    const numMtSelect = document.getElementById('num-mt');
    const typeMtGroup = document.getElementById('type-mt-group');
    const numAuxSelect = document.getElementById('num-aux');
    const typeAuxGroup = document.getElementById('type-aux-group');
    const numLtSelect = document.getElementById('num-lt');
    const typeLtGroup = document.getElementById('type-lt-group');

    const oilSeparatorSelect = document.getElementById('oil-separator');
    const heatRecoveriesSelect = document.getElementById('heat-recoveries');
    const lowerDeckLengthOutput = document.getElementById('lower-deck-length');
    const upperDeckLengthOutput = document.getElementById('upper-deck-length');
    const compressorsLengthOutput = document.getElementById('compressors-length');
    const visualizationContainer = document.getElementById('visualization-container');
    const visualizationWrapper = document.getElementById('visualization-wrapper');
    const partsContainer = document.getElementById('parts-container');
    const dimensionsContainer = document.getElementById('dimensions-container');

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
            "BOS4-CDH-1BFO": 600,
            "BOS4-CDH-1NFO": 600,
            "BOS4-CDH-1CFO": 1000,
            "BOS4-CDH-1DFO": 1000
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

    // --- ELECTRICAL PANEL SECTION ---
    const panelModelSelect = document.getElementById('electrical-panel-model');
    const orientationGroup = document.getElementById('orientation-group');
    const orientationSelect = document.getElementById('electrical-panel-orientation');
    const electricalPanelLengthOutput = document.getElementById('electrical-panel-length');

    function getElectricalPanelDimensions() {
        const selectedIndex = panelModelSelect.value;
        const orientation = orientationSelect.value;

        let panelLength = 0;
        let panelWidth = 0;

        if (selectedIndex === "") {
            return { length: 0, width: 0 };
        }

        const panelData = dataQuadri[selectedIndex];

        if (panelData) {
            // The orientation option is only available for 'T' type panels
            if (panelData.typ === 'T' && orientation === 'perpendicular') {
                // Rotated
                panelLength = panelData.W; // W becomes length
                panelWidth = panelData.L;  // L becomes width
            } else {
                // Aligned or B2B
                panelLength = panelData.L;
                panelWidth = panelData.W;
            }
        }

        return { length: panelLength, width: panelWidth };
    }

    function calculateElectricalPanelLength() {
        const { length: panelLength } = getElectricalPanelDimensions();
        electricalPanelLengthOutput.textContent = `${panelLength} mm`;
        updateVisualization();
        updateSumConfigState();
    }

    // --- VISUALIZATION ---
    function updateVisualization() {
        const tanksLength = parseInt(tanksLengthOutput.textContent) || 0;
        const compressorsLength = parseInt(compressorsLengthOutput.textContent) || 0;
        const { length: electricalPanelLength, width: electricalPanelWidth } = getElectricalPanelDimensions();

        const totalLength = tanksLength + compressorsLength + electricalPanelLength;

        // Clear previous drawing
        partsContainer.innerHTML = '';
        dimensionsContainer.innerHTML = '';

        if (totalLength === 0) {
            visualizationContainer.style.display = 'none';
            // Reset height to default min-height from CSS
            visualizationWrapper.style.height = '';
            return;
        }

        // Show the container if there's something to draw
        visualizationContainer.style.display = 'block';

        const canvasWidth = visualizationWrapper.clientWidth;

        // New logic for gaps
        const configuration = document.querySelector('input[name="configuration"]:checked').value;
        const sumConfig = document.querySelector('input[name="sum-config"]:checked').value;
        const gapSize = 20; // pixels

        // Define the parts to be drawn
        const parts = [];
        if (tanksLength > 0) parts.push({ name: 'Tanks', length: tanksLength, color: 'blue-bg', width: currentMachineWidth });
        if (compressorsLength > 0) parts.push({ name: 'Compressors', length: compressorsLength, color: 'purple-bg', width: currentMachineWidth });
        if (electricalPanelLength > 0) parts.push({ name: 'Electrical Panel', length: electricalPanelLength, color: 'orange-bg', width: electricalPanelWidth });

        // Determine where gaps are needed
        let totalGapWidth = 0;
        const gaps = []; // boolean array, true if gap before this part
        if (parts.length > 1) {
            for (let i = 1; i < parts.length; i++) {
                const prevPart = parts[i - 1];
                const currentPart = parts[i];
                let needsGap;

                if (configuration === 'one_part') {
                    // In "One Part" configuration, all blocks are always attached.
                    needsGap = false;
                } else {
                    // In "Two Parts", gaps are present by default but can be removed by sum config.
                    needsGap = true; 
                    if (sumConfig === 'tanks_compressors' && prevPart.name === 'Tanks' && currentPart.name === 'Compressors') {
                        needsGap = false;
                    } else if (sumConfig === 'compressors_panel' && prevPart.name === 'Compressors' && currentPart.name === 'Electrical Panel') {
                        needsGap = false;
                    } else if (sumConfig === 'all') {
                        needsGap = false;
                    }
                }
                gaps[i] = needsGap;
                if (needsGap) {
                    totalGapWidth += gapSize;
                }
            }
        }

        const availableWidthForParts = canvasWidth - totalGapWidth;

        // Determine the maximum width of the entire assembly for correct scaling
        const maxWidth = Math.max(currentMachineWidth, electricalPanelWidth);

        // Calculate the scale factor (pixels per mm) based on the total length and available width
        const scale = availableWidthForParts > 0 ? availableWidthForParts / totalLength : 0;

        // Calculate the scaled height to maintain the aspect ratio based on the maxWidth
        const canvasHeight = maxWidth * scale;
        partsContainer.style.height = `${canvasHeight}px`;

        // Function to create a part of the drawing
        const createDrawingPart = (name, length, colorClass, widthOverride) => {
            const partWidth = length * scale;
            const displayWidth = widthOverride || currentMachineWidth;

            const part = document.createElement('div');
            part.className = `drawing-part ${colorClass}`;
            part.style.width = `${partWidth}px`;

            // Scale the height of this part relative to the maxWidth of the assembly.
            part.style.height = `${(displayWidth / maxWidth) * 100}%`;

            // The part name is direct text content, it will be bold from .drawing-part style
            part.appendChild(document.createTextNode(name));

            const dimDiv = document.createElement('div');
            dimDiv.className = 'part-dimensions';
            
            // Using innerHTML to include a line break
            dimDiv.innerHTML = `L: ${length} mm <br> W: ${displayWidth} mm`;

            part.appendChild(dimDiv);

            return part;
        };

        // Draw all parts
        parts.forEach((part, i) => {
            const partDiv = createDrawingPart(part.name, part.length, part.color, part.width);
            if (gaps[i]) {
                partDiv.style.marginLeft = `${gapSize}px`;
            }
            partsContainer.appendChild(partDiv);
        });

        drawSumDimensions(parts, scale, gaps, gapSize);
    }

    function drawSumDimensions(parts, scale, gaps, gapSize) {
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
                dimensionsContainer.appendChild(dimLine);
            }
        };

        if (sumConfig === 'tanks_compressors') createDimLine(['Tanks', 'Compressors']);
        if (sumConfig === 'compressors_panel') createDimLine(['Compressors', 'Electrical Panel']);
        if (sumConfig === 'all') createDimLine(parts.map(p => p.name));
    }

    function populatePanelSelector() {
        const configuration = document.querySelector('input[name="configuration"]:checked').value;
        const previouslySelectedValue = panelModelSelect.value;

        // Clear existing options but keep the placeholder
        panelModelSelect.innerHTML = '<option value="" selected>Select a panel...</option>';

        dataQuadri.forEach((panel, index) => {
            // If 'one_part' is selected, only show 'B2B' panels.
            if (configuration === 'one_part' && panel.typ !== 'B2B') {
                return; // Skip this panel
            }

            const option = document.createElement('option');
            option.value = index;
            option.textContent = `${panel.typ === 'T' ? 'Head' : 'B2B'}: ${panel.L}x${panel.H}x${panel.W}`;
            panelModelSelect.appendChild(option);
        });

        // Try to restore the previous selection.
        panelModelSelect.value = previouslySelectedValue;

        // If the value changed (because the previous option was removed), trigger an update.
        if (panelModelSelect.value !== previouslySelectedValue) {
            handlePanelTypeChange();
        }
    }

    function handlePanelTypeChange() {
        const selectedIndex = panelModelSelect.value;
        let isHeadPanel = false;
        if (selectedIndex !== "") {
            const panelData = dataQuadri[selectedIndex];
            isHeadPanel = panelData.typ === 'T';
        }

        // The 'hidden' class has display: none, so this toggles visibility.
        orientationGroup.classList.toggle('hidden', !isHeadPanel);
        calculateElectricalPanelLength();
    }

    panelModelSelect.addEventListener('change', handlePanelTypeChange);
    orientationSelect.addEventListener('change', calculateElectricalPanelLength);

    function handleConfigurationChange() {
        calculateTanksLength();
        calculateCompressorsLength();
        populatePanelSelector();
    }

    function handleCladdingChange() {
        const claddingValue = document.querySelector('input[name="cladding"]:checked').value;
        const onePartRadio = document.querySelector('input[name="configuration"][value="one_part"]');
        const twoPartsRadio = document.querySelector('input[name="configuration"][value="two_parts"]');

        if (claddingValue === 'yes') {
            // If cladding is present, force "One Part" and disable the "Two Parts" option.
            twoPartsRadio.disabled = true;
            if (twoPartsRadio.checked) {
                onePartRadio.checked = true;
                // Manually trigger the change event to ensure all related logic runs
                onePartRadio.dispatchEvent(new Event('change', { bubbles: true }));
            }
        } else {
            // If cladding is not present, re-enable the "Two Parts" option.
            twoPartsRadio.disabled = false;
        }
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
    populatePanelSelector();
    calculateElectricalPanelLength();
    handlePanelTypeChange(); // Set initial visibility for panel orientation
    handleCladdingChange(); // Set initial state for cladding-dependent options

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
            }
        });
    }

    // --- MODAL LOGIC (Override) ---
    const showOverrideBtn = document.getElementById('show-override-btn');
    const closeOverrideBtn = document.getElementById('close-override-btn');
    const applyOverrideBtn = document.getElementById('apply-override-btn');
    const overrideModal = document.getElementById('override-modal');
    const manualTanksLength = document.getElementById('manual-tanks-length');
    const manualCompressorsLength = document.getElementById('manual-compressors-length');
    const manualMachineWidth = document.getElementById('manual-machine-width');

    showOverrideBtn.addEventListener('click', () => {
        // Populate modal with current values before showing
        manualTanksLength.value = parseInt(tanksLengthOutput.textContent) || '';
        manualCompressorsLength.value = parseInt(compressorsLengthOutput.textContent) || '';
        manualMachineWidth.value = currentMachineWidth;
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
        const newWidth = parseInt(manualMachineWidth.value);

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
        if (!isNaN(newWidth) && newWidth > 0) {
            currentMachineWidth = newWidth;
            overrideApplied = true;
        }

        if (overrideApplied) {
            isManualOverrideActive = true;
        }

        // Redraw and close
        updateVisualization();
        closeOverrideModal();
    });

    // --- EXPORT FUNCTIONALITY ---
    const copySummaryBtn = document.getElementById('copy-summary-btn');
    const downloadPdfBtn = document.getElementById('download-pdf-btn');

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
            if (element.closest('.hidden')) return 'N/A';
            return element.options[element.selectedIndex].text;
        }
        return element.value || 'Not specified';
    }

    function getOutputValue(id) {
        const element = document.getElementById(id);
        return element ? element.textContent : 'N/A';
    }

    function generateSummaryText() {
        const tanksLength = parseInt(getOutputValue('tanks-length')) || 0;
        const compressorsLength = parseInt(getOutputValue('compressors-length')) || 0;
        const { length: electricalPanelLength, width: electricalPanelWidth } = getElectricalPanelDimensions();
        
        const totalLength = tanksLength + compressorsLength + electricalPanelLength;
        const maxWidth = Math.max(currentMachineWidth, electricalPanelWidth);
        const summary = `
Elba Size Configurator Summary
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

================================
Tanks
- Liquid Receiver Volume: ${getElementValue('liquid-receiver-volume', true)}
- Air Conditioning: ${getElementValue('air-conditioning', true)}
- Liquid Subcooler: ${getElementValue('liquid-subcooler', true)}
- Tanks Section Length: ${getOutputValue('tanks-length')}

================================
Compressors
- MT Compressors: ${getElementValue('num-mt')} (${getElementValue('type-mt', true)})
- Aux Compressors: ${getElementValue('num-aux')} (${getElementValue('type-aux', true)})
- LT Compressors: ${getElementValue('num-lt')} (${getElementValue('type-lt', true)})
- Oil Separator Model: ${getElementValue('oil-separator', true)}
- Number of Heat Recoveries: ${getElementValue('heat-recoveries')}
---
- Lower Deck Length: ${getOutputValue('lower-deck-length')}
- Upper Deck Length: ${getOutputValue('upper-deck-length')}
- Compressors Section Length: ${getOutputValue('compressors-length')}

================================
Electrical Panel
- Panel Model: ${getElementValue('electrical-panel-model', true)}
- Panel Orientation: ${getElementValue('electrical-panel-orientation', true)}
- Electrical Panel Length: ${getOutputValue('electrical-panel-length')}

================================
Overall Dimensions
- Total Length: ${totalLength} mm
- Machine Width: ${maxWidth} mm
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
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const summaryText = generateSummaryText();

        const originalBtnText = downloadPdfBtn.textContent;
        downloadPdfBtn.textContent = 'Generating...';
        downloadPdfBtn.disabled = true;

        html2canvas(visualizationContainer).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const imgProps = doc.getImageProperties(imgData);
            const pdfWidth = doc.internal.pageSize.getWidth();
            const margin = 15;
            const contentWidth = pdfWidth - (margin * 2);
            
            const imgWidth = contentWidth;
            const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

            doc.setFontSize(18);
            doc.text('Elba Size Configurator Summary', margin, 20);
            
            doc.setFontSize(10);
            const textLines = doc.splitTextToSize(summaryText, contentWidth);
            doc.text(textLines, margin, 30);

            let finalY = (textLines.length * 5) + 35; // Estimate text height

            if (finalY + imgHeight > doc.internal.pageSize.getHeight() - margin) {
                doc.addPage();
                finalY = margin;
            }

            doc.addImage(imgData, 'PNG', margin, finalY, imgWidth, imgHeight);
            doc.save('Elba_Configurator_Summary.pdf');

        }).catch(err => {
            console.error('Failed to generate PDF:', err);
            alert('An error occurred while generating the PDF. Please try again.');
        }).finally(() => {
            downloadPdfBtn.textContent = originalBtnText;
            downloadPdfBtn.disabled = false;
        });
    });
});