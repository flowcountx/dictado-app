document.addEventListener('DOMContentLoaded', () => {
    // --- 1. SELECCIÓN DE ELEMENTOS DEL DOM ---
    // Seleccionamos todos los elementos HTML con los que vamos a interactuar.
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
    const canvasCtx = visualizerCanvas.getContext('2d');

    // --- 2. VARIABLES DE ESTADO ---
    // Estas variables guardarán el estado de nuestra aplicación.
    let mediaRecorder;
    let audioChunks = [];
    let recordings = []; // Array para guardar objetos de grabación
    let audioContext;    // Contexto de la Web Audio API para el visualizador
    let analyser;        // Nodo que analiza el audio
    let source;          // Fuente del audio (micrófono o reproductor)
    let animationFrameId; // ID para controlar la animación del visualizador

    // --- 3. LÓGICA DEL VISUALIZADOR DE AUDIO ---
    // Configura la Web Audio API para analizar una fuente de audio (stream).
    function setupVisualizer(stream) {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        // Si ya hay una fuente conectada, la desconectamos para evitar errores.
        if (source) {
            source.disconnect();
        }
        analyser = audioContext.createAnalyser();
        source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.fftSize = 256; // Define la complejidad del análisis
        drawVisualizer();
    }
    
    // Dibuja las barras del visualizador en el canvas. Se llama a sí misma para crear una animación.
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
            barHeight = dataArray[i] / 1.5; // Hacemos las barras un poco más pequeñas
            canvasCtx.fillRect(x, visualizerCanvas.height - barHeight, barWidth, barHeight);
            x += barWidth + 1;
        }
    }

    // Detiene la animación del visualizador.
    function stopVisualizer() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        canvasCtx.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
    }
    
    // --- 4. LÓGICA DE GRABACIÓN ---
    recordButton.addEventListener('click', async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setupVisualizer(stream); // Conectamos el micrófono al visualizador
            mediaRecorder = new MediaRecorder(stream);

            mediaRecorder.ondataavailable = event => audioChunks.push(event.data);

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                const recordingName = `Grabación del ${new Date().toLocaleDateString()}`;
                addRecordingToList(audioBlob, recordingName);
                audioChunks = [];
                stopVisualizer();
                // Liberamos el micrófono para que el indicador del navegador desaparezca
                stream.getTracks().forEach(track => track.stop());
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
        if (mediaRecorder.state === 'recording') {
            mediaRecorder.pause();
            statusDiv.textContent = 'Pausado';
            pauseButton.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M8,5.14V19.14L19,12.14L8,5.14Z"></path></svg>`; // Icono Play
        } else if (mediaRecorder.state === 'paused') {
            mediaRecorder.resume();
            statusDiv.textContent = 'Grabando...';
            pauseButton.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M14,19H18V5H14M6,19H10V5H6V19Z"></path></svg>`; // Icono Pausa
        }
    });

    stopButton.addEventListener('click', () => {
        mediaRecorder.stop();
        statusDiv.textContent = 'Grabación detenida. Presiona el botón de grabar para empezar una nueva.';
        updateButtonStates(false, true, true);
        pauseButton.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M14,19H18V5H14M6,19H10V5H6V19Z"></path></svg>`; // Icono Pausa
    });

    function updateButtonStates(isRecording, isPausedDisabled, isStopDisabled) {
        recordButton.disabled = isRecording;
        pauseButton.disabled = isPausedDisabled;
        stopButton.disabled = isStopDisabled;
    }

    // --- 5. LÓGICA DE CARGA DE ARCHIVOS ---
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--primary-color)';
    });
    dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = 'var(--secondary-text-color)';
    });
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

    // --- 6. GESTIÓN DE LA LISTA DE GRABACIONES ---
    function addRecordingToList(audioBlob, name) {
        const audioUrl = URL.createObjectURL(audioBlob);
        const recording = { id: Date.now(), name, url: audioUrl, blob: audioBlob, transcript: null };
        recordings.push(recording);
        renderRecordings();
    }

    function renderRecordings() {
        recordingsList.innerHTML = ''; // Limpiamos para redibujar
        recordings.forEach(rec => {
            const li = document.createElement('li');
            li.setAttribute('data-id', rec.id);
            li.innerHTML = `
                <div class="rec-info">
                    <strong>${rec.name}</strong>
                    <div class="actions">
                        <button class="playBtn" title="Reproducir">▶</button>
                        <button class="transcribeBtn" title="Transcribir">Aa</button>
                        <a href="${rec.url}" download="${rec.name.split('.')[0]}.wav" class="downloadLink" title="Descargar">↓</a>
                    </div>
                </div>
                ${rec.transcript !== null ? `<p class="transcription">${rec.transcript}</p>` : `<p class="transcription-status" data-id="${rec.id}"></p>`}
            `;
            recordingsList.appendChild(li);
        });
    }

    // Usamos delegación de eventos para manejar los clics en los botones de la lista
    recordingsList.addEventListener('click', async (event) => {
        const target = event.target;
        const parentLi = target.closest('li');
        if (!parentLi) return;
        
        const id = Number(parentLi.getAttribute('data-id'));
        const recording = recordings.find(r => r.id === id);

        if (target.classList.contains('playBtn')) {
            audioPlayer.src = recording.url;
            audioPlayer.play();
            // Conectamos el reproductor al visualizador
            if (audioContext && audioContext.state === 'suspended') {
                audioContext.resume();
            }
            const playerNode = audioContext.createMediaElementSource(audioPlayer);
            playerNode.connect(analyser);
        }

        if (target.classList.contains('transcribeBtn')) {
            target.disabled = true;
            const statusP = parentLi.querySelector('.transcription-status');
            if (statusP) statusP.textContent = 'Transcribiendo, por favor espera...';

            try {
                const response = await fetch('/api/transcribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'audio/wav' },
                    body: recording.blob
                });

                if (!response.ok) throw new Error(`Error del servidor: ${response.statusText}`);

                const data = await response.json();
                const transcriptText = data.results.channels[0].alternatives[0].transcript;
                
                recording.transcript = transcriptText || "(No se pudo transcribir texto)";
                renderRecordings();

            } catch (error) {
                console.error('Error al transcribir:', error);
                if (statusP) statusP.textContent = 'Error al transcribir. Inténtalo de nuevo.';
                target.disabled = false;
            }
        }
    });

    // --- 7. LÓGICA DE BOTONES DE LIMPIEZA ---
    clearAllButton.addEventListener('click', () => {
        if (recordings.length > 0 && confirm('¿Estás seguro de que quieres borrar TODAS las grabaciones y transcripciones?')) {
            recordings = [];
            renderRecordings();
        }
    });
    
    clearTranscriptsButton.addEventListener('click', () => {
        recordings.forEach(rec => rec.transcript = null);
        renderRecordings();
    });

    // --- 8. LÓGICA DEL TEMA ---
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
    
    loadTheme(); // Cargar el tema guardado al iniciar
});