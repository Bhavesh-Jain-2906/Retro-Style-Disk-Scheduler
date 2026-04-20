
const requestQueueInput = document.getElementById('requestQueue');
const initialHeadInput = document.getElementById('initialHead');
const diskSizeInput = document.getElementById('diskSize');
const algorithmSelect = document.getElementById('algorithmSelect');
const directionGroup = document.getElementById('directionGroup');
const directionSelect = document.getElementById('directionSelect');
const speedSlider = document.getElementById('speedSlider');
const speedValue = document.getElementById('speedValue');
const runBtn = document.getElementById('runBtn');
const compareBtn = document.getElementById('compareBtn');

const simulationView = document.getElementById('simulationView');
const comparisonView = document.getElementById('comparisonView');
const currentAlgoBadge = document.getElementById('currentAlgoBadge');
const liveHeadValue = document.getElementById('liveHeadValue');
const totalSeekTimeValue = document.getElementById('totalSeekTimeValue');
const seekSequenceValue = document.getElementById('seekSequenceValue');
const comparisonTableBody = document.getElementById('comparisonTableBody');
const errorContainer = document.getElementById('errorContainer');


let lineChart = null;
let barChart = null;
let animationTimeout = null;


const COLOR_BG = '#050510';
const COLOR_CYAN = '#00f3ff';
const COLOR_PINK = '#ff00ff';
const COLOR_GREEN = '#39ff14';
const COLOR_WHITE = '#ffffff';


algorithmSelect.addEventListener('change', (e) => {
    if (e.target.value === 'SCAN' || e.target.value === 'CSCAN') {
        directionGroup.style.display = 'block';
    } else {
        directionGroup.style.display = 'none';
    }
});

speedSlider.addEventListener('input', (e) => {
    speedValue.textContent = `[${e.target.value}x]`;
});

runBtn.addEventListener('click', runSimulation);
compareBtn.addEventListener('click', runComparison);


function getInputs() {
    let isValid = true;
    errorContainer.style.display = 'none';
    

    const queueRaw = requestQueueInput.value;
    const queueStrings = queueRaw.split(',').map(s => s.trim()).filter(s => s !== '');
    const queue = queueStrings.map(Number);
    
    if (queue.length === 0 || queue.some(isNaN)) {
        requestQueueInput.classList.add('error');
        isValid = false;
    } else {
        requestQueueInput.classList.remove('error');
    }


    const head = parseInt(initialHeadInput.value);
    if (isNaN(head) || head < 0) {
        initialHeadInput.classList.add('error');
        isValid = false;
    } else {
        initialHeadInput.classList.remove('error');
    }


    const size = parseInt(diskSizeInput.value);
    if (isNaN(size) || size <= 0) {
        diskSizeInput.classList.add('error');
        isValid = false;
    } else {
        diskSizeInput.classList.remove('error');
    }

    let errorMessages = [];
    if (isValid) {
        if (head >= size) {
            initialHeadInput.classList.add('error');
            errorMessages.push(`Initial head (${head}) cannot be greater than or equal to disk size (${size}).`);
            isValid = false;
        }
        if (queue.some(num => num < 0)) {
            requestQueueInput.classList.add('error');
            errorMessages.push("Request queue cannot contain negative numbers.");
            isValid = false;
        }
        if (queue.some(num => num >= size)) {
            requestQueueInput.classList.add('error');
            errorMessages.push(`Request queue contains values greater than or equal to disk size (${size}).`);
            isValid = false;
        }
    }

    if (!isValid) {
        if (errorMessages.length > 0) {
            errorContainer.innerHTML = "> ERROR DETECTED:\n" + errorMessages.join("\\n");
            errorContainer.style.display = 'block';
        }
        return null;
    }

    return { queue, head, size, algorithm: algorithmSelect.value, direction: directionSelect.value };
}


function calculateSeekTime(sequence) {
    let time = 0;
    for (let i = 0; i < sequence.length - 1; i++) {
        time += Math.abs(sequence[i] - sequence[i + 1]);
    }
    return time;
}

