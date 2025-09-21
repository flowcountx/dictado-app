document.addEventListener('DOMContentLoaded', () => {
    // --- 1. SELECCIÓN DE ELEMENTOS DEL DOM (COMPLETO) ---
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

    // --- 2. VARIABLES DE ESTADO ---
    let mediaRecorder;
    let audioChunks = [];
    let recordings = [];
    let currentlyPlayingId = null;

    // --- 3. LÓGICA DE GRABACIÓN (ESTABLE) ---
    recordButton.addEventListener('click', async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.ondataavailable = event => audioChunks.push(event.data);
            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                const name = `Grabación - ${new Date().toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}`;
                addRecordingToList(audioBlob, name);
                audioChunks = [];
                stream.getTracks().forEach(track => track.stop());
            };
            mediaRecorder.start();
            statusDiv.textContent = 'Grabando...';
            updateButtonStates(true, false, false);
        } catch (err) {
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
        statusDiv.textContent = 'Grabación detenida. Presiona "Grabar".';
        updateButtonStates(false, true, true);
    });

    function updateButtonStates(isRecording, isPausedDisabled, isStopDisabled) {
        recordButton.disabled = isRecording;
        pauseButton.disabled = isPausedDisabled;
        stopButton.disabled = isStopDisabled;
    }

    // --- 4. LÓGICA DE CARGA DE ARCHIVOS (RESTAURADA) ---
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
        const tempAudio = new Audio(url);
        tempAudio.addEventListener('loadedmetadata', () => {
            recordings.push({ 
                id: Date.now(), name, url, blob: audioBlob, 
                transcript: null, duration: tempAudio.duration 
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
    
    // CORRECCIÓN CLAVE: Lógica de eventos unificada y robusta
    recordingsList.addEventListener('click', (e) => {
        const li = e.target.closest('li');
        if (!li) return;
        const id = Number(li.dataset.id);
        const recording = recordings.find(r => r.id === id);
        if (!recording) return;

        if (e.target.matches('.play-pause-btn')) handlePlayPause(id, recording);
        if (e.target.matches('.progress-bar-wrapper')) handleSeek(e, id, recording);
        if (e.target.matches('.transcribeBtn')) handleTranscribe(id, e.target, recording);
        if (e.target.matches('.copyBtn')) handleCopy(id, e.target, recording);
    });

    function handlePlayPause(id, recording) {
        if (currentlyPlayingId === id && !audioPlayer.paused) {
            audioPlayer.pause();
        } else {
            if (currentlyPlayingId !== id) audioPlayer.src = recording.url;
            audioPlayer.play();
            currentlyPlayingId = id;
        }
    }

    function handleSeek(e, id, recording) {
        if (currentlyPlayingId !== id) {
            audioPlayer.src = recording.url;
            currentlyPlayingId = id;
        }
        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const width = e.currentTarget.clientWidth;
        audioPlayer.currentTime = (clickX / width) * recording.duration;
        if (audioPlayer.paused) audioPlayer.play();
    }

    async function handleTranscribe(id, button, recording) {
        button.disabled = true;
        const statusP = button.closest('li').querySelector('.transcription-status');
        if (statusP) statusP.textContent = 'Transcribiendo...';
        
        try {
            const response = await fetch('/api/transcribe', { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: recording.blob });
            if (!response.ok) throw new Error(`Error: ${response.statusText}`);
            const data = await response.json();
            recording.transcript = data.results.channels[0].alternatives[0].transcript || "(No se pudo transcribir)";
        } catch (error) {
            if (statusP) statusP.textContent = 'Error al transcribir.';
        } finally {
            renderRecordings();
        }
    }

    async function handleCopy(id, button, recording) {
        await navigator.clipboard.writeText(recording.transcript);
        button.textContent = '¡Copiado!';
        setTimeout(() => { button.textContent = 'Copiar'; }, 2000);
    }

    // --- 6. EVENTOS DEL MOTOR DE AUDIO ---
    audioPlayer.addEventListener('play', () => renderRecordings());
    audioPlayer.addEventListener('pause', () => {
        currentlyPlayingId = null;
        renderRecordings();
    });
    audioPlayer.addEventListener('ended', () => {
        currentlyPlayingId = null;
        renderRecordings();
    });
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

    function formatTime(seconds) {
        const min = Math.floor(seconds / 60);
        const sec = Math.floor(seconds % 60).toString().padStart(2, '0');
        return isNaN(min) || isNaN(sec) ? '0:00' : `${min}:${sec}`;
    }

    // --- 7. BOTONES DE LIMPIEZA Y TEMA (RESTAURADOS) ---
    clearAllButton.addEventListener('click', () => {
        if (recordings.length > 0 && confirm('¿Estás seguro? Se borrarán TODAS las grabaciones.')) {
            recordings = [];
            renderRecordings();
        }
    });
    
    clearTranscriptsButton.addEventListener('click', () => {
        recordings.forEach(rec => rec.transcript = null);
        renderRecordings();
    });

    themeToggle.addEventListener('change', () => {
        document.body.classList.toggle('dark-mode', !themeToggle.checked);
        document.body.classList.toggle('light-mode', themeToggle.checked);
        localStorage.setItem('theme', themeToggle.checked ? 'light' : 'dark');
    });

    function loadTheme() {
        if (localStorage.getItem('theme') === 'light') {
            themeToggle.checked = true;
            document.body.classList.add('light-mode');
            document.body.classList.remove('dark-mode');
        }
    }
    
    // --- 8. INICIALIZACIÓN ---
    loadTheme();
    updateButtonStates(false, true, true);
});