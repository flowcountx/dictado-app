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
    let microphoneSource;
    let playerSource; // Fuente dedicada y persistente para el reproductor
    let animationFrameId;
    let currentlyPlayingId = null;

    // --- 3. INICIALIZACIÓN Y LÓGICA DEL AUDIO CONTEXT ---
    function initializeAudio() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            // CORRECCIÓN CLAVE: Creamos la fuente del reproductor UNA SOLA VEZ y la conectamos al analizador.
            playerSource = audioContext.createMediaElementSource(audioPlayer);
            playerSource.connect(analyser);
            analyser.connect(audioContext.destination); // Conectamos al destino final (altavoces)
        }
    }

    // --- 4. LÓGICA DEL VISUALIZADOR ---
    function connectMicrophoneToVisualizer(stream) {
        initializeAudio();
        // Aseguramos que el contexto de audio esté activo (navegadores como Chrome lo suspenden)
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        playerSource.disconnect(); // Desconectamos la fuente del reproductor para que no interfiera
        microphoneSource = audioContext.createMediaStreamSource(stream);
        microphoneSource.connect(analyser);
        drawVisualizer();
    }
    
    function connectPlayerToVisualizer() {
        initializeAudio();
        if (microphoneSource) microphoneSource.disconnect(); // Desconectamos el micrófono si estaba activo
        playerSource.connect(analyser); // Reconectamos la fuente del reproductor
        drawVisualizer();
    }
    
    function drawVisualizer() {
        animationFrameId = requestAnimationFrame(drawVisualizer);
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        canvasCtx.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
        const barWidth = (visualizerCanvas.width / bufferLength) * 1.5;
        let barHeight;
        let x = 0;
        const themeColor = document.body.classList.contains('light-mode') ? '#6200ee' : '#bb86fc';
        canvasCtx.fillStyle = themeColor;

        for (let i = 0; i < bufferLength; i++) {
            barHeight = dataArray[i] / 1.5;
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

    function loadVisualizerState() {
        if (localStorage.getItem('visualizerHidden') === 'true') {
            visualizerContainer.classList.add('hidden');
        }
    }

    // --- 5. LÓGICA DE GRABACIÓN ---
    recordButton.addEventListener('click', async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            connectMicrophoneToVisualizer(stream);
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.ondataavailable = event => audioChunks.push(event.data);
            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                const recordingName = `Grabación del ${new Date().toLocaleDateString()}`;
                addRecordingToList(audioBlob, recordingName);
                audioChunks = [];
                stopVisualizer();
                stream.getTracks().forEach(track => track.stop()); // Libera el micrófono
            };
            mediaRecorder.start();
            statusDiv.textContent = 'Grabando...';
            updateButtonStates(true, false, false);
        } catch (err) {
            console.error("Error al acceder al micrófono:", err);
            statusDiv.textContent = 'Error: No se pudo acceder al micrófono.';
        }
    });

    pauseButton.addEventListener('click', () => {
        // (Esta lógica no cambia)
    });

    stopButton.addEventListener('click', () => {
        mediaRecorder.stop();
        statusDiv.textContent = 'Grabación detenida. Presiona el botón de grabar para empezar una nueva.';
        updateButtonStates(false, true, true);
    });

    function updateButtonStates(isRecording, isPausedDisabled, isStopDisabled) {
        recordButton.disabled = isRecording;
        pauseButton.disabled = isPausedDisabled;
        stopButton.disabled = isStopDisabled;
    }

    // --- 6. LÓGICA DE CARGA DE ARCHIVOS ---
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--primary-color)'; });
    dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = 'var(--secondary-text-color)'; });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--secondary-text-color)';
        const files = e.dataTransfer.files;
        if (files.length > 0) handleFiles(files);
    });
    fileInput.addEventListener('change', () => handleFiles(fileInput.files));
    
    function handleFiles(files) {
        for (const file of files) {
            if (file.type.startsWith('audio/')) {
                addRecordingToList(file, file.name);
            } else {
                alert('Por favor, sube solo archivos de audio.');
            }
        }
    }

    // --- 7. GESTIÓN DE LA LISTA Y REPRODUCCIÓN PERSONALIZADA ---
    function addRecordingToList(audioBlob, name) {
        const audioUrl = URL.createObjectURL(audioBlob);
        const recording = { id: Date.now(), name, url: audioUrl, blob: audioBlob, transcript: null };
        recordings.push(recording);
        renderRecordings();
    }

    function renderRecordings() {
        recordingsList.innerHTML = '';
        recordings.forEach(rec => {
            const li = document.createElement('li');
            li.setAttribute('data-id', rec.id);
            const isPlaying = rec.id === currentlyPlayingId;
            li.innerHTML = `
                <div class="rec-info">
                    <strong>${rec.name}</strong>
                    <div class="actions">
                        <button class="playBtn ${isPlaying ? 'playing' : ''}" title="${isPlaying ? 'Pausar' : 'Reproducir'}">${isPlaying ? '❚❚' : '▶'}</button>
                        <button class="transcribeBtn" title="Transcribir">Aa</button>
                        <a href="${rec.url}" download="${rec.name.split('.')[0]}.wav" class="downloadLink" title="Descargar">↓</a>
                    </div>
                </div>
                ${rec.transcript !== null ? `<p class="transcription">${rec.transcript}</p>` : `<p class="transcription-status" data-id="${rec.id}"></p>`}
            `;
            recordingsList.appendChild(li);
        });
    }

    recordingsList.addEventListener('click', async (event) => {
        const target = event.target;
        const parentLi = target.closest('li');
        if (!parentLi) return;
        
        const id = Number(parentLi.getAttribute('data-id'));
        const recording = recordings.find(r => r.id === id);

        if (target.classList.contains('playBtn')) {
            if (currentlyPlayingId === id && !audioPlayer.paused) {
                audioPlayer.pause();
                stopVisualizer();
                currentlyPlayingId = null;
            } else {
                if (currentlyPlayingId !== id) {
                    audioPlayer.src = recording.url;
                }
                audioPlayer.play();
                connectPlayerToVisualizer();
                currentlyPlayingId = id;
            }
            renderRecordings();
        }

        if (target.classList.contains('transcribeBtn')) {
            target.disabled = true;
            const statusP = parentLi.querySelector('.transcription-status');
            if (statusP) statusP.textContent = 'Transcribiendo...';
            try {
                const response = await fetch('/api/transcribe', { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: recording.blob });
                if (!response.ok) throw new Error(`Error del servidor: ${response.statusText}`);
                const data = await response.json();
                const transcriptText = data.results.channels[0].alternatives[0].transcript;
                recording.transcript = transcriptText || "(No se pudo transcribir texto)";
                renderRecordings();
            } catch (error) {
                console.error('Error al transcribir:', error);
                if (statusP) statusP.textContent = 'Error al transcribir.';
                target.disabled = false;
            }
        }
    });

    audioPlayer.onended = () => {
        currentlyPlayingId = null;
        stopVisualizer();
        renderRecordings();
    };

    // --- 8. LÓGICA DE BOTONES DE LIMPIEZA ---
    clearAllButton.addEventListener('click', () => {
        if (recordings.length > 0 && confirm('¿Estás seguro de que quieres borrar TODAS las grabaciones y transcripciones?')) {
            recordings = [];
            renderRecordings();
        }
    });
    
    clearTranscriptsButton.addEventListener('click', () => {
        if (recordings.some(rec => rec.transcript)) {
            recordings.forEach(rec => rec.transcript = null);
            renderRecordings();
        }
    });

    // --- 9. LÓGICA DEL TEMA ---
    themeToggle.addEventListener('change', () => {
        document.body.classList.toggle('light-mode', themeToggle.checked);
        localStorage.setItem('theme', themeToggle.checked ? 'light' : 'dark');
    });

    function loadTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'light') {
            themeToggle.checked = true;
            document.body.classList.add('light-mode');
        }
    }
    
    // --- 10. LLAMADAS DE INICIALIZACIÓN ---
    loadTheme();
    loadVisualizerState();
});