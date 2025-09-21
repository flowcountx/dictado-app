document.addEventListener('DOMContentLoaded', () => {
    // --- 1. SELECCIÓN DE ELEMENTOS DEL DOM ---
    const recordButton = document.getElementById('recordButton');
    const pauseButton = document.getElementById('pauseButton');
    const stopButton = document.getElementById('stopButton');
    const statusDiv = document.getElementById('status');
    const audioPlayer = document.getElementById('audioPlayer'); // Nuestro motor de audio oculto
    const recordingsList = document.getElementById('recordingsList');
    // ... (El resto de selectores no cambian)

    // --- 2. VARIABLES DE ESTADO ---
    let mediaRecorder;
    let audioChunks = [];
    let recordings = [];
    let currentlyPlayingId = null;

    // --- 4. LÓGICA DE GRABACIÓN (CON BUG CORREGIDO) ---
    recordButton.addEventListener('click', async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // setupVisualizer(stream); // Visualizador opcional
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            // Nombre de archivo mejorado con fecha y hora
            const name = `Grabación - ${new Date().toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}`;
            addRecordingToList(audioBlob, name);
            audioChunks = [];
            // stopVisualizer();
            stream.getTracks().forEach(track => track.stop());
        };
        mediaRecorder.start();
        statusDiv.textContent = 'Grabando...';
        // CORRECCIÓN DEL BUG: Actualizamos el estado de los botones aquí
        updateButtonStates(true, false, false);
    });

    pauseButton.addEventListener('click', () => {
        if (mediaRecorder.state === 'recording') {
            mediaRecorder.pause();
            statusDiv.textContent = 'Pausado';
        } else if (mediaRecorder.state === 'paused') {
            mediaRecorder.resume();
            statusDiv.textContent = 'Grabando...';
        }
    });

    stopButton.addEventListener('click', () => {
        mediaRecorder.stop();
        statusDiv.textContent = 'Grabación detenida. Presiona "Grabar" para empezar.';
        updateButtonStates(false, true, true);
    });

    function updateButtonStates(isRecording, isPausedDisabled, isStopDisabled) {
        recordButton.disabled = isRecording;
        pauseButton.disabled = isPausedDisabled;
        stopButton.disabled = isStopDisabled;
    }

    // --- 6. GESTIÓN DE LA LISTA Y REPRODUCTOR PERSONALIZADO ---
    function addRecordingToList(audioBlob, name) {
        const url = URL.createObjectURL(audioBlob);
        recordings.push({ id: Date.now(), name, url, blob: audioBlob, transcript: null, duration: 0 });
        renderRecordings();
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
                    <div class="time-display">${formatTime(0)} / ${formatTime(rec.duration)}</div>
                </div>
                <div class="actions" style="margin-top: 10px;">
                    <button class="transcribeBtn">Transcribir</button>
                    <a href="${rec.url}" download="${rec.name}.wav" class="downloadLink">Descargar</a>
                </div>
                ${rec.transcript ? `<div class="transcription-wrapper">...</div>` : `<p class="transcription-status"></p>`}
            `;
            recordingsList.appendChild(li);
        });
    }

    recordingsList.addEventListener('click', (e) => {
        const li = e.target.closest('li');
        if (!li) return;
        const id = Number(li.dataset.id);

        if (e.target.matches('.play-pause-btn')) handlePlayPause(id);
        if (e.target.matches('.progress-bar-wrapper')) handleSeek(e, id);
        // ... (Aquí iría la lógica para los botones de transcribir, copiar, etc.)
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
        if (currentlyPlayingId !== id) return; // Solo buscar en la pista actual
        const progressBarWrapper = e.currentTarget;
        const clickX = e.offsetX;
        const width = progressBarWrapper.clientWidth;
        const duration = audioPlayer.duration;
        audioPlayer.currentTime = (clickX / width) * duration;
    }

    // --- 7. EVENTOS DEL MOTOR DE AUDIO ---
    audioPlayer.addEventListener('loadedmetadata', () => {
        const rec = recordings.find(r => r.id === currentlyPlayingId);
        if (rec) {
            rec.duration = audioPlayer.duration;
            updatePlayerUI(rec.id);
        }
    });

    audioPlayer.addEventListener('timeupdate', () => {
        updatePlayerUI(currentlyPlayingId);
    });

    audioPlayer.addEventListener('ended', () => {
        currentlyPlayingId = null;
        renderRecordings();
    });
    
    function updatePlayerUI(id) {
        if (!id) return;
        const li = recordingsList.querySelector(`li[data-id='${id}']`);
        if (!li) return;
        const progress = li.querySelector('.progress');
        const timeDisplay = li.querySelector('.time-display');
        const { currentTime, duration } = audioPlayer;
        progress.style.width = `${(currentTime / duration) * 100}%`;
        timeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
    }

    function formatTime(seconds) {
        const min = Math.floor(seconds / 60);
        const sec = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${min}:${sec}`;
    }

    // --- INICIALIZACIÓN ---
    // (Asegúrate de tener tus funciones init(), loadTheme(), etc. aquí)
});