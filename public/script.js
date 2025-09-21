document.addEventListener('DOMContentLoaded', () => {
    // --- 1. SELECCIÓN DE ELEMENTOS DEL DOM ---
    const recordButton = document.getElementById('recordButton');
    const pauseButton = document.getElementById('pauseButton');
    const stopButton = document.getElementById('stopButton');
    const statusDiv = document.getElementById('status');
    const audioPlayer = document.getElementById('audioPlayer'); // Nuestro motor de audio oculto
    const recordingsList = document.getElementById('recordingsList');
    const themeToggle = document.getElementById('themeToggle');
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const clearAllButton = document.getElementById('clearAllButton');
    const clearTranscriptsButton = document.getElementById('clearTranscriptsButton');
    // ... (Puedes añadir aquí los selectores del visualizador si decides re-implementarlo)

    // --- 2. VARIABLES DE ESTADO ---
    let mediaRecorder;
    let audioChunks = [];
    let recordings = [];
    let currentlyPlayingId = null;

    // --- 3. LÓGICA DE GRABACIÓN (CON BUGS CORREGIDOS) ---
    recordButton.addEventListener('click', async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);

            mediaRecorder.ondataavailable = event => audioChunks.push(event.data);

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                // Nombre de archivo mejorado con fecha y hora
                const name = `Grabación - ${new Date().toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}`;
                addRecordingToList(audioBlob, name);
                audioChunks = [];
                stream.getTracks().forEach(track => track.stop()); // Libera el micrófono
            };

            mediaRecorder.start();
            statusDiv.textContent = 'Grabando...';
            // CORRECCIÓN CLAVE: Actualizamos el estado de los botones inmediatamente
            updateButtonStates(true, false, false);
        } catch (err) {
            console.error("Error al acceder al micrófono:", err);
            statusDiv.textContent = 'Error: No se pudo acceder al micrófono.';
        }
    });

    pauseButton.addEventListener('click', () => {
        if (!mediaRecorder) return;

        if (mediaRecorder.state === 'recording') {
            mediaRecorder.pause();
            statusDiv.textContent = 'Pausado';
        } else if (mediaRecorder.state === 'paused') {
            mediaRecorder.resume();
            statusDiv.textContent = 'Grabando...';
        }
    });

    stopButton.addEventListener('click', () => {
        if (!mediaRecorder) return;

        mediaRecorder.stop();
        statusDiv.textContent = 'Grabación detenida. Presiona "Grabar" para empezar.';
        updateButtonStates(false, true, true);
    });

    function updateButtonStates(isRecording, isPausedDisabled, isStopDisabled) {
        recordButton.disabled = isRecording;
        pauseButton.disabled = isPausedDisabled;
        stopButton.disabled = isStopDisabled;
    }

    // --- 4. LÓGICA DE CARGA DE ARCHIVOS ---
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

    // --- 5. GESTIÓN DE LA LISTA Y REPRODUCTOR PERSONALIZADO ---
    function addRecordingToList(audioBlob, name) {
        const url = URL.createObjectURL(audioBlob);
        // Usamos un <audio> temporal para leer la duración del archivo
        const tempAudio = new Audio(url);
        tempAudio.addEventListener('loadedmetadata', () => {
            recordings.push({ 
                id: Date.now(), 
                name, 
                url, 
                blob: audioBlob, 
                transcript: null, 
                duration: tempAudio.duration 
            });
            renderRecordings();
        });
    }

    function renderRecordings() {
        recordingsList.innerHTML = '';
        recordings.forEach(rec => {
            const li = document.createElement('li');
            li.dataset.id = rec.id;
            const isPlaying = rec.id === currentlyPlayingId;
            li.innerHTML = `
                <div class="rec-info"><strong>${rec.name}</strong></div>
                <div class="custom-player">
                    <button class="play-pause-btn">${isPlaying ? '❚❚' : '▶'}</button>
                    <div class="progress-bar-wrapper">
                        <div class="progress-bar"><div class="progress"></div></div>
                    </div>
                    <div class="time-display">0:00 / ${formatTime(rec.duration)}</div>
                </div>
                <div class="actions">
                    <button class="transcribeBtn">Transcribir</button>
                    <a href="${rec.url}" download="${rec.name}.wav" class="downloadLink">Descargar</a>
                </div>
                ${rec.transcript !== null 
                    ? `<div class="transcription-wrapper">
                         <p class="transcription">${rec.transcript}</p>
                         <button class="copyBtn">Copiar</button>
                       </div>` 
                    : `<p class="transcription-status"></p>`
                }
            `;
            recordingsList.appendChild(li);
        });
    }

    // Event Delegation para toda la lista (reproducir, buscar, transcribir, etc.)
    recordingsList.addEventListener('click', (e) => {
        const li = e.target.closest('li');
        if (!li) return;
        const id = Number(li.dataset.id);

        if (e.target.matches('.play-pause-btn')) handlePlayPause(id);
        if (e.target.matches('.progress-bar-wrapper')) handleSeek(e, id);
        if (e.target.matches('.transcribeBtn')) handleTranscribe(id, e.target);
        if (e.target.matches('.copyBtn')) handleCopy(id, e.target);
    });

    function handlePlayPause(id) {
        if (currentlyPlayingId === id && !audioPlayer.paused) {
            audioPlayer.pause();
            currentlyPlayingId = null;
        } else {
            const rec = recordings.find(r => r.id === id);
            if (currentlyPlayingId !== id) audioPlayer.src = rec.url;
            audioPlayer.play();
            currentlyPlayingId = id;
        }
        renderRecordings();
    }

    function handleSeek(e, id) {
        const rec = recordings.find(r => r.id === id);
        // Permitir buscar incluso si no se está reproduciendo, para empezar desde un punto
        if (currentlyPlayingId !== id) {
             audioPlayer.src = rec.url;
             currentlyPlayingId = id;
        }
        const progressBarWrapper = e.currentTarget;
        const clickX = e.offsetX;
        const width = progressBarWrapper.clientWidth;
        const duration = rec.duration;
        audioPlayer.currentTime = (clickX / width) * duration;
        if (audioPlayer.paused) audioPlayer.play(); // Si estaba pausado, empieza a reproducir
        renderRecordings();
    }

    async function handleTranscribe(id, button) {
        button.disabled = true;
        const statusP = button.closest('li').querySelector('.transcription-status');
        if (statusP) statusP.textContent = 'Transcribiendo...';
        
        try {
            const recording = recordings.find(r => r.id === id);
            const response = await fetch('/api/transcribe', { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: recording.blob });
            if (!response.ok) throw new Error(`Error del servidor: ${response.statusText}`);
            const data = await response.json();
            const transcriptText = data.results.channels[0].alternatives[0].transcript;
            recording.transcript = transcriptText || "(No se pudo transcribir texto)";
            renderRecordings();
        } catch (error) {
            console.error('Error al transcribir:', error);
            if (statusP) statusP.textContent = 'Error al transcribir.';
            button.disabled = false;
        }
    }

    async function handleCopy(id, button) {
        try {
            const recording = recordings.find(r => r.id === id);
            await navigator.clipboard.writeText(recording.transcript);
            button.textContent = '¡Copiado!';
            setTimeout(() => { button.textContent = 'Copiar'; }, 2000);
        } catch (err) {
            console.error('Error al copiar texto: ', err);
        }
    }

    // --- 6. EVENTOS DEL MOTOR DE AUDIO ---
    audioPlayer.addEventListener('timeupdate', () => {
        if (!currentlyPlayingId) return;
        const li = recordingsList.querySelector(`li[data-id='${currentlyPlayingId}']`);
        if (!li) return;
        const progress = li.querySelector('.progress');
        const timeDisplay = li.querySelector('.time-display');
        const { currentTime, duration } = audioPlayer;
        if (progress) progress.style.width = `${(currentTime / duration) * 100}%`;
        if (timeDisplay) timeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
    });

    audioPlayer.addEventListener('ended', () => {
        currentlyPlayingId = null;
        renderRecordings();
    });

    function formatTime(seconds) {
        const min = Math.floor(seconds / 60);
        const sec = Math.floor(seconds % 60).toString().padStart(2, '0');
        return isNaN(min) || isNaN(sec) ? '0:00' : `${min}:${sec}`;
    }

    // --- 7. LÓGICA DE BOTONES DE LIMPIEZA Y TEMA ---
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

    themeToggle.addEventListener('change', () => {
        document.body.classList.toggle('dark-mode', !themeToggle.checked);
        document.body.classList.toggle('light-mode', themeToggle.checked);
        localStorage.setItem('theme', themeToggle.checked ? 'light' : 'dark');
    });

    function loadTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'light') {
            themeToggle.checked = true;
            document.body.classList.remove('dark-mode');
            document.body.classList.add('light-mode');
        } else {
            themeToggle.checked = false; // Asegura el estado por defecto
            document.body.classList.add('dark-mode');
        }
    }
    
    // --- 8. INICIALIZACIÓN ---
    loadTheme();
    updateButtonStates(false, true, true); // Estado inicial de los botones
});