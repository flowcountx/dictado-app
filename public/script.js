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
    const speedControl = document.getElementById('speedControl');
    const speedValue = document.getElementById('speedValue');
    const repeatControl = document.getElementById('repeatControl');
    const rewindControl = document.getElementById('rewindControl');
    const shortcutList = document.getElementById('shortcutList');
    const resetShortcutsButton = document.getElementById('resetShortcutsButton');
    const sortToggle = document.getElementById('sortToggle');

    // --- 2. VARIABLES DE ESTADO Y CONFIGURACIÓN ---
    let mediaRecorder;
    let audioChunks = [];
    let recordings = [];
    let currentlyPlayingId = null;
    let settings = {};
    let listeningForShortcut = null;
    let seekToTime = null;
    const shortcutActions = {
        playPause: 'Reproducir/Pausar', rewind: 'Retroceder', stop: 'Detener',
        next: 'Siguiente', previous: 'Anterior'
    };

    // --- 3. LÓGICA DE GRABACIÓN Y CARGA ---
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
        } catch (err) { statusDiv.textContent = 'Error: No se pudo acceder al micrófono.'; }
    });
    pauseButton.addEventListener('click', () => {
        if (!mediaRecorder) return;
        if (mediaRecorder.state === 'recording') { mediaRecorder.pause(); statusDiv.textContent = 'Pausado'; } 
        else if (mediaRecorder.state === 'paused') { mediaRecorder.resume(); statusDiv.textContent = 'Grabando...'; }
    });
    stopButton.addEventListener('click', () => {
        if (!mediaRecorder) return;
        mediaRecorder.stop();
        statusDiv.textContent = 'Grabación detenida.';
        updateButtonStates(false, true, true);
    });
    function updateButtonStates(isRecording, isPausedDisabled, isStopDisabled) {
        recordButton.disabled = isRecording;
        pauseButton.disabled = isPausedDisabled;
        stopButton.disabled = isStopDisabled;
    }
    dropZone.addEventListener('dragover', e => e.preventDefault());
    dropZone.addEventListener('drop', e => { e.preventDefault(); if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files); });
    fileInput.addEventListener('change', () => handleFiles(fileInput.files));
    function handleFiles(files) {
        Array.from(files).filter(file => file.type.startsWith('audio/')).forEach(file => {
            addRecordingToList(file, file.name);
        });
    }

    // --- 4. LÓGICA DEL REPRODUCTOR AVANZADO (CON CORRECCIONES) ---
    function playRecording(id) {
        const rec = recordings.find(r => r.id === id);
        if (!rec) return;
        if (currentlyPlayingId !== id) {
            audioPlayer.src = rec.url;
        }
        audioPlayer.play();
        currentlyPlayingId = id;
    }

    function handlePlayPause(idFromButton = null) {
        const targetId = idFromButton || currentlyPlayingId;
        if (!targetId) {
            const sortedIds = getSortedIds();
            if (sortedIds.length > 0) playRecording(sortedIds[0]);
            return;
        }
        if (currentlyPlayingId === targetId && !audioPlayer.paused) {
            audioPlayer.pause();
        } else {
            playRecording(targetId);
        }
    }
    function handleStop() { /* ... */ }
    function handleRewind() { /* ... */ }
    function handleNext() { /* ... */ }
    function handlePrevious() { /* ... */ }
    
    // --- 5. RENDERIZADO Y GESTIÓN DE LA LISTA ---
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
        let recordingsToRender = [...recordings];
        if (settings.sortDesc) {
            recordingsToRender.sort((a, b) => b.id - a.id);
        }
        recordingsList.innerHTML = '';
        recordingsToRender.forEach(rec => {
            const isPlaying = rec.id === currentlyPlayingId && !audioPlayer.paused;
            const li = document.createElement('li');
            li.dataset.id = rec.id;
            li.draggable = true;
            if (rec.id === currentlyPlayingId) li.classList.add('playing');
            li.innerHTML = `
                <div class="rec-info"><strong>${rec.name}</strong></div>
                <div class="player-container">
                    <div class="progress-container">
                        <div class="time-display current-time">0:00</div>
                        <div class="progress-bar-wrapper">
                            <div class="progress-bar"><div class="progress"></div></div>
                        </div>
                        <div class="time-display total-time">${formatTime(rec.duration)}</div>
                    </div>
                    <div class="player-controls">
                        <button class="previous-btn" title="Anterior">⏪</button>
                        <button class="rewind-btn" title="Retroceder ${settings.rewindSeconds}s">⎌</button>
                        <button class="play-pause-btn">${isPlaying ? '❚❚' : '▶'}</button>
                        <button class="stop-btn" title="Detener">⏹️</button>
                        <button class="next-btn" title="Siguiente">⏩</button>
                    </div>
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

    // --- 6. LÓGICA DE EVENTOS DE LA LISTA ---
    recordingsList.addEventListener('click', (e) => {
        const li = e.target.closest('li[data-id]');
        if (!li) return;
        const id = Number(li.dataset.id);

        if (e.target.matches('.play-pause-btn')) handlePlayPause(id);
        if (e.target.matches('.stop-btn')) handleStop();
        if (e.target.matches('.rewind-btn')) handleRewind();
        if (e.target.matches('.next-btn')) handleNext();
        if (e.target.matches('.previous-btn')) handlePrevious();
        if (e.target.matches('.transcribeBtn')) handleTranscribe(id, e.target);
        if (e.target.matches('.copyBtn')) handleCopy(id, e.target);
        if (e.target.closest('.progress-bar-wrapper')) handleSeek(e.target.closest('.progress-bar-wrapper'), id);
    });
    
    async function handleTranscribe(id, button) { /* ... */ }
    async function handleCopy(id, button) { /* ... */ }
    
    function handleSeek(progressBarWrapper, id) {
        const recording = recordings.find(r => r.id === id);
        if (!recording) return;
        const rect = progressBarWrapper.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const width = progressBarWrapper.clientWidth;
        seekToTime = (clickX / width) * recording.duration;
        playRecording(id);
    }

    // --- 7. LÓGICA DE REORDENAMIENTO Y ORDENACIÓN ---
    recordingsList.addEventListener('dragstart', (e) => { /* ... */ });
    recordingsList.addEventListener('dragend', (e) => { /* ... */ });
    recordingsList.addEventListener('dragover', (e) => { /* ... */ });
    recordingsList.addEventListener('drop', () => {
        const newOrderIds = [...recordingsList.querySelectorAll('li[data-id]')].map(li => Number(li.dataset.id));
        recordings.sort((a, b) => newOrderIds.indexOf(a.id) - newOrderIds.indexOf(b.id));
        sortToggle.checked = false;
        settings.sortDesc = false;
        saveSettings();
    });
    function getDragAfterElement(container, y) { /* ... */ }
    sortToggle.addEventListener('change', e => {
        settings.sortDesc = e.target.checked;
        saveSettings();
        renderRecordings();
    });
    function getSortedIds() {
        if (settings.sortDesc) {
            return [...recordings].sort((a,b) => b.id - a.id).map(r => r.id);
        }
        return recordings.map(r => r.id);
    }

    // --- 8. ATRIBUTOS DE TECLADO Y CONFIGURACIÓN ---
    function initShortcuts() { /* ... */ }
    shortcutList.addEventListener('click', (e) => { /* ... */ });
    window.addEventListener('keydown', (e) => { /* ... */ });
    function loadSettings() { /* ... */ }
    function saveSettings() { /* ... */ }
    speedControl.addEventListener('input', e => { /* ... */ });
    repeatControl.addEventListener('change', e => { /* ... */ });
    rewindControl.addEventListener('change', e => { /* ... */ });
    resetShortcutsButton.addEventListener('click', () => { /* ... */ });

    // --- 9. EVENTOS DEL MOTOR DE AUDIO (CON CORRECCIONES) ---
    function updatePlayerUI() {
        for (const li of recordingsList.children) {
            const id = Number(li.dataset.id);
            const playPauseBtn = li.querySelector('.play-pause-btn');
            const isPlaying = id === currentlyPlayingId && !audioPlayer.paused;
            li.classList.toggle('playing', isPlaying);
            if(playPauseBtn) playPauseBtn.textContent = isPlaying ? '❚❚' : '▶';
        }
    }
    
    audioPlayer.addEventListener('loadedmetadata', () => {
        if (seekToTime !== null) {
            audioPlayer.currentTime = seekToTime;
            seekToTime = null;
        }
    });
    audioPlayer.addEventListener('play', updatePlayerUI);
    audioPlayer.addEventListener('pause', updatePlayerUI);
    audioPlayer.addEventListener('ended', () => {
        const wasPlayingId = currentlyPlayingId;
        currentlyPlayingId = null;
        
        const finishedLi = recordingsList.querySelector(`li[data-id='${wasPlayingId}']`);
        if (finishedLi) {
            finishedLi.querySelector('.progress').style.width = '0%';
            finishedLi.querySelector('.current-time').textContent = '0:00';
        }
        updatePlayerUI();

        const sortedIds = getSortedIds();
        const lastIndex = sortedIds.indexOf(wasPlayingId);
        if (settings.repeat === 'one') { playRecording(wasPlayingId); }
        else if (settings.repeat === 'all' && lastIndex < sortedIds.length - 1) { handleNext(); }
        else if (settings.repeat === 'all' && lastIndex === sortedIds.length - 1) { playRecording(sortedIds[0]); }
    });
    audioPlayer.addEventListener('timeupdate', () => { /* ... */ });
    function formatTime(seconds) { /* ... */ }
    clearAllButton.addEventListener('click', () => { /* ... */ });
    clearTranscriptsButton.addEventListener('click', () => { /* ... */ });

    // --- 10. INICIALIZACIÓN ---
    function init() { /* ... */ }
    themeToggle.addEventListener('change', () => { /* ... */ });
    function loadTheme() { /* ... */ }
    init();
});