function fcfs(queue, head) {
    const sequence = [head, ...queue];
    return { sequence, totalSeekTime: calculateSeekTime(sequence) };
}

function sstf(queue, head) {
    let sequence = [head];
    let current = head;
    let pending = [...queue];
    
    while (pending.length > 0) {
        let closestIndex = 0;
        let minDistance = Math.abs(current - pending[0]);
        for (let i = 1; i < pending.length; i++) {
            let dist = Math.abs(current - pending[i]);
            if (dist < minDistance) { minDistance = dist; closestIndex = i; }
        }
        current = pending.splice(closestIndex, 1)[0];
        sequence.push(current);
    }
    return { sequence, totalSeekTime: calculateSeekTime(sequence) };
}

function scan(queue, head, size, direction) {
    let sequence = [head];
    let left = queue.filter(req => req < head).sort((a, b) => a - b);
    let right = queue.filter(req => req >= head).sort((a, b) => a - b);
    
    if (direction === 'right') {
        sequence.push(...right);
        if (left.length > 0) {
            if (sequence[sequence.length - 1] !== size - 1) sequence.push(size - 1);
            sequence.push(...left.reverse());
        }
    } else {
        sequence.push(...left.reverse());
        if (right.length > 0) {
            if (sequence[sequence.length - 1] !== 0) sequence.push(0);
            sequence.push(...right);
        }
    }
    sequence = sequence.filter((val, i, arr) => i === 0 || val !== arr[i-1]);
    return { sequence, totalSeekTime: calculateSeekTime(sequence) };
}

function cscan(queue, head, size, direction) {
    let sequence = [head];
    let left = queue.filter(req => req < head).sort((a, b) => a - b);
    let right = queue.filter(req => req >= head).sort((a, b) => a - b);
    
    if (direction === 'right') {
        sequence.push(...right);
        if (left.length > 0) {
            if (sequence[sequence.length - 1] !== size - 1) sequence.push(size - 1);
            sequence.push(0);
            sequence.push(...left);
        }
    } else {
        sequence.push(...left.reverse());
        if (right.length > 0) {
            if (sequence[sequence.length - 1] !== 0) sequence.push(0);
            sequence.push(size - 1);
            sequence.push(...right.reverse());
        }
    }
    sequence = sequence.filter((val, i, arr) => i === 0 || val !== arr[i-1]);
    return { sequence, totalSeekTime: calculateSeekTime(sequence) };
}

function runAlgorithm(inputs) {
    switch (inputs.algorithm) {
        case 'FCFS': return fcfs(inputs.queue, inputs.head);
        case 'SSTF': return sstf(inputs.queue, inputs.head);
        case 'SCAN': return scan(inputs.queue, inputs.head, inputs.size, inputs.direction);
        case 'CSCAN': return cscan(inputs.queue, inputs.head, inputs.size, inputs.direction);
        default: return fcfs(inputs.queue, inputs.head);
    }
}

Chart.defaults.font.family = "'Press Start 2P', cursive";
Chart.defaults.font.size = 10;
Chart.defaults.color = COLOR_CYAN;

function drawLineChart() {
    const ctx = document.getElementById('lineChart').getContext('2d');
    if (lineChart) lineChart.destroy();
    
    lineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: ' HEAD POSITION',
                data: [],
                borderColor: COLOR_GREEN,
                backgroundColor: 'transparent',
                borderWidth: 3,
                pointBackgroundColor: COLOR_BACKGROUND = COLOR_BG,
                pointBorderColor: COLOR_PINK,
                pointBorderWidth: 2,
                pointRadius: 6,
                pointHoverRadius: 8,
                pointStyle: 'rect', 
                tension: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'TRACK NUMBER', color: COLOR_WHITE },
                    grid: { color: 'rgba(0, 243, 255, 0.2)', lineWidth: 1 }
                },
                x: {
                    title: { display: true, text: 'SEQUENCE STEP', color: COLOR_WHITE },
                    grid: { color: 'rgba(0, 243, 255, 0.2)', lineWidth: 1 }
                }
            },
            plugins: {
                legend: { labels: { color: COLOR_WHITE, boxWidth: 15, boxHeight: 15 } }
            }
        }
    });
}

