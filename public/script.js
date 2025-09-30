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
    let seekToTime = null; // NUEVA VARIABLE para manejar el salto en la barra
    const shortcutActions = {
        playPause: 'Reproducir/Pausar', rewind: 'Retroceder', stop: 'Detener',
        next: 'Siguiente', previous: 'Anterior'
    };

    // --- 3. LÓGICA DE GRABACIÓN Y CARGA ---
    // (Esta sección no cambia, es estable)
    recordButton.addEventListener('click', async () => { /* ... */ });
    pauseButton.addEventListener('click', () => { /* ... */ });
    stopButton.addEventListener('click', () => { /* ... */ });
    function updateButtonStates(isRecording, isPausedDisabled, isStopDisabled) { /* ... */ }
    dropZone.addEventListener('dragover', e => e.preventDefault());
    dropZone.addEventListener('drop', e => { e.preventDefault(); if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files); });
    fileInput.addEventListener('change', () => handleFiles(fileInput.files));
    function handleFiles(files) { /* ... */ }

    // --- 4. LÓGICA DEL REPRODUCTOR AVANZADO ---
    // (Esta sección no cambia, es estable)
    function playRecording(id) { /* ... */ }
    function handlePlayPause(idFromButton = null) { /* ... */ }
    function handleStop() { /* ... */ }
    function handleRewind() { /* ... */ }
    function handleNext() { /* ... */ }
    function handlePrevious() { /* ... */ }
    
    // --- 5. RENDERIZADO Y GESTIÓN DE LA LISTA ---
    function addRecordingToList(audioBlob, name) { /* ... */ }
    function renderRecordings() { /* ... (Sin cambios aquí) ... */ }

    // --- 6. LÓGICA DE EVENTOS DE LA LISTA (CON SEEK CORREGIDO) ---
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
        // CORRECCIÓN CLAVE: La barra de progreso ahora llama a handleSeek
        if (e.target.closest('.progress-bar-wrapper')) handleSeek(e, id);
    });
    
    async function handleTranscribe(id, button) { /* ... */ }
    async function handleCopy(id, button) { /* ... */ }
    
    // CORRECCIÓN CLAVE: Nueva lógica para la barra de avance (seek)
    function handleSeek(e, id) {
        const recording = recordings.find(r => r.id === id);
        if (!recording) return;

        const progressBarWrapper = e.currentTarget;
        const rect = progressBarWrapper.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const width = progressBarWrapper.clientWidth;
        const duration = recording.duration;
        
        // Guardamos el tiempo al que queremos saltar
        seekToTime = (clickX / width) * duration;

        // Reproducimos la grabación. El evento 'loadedmetadata' se encargará del salto.
        playRecording(id);
    }

    // --- 7. LÓGICA DE REORDENAMIENTO Y ORDENACIÓN ---
    // (Esta sección no cambia, es estable)
    recordingsList.addEventListener('dragstart', (e) => { /* ... */ });
    recordingsList.addEventListener('dragend', (e) => { /* ... */ });
    recordingsList.addEventListener('dragover', (e) => { /* ... */ });
    recordingsList.addEventListener('drop', () => { /* ... */ });
    function getDragAfterElement(container, y) { /* ... */ }
    sortToggle.addEventListener('change', e => { /* ... */ });
    function getSortedIds() { /* ... */ }

    // --- 8. ATRIBUTOS DE TECLADO Y CONFIGURACIÓN ---
    // (Esta sección no cambia, es estable)
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
    
    // CORRECCIÓN CLAVE: Evento para ejecutar el salto en la barra de progreso
    audioPlayer.addEventListener('loadedmetadata', () => {
        if (seekToTime !== null) {
            audioPlayer.currentTime = seekToTime;
            seekToTime = null; // Reseteamos la variable
        }
    });

    audioPlayer.addEventListener('play', updatePlayerUI);
    audioPlayer.addEventListener('pause', updatePlayerUI);
    
    // CORRECCIÓN CLAVE: Evento 'ended' ahora resetea la barra de progreso
    audioPlayer.addEventListener('ended', () => {
        const wasPlayingId = currentlyPlayingId;
        currentlyPlayingId = null;
        
        // Resetea la UI de la canción que terminó
        const finishedLi = recordingsList.querySelector(`li[data-id='${wasPlayingId}']`);
        if (finishedLi) {
            finishedLi.querySelector('.progress').style.width = '0%';
            finishedLi.querySelector('.current-time').textContent = '0:00';
        }
        updatePlayerUI(); // Actualiza los botones y resaltados

        // Lógica de repetición
        const sortedIds = getSortedIds();
        const lastIndex = sortedIds.indexOf(wasPlayingId);
        if (settings.repeat === 'one') {
            playRecording(wasPlayingId);
        } else if (settings.repeat === 'all' && lastIndex < sortedIds.length - 1) {
            handleNext();
        } else if (settings.repeat === 'all' && lastIndex === sortedIds.length - 1) {
            playRecording(sortedIds[0]);
        }
    });

    audioPlayer.addEventListener('timeupdate', () => {
        if (!currentlyPlayingId) return;
        const li = recordingsList.querySelector(`li[data-id='${currentlyPlayingId}']`);
        if (!li) return;
        const progress = li.querySelector('.progress');
        const currentTimeDisplay = li.querySelector('.current-time');
        const { currentTime, duration } = audioPlayer;
        if (progress) progress.style.width = `${(currentTime / duration) * 100}%`;
        if (currentTimeDisplay) currentTimeDisplay.textContent = formatTime(currentTime);
    });
    
    function formatTime(seconds) {
        const min = Math.floor(seconds / 60); const sec = Math.floor(seconds % 60).toString().padStart(2, '0');
        return isNaN(min) || isNaN(sec) ? '0:00' : `${min}:${sec}`;
    }

    clearAllButton.addEventListener('click', () => { if (recordings.length > 0 && confirm('¿Borrar TODAS las grabaciones?')) { recordings = []; renderRecordings(); } });
    clearTranscriptsButton.addEventListener('click', () => { recordings.forEach(rec => rec.transcript = null); renderRecordings(); });

    // --- 10. INICIALIZACIÓN ---
    function init() {
        loadSettings();
        initShortcuts();
        renderRecordings();
        updateButtonStates(false, true, true);
        loadTheme();
    }
    themeToggle.addEventListener('change', () => {
        document.body.classList.toggle('dark-mode', !themeToggle.checked);
        document.body.classList.toggle('light-mode', themeToggle.checked);
        localStorage.setItem('theme', themeToggle.checked ? 'light' : 'dark');
    });
    function loadTheme() {
        if (localStorage.getItem('theme') === 'light') {
            themeToggle.checked = true;
            document.body.classList.remove('dark-mode');
            document.body.classList.add('light-mode');
        }
    }
    init();
});