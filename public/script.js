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
    function handleStop() {
        if (!currentlyPlayingId) return;
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
    }
    function handleRewind() {
        if (!currentlyPlayingId) return;
        audioPlayer.currentTime = Math.max(0, audioPlayer.currentTime - settings.rewindSeconds);
    }
    function handleNext() {
        const sortedIds = getSortedIds();
        const currentIndex = sortedIds.indexOf(currentlyPlayingId);
        if (currentIndex < sortedIds.length - 1) {
            playRecording(sortedIds[currentIndex + 1]);
        }
    }
    function handlePrevious() {
        const sortedIds = getSortedIds();
        const currentIndex = sortedIds.indexOf(currentlyPlayingId);
        if (currentIndex > 0) {
            playRecording(sortedIds[currentIndex - 1]);
        }
    }
    
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
        if (e.target.closest('.progress-bar-wrapper')) handleSeek(e, id);
    });
    
    async function handleTranscribe(id, button) {
        const recording = recordings.find(r => r.id === id);
        button.disabled = true;
        const statusP = button.closest('li').querySelector('.transcription-status');
        if (statusP) statusP.textContent = 'Transcribiendo...';
        try {
            const response = await fetch('/api/transcribe', { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: recording.blob });
            if (!response.ok) throw new Error(`Error: ${response.statusText}`);
            const data = await response.json();
            recording.transcript = data.results.channels[0].alternatives[0].transcript || "(No se pudo transcribir)";
        } catch (error) { if (statusP) statusP.textContent = 'Error al transcribir.';
        } finally { renderRecordings(); }
    }
    async function handleCopy(id, button) {
        const recording = recordings.find(r => r.id === id);
        await navigator.clipboard.writeText(recording.transcript);
        button.textContent = '¡Copiado!';
        setTimeout(() => { button.textContent = 'Copiar'; }, 2000);
    }
    function handleSeek(e, id) {
        const recording = recordings.find(r => r.id === id);
        if (!recording) return;
        const progressBarWrapper = e.currentTarget.closest('.progress-bar-wrapper');
        const rect = progressBarWrapper.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const width = progressBarWrapper.clientWidth;
        seekToTime = (clickX / width) * recording.duration;
        playRecording(id);
    }

    // --- 7. LÓGICA DE REORDENAMIENTO Y ORDENACIÓN (CON CORRECCIÓN) ---
    recordingsList.addEventListener('dragstart', (e) => {
        const li = e.target.closest('li[data-id]');
        if (li) { draggedItemId = Number(li.dataset.id); e.target.classList.add('dragging'); }
    });
    recordingsList.addEventListener('dragend', (e) => e.target.classList.remove('dragging'));
    recordingsList.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(recordingsList, e.clientY);
        const dragging = document.querySelector('.dragging');
        if (dragging) {
            if (afterElement == null) { recordingsList.appendChild(dragging); } 
            else { recordingsList.insertBefore(dragging, afterElement); }
        }
    });
    recordingsList.addEventListener('drop', () => {
        // CORRECCIÓN CLAVE: Actualizamos el array de datos para que coincida con el nuevo orden del DOM
        const newOrderIds = [...recordingsList.querySelectorAll('li[data-id]')].map(li => Number(li.dataset.id));
        recordings.sort((a, b) => newOrderIds.indexOf(a.id) - newOrderIds.indexOf(b.id));

        // Desactivamos la ordenación automática al reordenar manualmente
        sortToggle.checked = false;
        settings.sortDesc = false;
        saveSettings();
    });
    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('li:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) { return { offset: offset, element: child }; } 
            else { return closest; }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
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
    function initShortcuts() {
        shortcutList.innerHTML = '';
        Object.entries(shortcutActions).forEach(([action, label]) => {
            const key = settings.shortcuts[action] || 'Sin asignar';
            shortcutList.innerHTML += `<div class="shortcut-item"><div class="shortcut-label">${label}:</div><div class="shortcut-key">${key}</div><button class="shortcut-set-btn" data-action="${action}">Establecer</button></div>`;
        });
    }
    shortcutList.addEventListener('click', (e) => {
        if (e.target.matches('.shortcut-set-btn')) {
            const action = e.target.dataset.action;
            if (listeningForShortcut === action) {
                listeningForShortcut = null;
                e.target.textContent = 'Establecer'; e.target.classList.remove('listening');
            } else {
                document.querySelectorAll('.shortcut-set-btn.listening').forEach(btn => { btn.classList.remove('listening'); btn.textContent = 'Establecer'; });
                listeningForShortcut = action;
                e.target.textContent = 'Escuchando...'; e.target.classList.add('listening');
            }
        }
    });
    window.addEventListener('keydown', (e) => {
        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT') return;
        if (listeningForShortcut) {
            e.preventDefault(); const key = e.code;
            Object.keys(settings.shortcuts).forEach(act => { if (settings.shortcuts[act] === key) delete settings.shortcuts[act]; });
            settings.shortcuts[listeningForShortcut] = key;
            saveSettings(); initShortcuts(); listeningForShortcut = null;
        } else {
            const action = Object.keys(settings.shortcuts).find(act => settings.shortcuts[act] === e.code);
            if (action) {
                e.preventDefault();
                const actionFunctions = { playPause: handlePlayPause, stop: handleStop, rewind: handleRewind, next: handleNext, previous: handlePrevious };
                if (actionFunctions[action]) actionFunctions[action]();
            }
        }
    });

    function loadSettings() {
        const saved = localStorage.getItem('playerSettings');
        const defaults = { speed: 1.0, repeat: 'none', rewindSeconds: 5, shortcuts: {}, sortDesc: true };
        settings = saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
        speedControl.value = settings.speed; speedValue.textContent = `${Number(settings.speed).toFixed(1)}x`; audioPlayer.playbackRate = settings.speed;
        repeatControl.value = settings.repeat; rewindControl.value = settings.rewindSeconds; sortToggle.checked = settings.sortDesc;
        audioPlayer.loop = (settings.repeat === 'one');
    }
    function saveSettings() { localStorage.setItem('playerSettings', JSON.stringify(settings)); }
    speedControl.addEventListener('input', e => { settings.speed = parseFloat(e.target.value); audioPlayer.playbackRate = settings.speed; speedValue.textContent = `${settings.speed.toFixed(1)}x`; saveSettings(); });
    repeatControl.addEventListener('change', e => { settings.repeat = e.target.value; audioPlayer.loop = (settings.repeat === 'one'); saveSettings(); });
    rewindControl.addEventListener('change', e => { settings.rewindSeconds = parseInt(e.target.value, 10) || 5; saveSettings(); });
    resetShortcutsButton.addEventListener('click', () => { if (confirm('¿Resetear toda la configuración?')) { localStorage.removeItem('playerSettings'); loadSettings(); initShortcuts(); } });

    // --- 9. EVENTOS DEL MOTOR DE AUDIO (CON CORRECCIONES) ---
    // CORRECCIÓN CLAVE: Nueva función ligera para actualizar la UI sin reconstruirla
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