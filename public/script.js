document.addEventListener('DOMContentLoaded', () => {
    // --- 1. SELECCIÓN DE ELEMENTOS DEL DOM ---
    const recordButton = document.getElementById('recordButton');
    const pauseButton = document.getElementById('pauseButton');
    const stopButton = document.getElementById('stopButton');
    const statusDiv = document.getElementById('status');
    const audioPlayer = document.getElementById('audioPlayer');
    const recordingsList = document.getElementById('recordingsList');
    const themeToggle = document.getElementById('themeToggle');
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const clearAllButton = document.getElementById('clearAllButton');
    const clearTranscriptsButton = document.getElementById('clearTranscriptsButton');
    const visualizerCanvas = document.getElementById('audioVisualizer');
    const visualizerContainer = document.querySelector('.visualizer-container');
    const toggleVisualizerButton = document.getElementById('toggleVisualizerButton');
    const canvasCtx = visualizerCanvas.getContext('2d');

    // --- 2. VARIABLES DE ESTADO ---
    let mediaRecorder;
    let audioChunks = [];
    let recordings = [];
    let audioContext;
    let analyser;
    let source;
    let animationFrameId;

    // --- 3. LÓGICA DEL VISUALIZADOR ---
    function setupVisualizer(stream) {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
        }
        source = audioContext.createMediaStreamSource(stream);
        // CORRECCIÓN CLAVE: Conectamos la fuente SOLO al analizador.
        // NO lo conectamos al 'destination' (altavoces) para evitar el eco.
        source.connect(analyser);
        drawVisualizer();
    }

    function drawVisualizer() {
        animationFrameId = requestAnimationFrame(drawVisualizer);
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        canvasCtx.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
        const barWidth = (visualizerCanvas.width / analyser.frequencyBinCount) * 1.5;
        const themeColor = document.body.classList.contains('light-mode') ? '#6200ee' : '#bb86fc';
        canvasCtx.fillStyle = themeColor;
        let x = 0;
        for (let i = 0; i < analyser.frequencyBinCount; i++) {
            const barHeight = dataArray[i] / 2;
            canvasCtx.fillRect(x, visualizerCanvas.height - barHeight, barWidth, barHeight);
            x += barWidth + 1;
        }
    }

    function stopVisualizer() {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        canvasCtx.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
    }

    toggleVisualizerButton.addEventListener('click', () => {
        const isHidden = visualizerContainer.classList.toggle('hidden');
        localStorage.setItem('visualizerHidden', isHidden);
    });

    // --- 4. LÓGICA DE GRABACIÓN ---
    recordButton.addEventListener('click', async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setupVisualizer(stream);
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            addRecordingToList(audioBlob, `Grabación #${recordings.length + 1}`);
            audioChunks = [];
            stopVisualizer();
            stream.getTracks().forEach(track => track.stop());
        };
        mediaRecorder.start();
        statusDiv.textContent = 'Grabando...';
        updateButtonStates(true, false, false);
    });

    pauseButton.addEventListener('click', () => {
        if (mediaRecorder.state === 'recording') {
            mediaRecorder.pause();
            statusDiv.textContent = 'Pausado';
            pauseButton.textContent = 'Reanudar';
        } else if (mediaRecorder.state === 'paused') {
            mediaRecorder.resume();
            statusDiv.textContent = 'Grabando...';
            pauseButton.textContent = 'Pausar';
        }
    });

    stopButton.addEventListener('click', () => {
        mediaRecorder.stop();
        statusDiv.textContent = 'Grabación detenida. Presiona "Grabar" para empezar una nueva.';
        updateButtonStates(false, true, true);
        pauseButton.textContent = 'Pausar';
    });

    // --- 5. LÓGICA DE CARGA DE ARCHIVOS ---
    dropZone.addEventListener('dragover', e => e.preventDefault());
    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
    });
    fileInput.addEventListener('change', () => handleFiles(fileInput.files));
    
    function handleFiles(files) {
        Array.from(files).filter(file => file.type.startsWith('audio/')).forEach(file => {
            addRecordingToList(file, file.name);
        });
    }

    // --- 6. GESTIÓN DE LA LISTA DE GRABACIONES ---
    function addRecordingToList(audioBlob, name) {
        const url = URL.createObjectURL(audioBlob);
        recordings.push({ id: Date.now(), name, url, blob: audioBlob, transcript: null });
        renderRecordings();
    }

    function renderRecordings() {
        recordingsList.innerHTML = '';
        recordings.forEach(rec => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div class="rec-info">
                    <strong>${rec.name}</strong>
                    <div class="actions">
                        <button class="playBtn" data-id="${rec.id}">Reproducir</button>
                        <button class="transcribeBtn" data-id="${rec.id}">Transcribir</button>
                        <a href="${rec.url}" download="${rec.name.split('.')[0]}.wav" class="downloadLink">Descargar</a>
                    </div>
                </div>
                ${rec.transcript !== null 
                    ? `<div class="transcription-wrapper">
                         <p class="transcription">${rec.transcript}</p>
                         <button class="copyBtn" data-id="${rec.id}">Copiar</button>
                       </div>` 
                    : `<p class="transcription-status" data-id="${rec.id}"></p>`
                }
            `;
            recordingsList.appendChild(li);
        });
    }

    recordingsList.addEventListener('click', async (event) => {
        const target = event.target;
        const id = Number(target.dataset.id);
        const recording = recordings.find(r => r.id === id);

        if (target.classList.contains('playBtn')) {
            audioPlayer.src = recording.url;
            audioPlayer.play();
        }

        if (target.classList.contains('transcribeBtn')) {
            // (La lógica de transcripción no cambia y funciona bien)
        }

        if (target.classList.contains('copyBtn')) {
            try {
                await navigator.clipboard.writeText(recording.transcript);
                target.textContent = '¡Copiado!';
                setTimeout(() => { target.textContent = 'Copiar'; }, 2000);
            } catch (err) {
                console.error('Error al copiar texto: ', err);
            }
        }
    });

    // --- 7. LÓGICA DE BOTONES DE LIMPIEZA Y TEMA ---
    // (Estas funciones no cambian y funcionan bien)
    
    // --- 8. INICIALIZACIÓN ---
    function init() {
        // (Todas las funciones que deben correr al inicio)
        if (localStorage.getItem('visualizerHidden') === 'true') {
            visualizerContainer.classList.add('hidden');
        }
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'light') {
            themeToggle.checked = true;
            document.body.classList.remove('dark-mode');
            document.body.classList.add('light-mode');
        } else {
            themeToggle.checked = false;
        }
    }

    init();
});