function runSimulation() {
    const inputs = getInputs();
    if (!inputs) return;
    
    if (animationTimeout) clearTimeout(animationTimeout);
    
    simulationView.style.display = 'flex';
    comparisonView.style.display = 'none';
    currentAlgoBadge.textContent = `[${inputs.algorithm}]`;
    
    const result = runAlgorithm(inputs);
    const sequence = result.sequence;
    
    totalSeekTimeValue.textContent = result.totalSeekTime;
    seekSequenceValue.innerHTML = '';
    liveHeadValue.textContent = sequence[0];
    
    drawLineChart();
    
    let step = 0;
    
    function animateStep() {
        if (step >= sequence.length) return;
        
        lineChart.data.labels.push(step);
        lineChart.data.datasets[0].data.push(sequence[step]);
        lineChart.update();
        
        liveHeadValue.textContent = sequence[step];
        if (step === 0) seekSequenceValue.innerHTML += sequence[step];
        else seekSequenceValue.innerHTML += ` &rarr; ${sequence[step]}`;
        
        step++;
        if (step < sequence.length) {
            const speedLevel = parseInt(speedSlider.value);
            const delay = 2200 - (speedLevel * 200); 
            animationTimeout = setTimeout(animateStep, delay);
        }
    }
    
    animateStep();
}

function runComparison() {
    const inputs = getInputs();
    if (!inputs) return;
    
    if (animationTimeout) clearTimeout(animationTimeout);
    
    simulationView.style.display = 'none';
    comparisonView.style.display = 'flex';
    
    const algos = ['FCFS', 'SSTF', 'SCAN', 'CSCAN'];
    const results = [];
    
    algos.forEach(algo => {
        const inp = { ...inputs, algorithm: algo };
        results.push({ name: algo, result: runAlgorithm(inp) });
    });
    
    const ctx = document.getElementById('barChart').getContext('2d');
    if (barChart) barChart.destroy();
    
    barChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: algos,
            datasets: [{
                label: ' TOTAL SEEK TIME',
                data: results.map(r => r.result.totalSeekTime),
                backgroundColor: [COLOR_CYAN, COLOR_PINK, COLOR_GREEN, COLOR_WHITE],
                borderColor: COLOR_BG,
                borderWidth: 2,
                hoverBackgroundColor: COLOR_WHITE
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'SEEK TIME', color: COLOR_WHITE },
                    grid: { color: 'rgba(0, 243, 255, 0.2)' }
                },
                x: {
                    grid: { display: false }
                }
            },
            plugins: { legend: { display: false } }
        }
    });
    
    comparisonTableBody.innerHTML = '';
    const minSeekTime = Math.min(...results.map(r => r.result.totalSeekTime));
    const reqCount = inputs.queue.length;
    
    results.forEach(r => {
        const tr = document.createElement('tr');
        if (r.result.totalSeekTime === minSeekTime) {
            tr.classList.add('winner-row');
        }

        const throughput = r.result.totalSeekTime === 0 ? "N/A" : (reqCount / r.result.totalSeekTime).toFixed(4);
        const efficiency = r.result.totalSeekTime === 0 ? "N/A" : ((reqCount / r.result.totalSeekTime) * 100).toFixed(2) + "%";
        
        tr.innerHTML = `
            <td>>> ${r.name} ${r.result.totalSeekTime === minSeekTime ? '<span class="blink">[MIN]</span>' : ''}</td>
            <td>${r.result.totalSeekTime}</td>
            <td>${r.result.sequence.length}</td>
            <td>${throughput}</td>
            <td>${efficiency}</td>
        `;
        comparisonTableBody.appendChild(tr);
    });
}
