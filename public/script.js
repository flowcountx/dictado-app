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
    let recordings = [];
    let currentlyPlayingId = null;
    let settings = {};
    let listeningForShortcut = null;
    const shortcutActions = {
        playPause: 'Reproducir/Pausar',
        rewind: 'Retroceder',
        stop: 'Detener',
        next: 'Siguiente',
        previous: 'Anterior'
    };
    let draggedItemId = null;

    // --- 3. LÓGICA PRINCIPAL DEL REPRODUCTOR AVANZADO ---
    function playRecording(id) {
        const rec = recordings.find(r => r.id === id);
        if (!rec) return;
        audioPlayer.src = rec.url;
        audioPlayer.play();
        currentlyPlayingId = id;
        renderRecordings(); // Re-render para actualizar el estado de los botones
    }

    function handlePlayPause(idFromButton = null) {
        // Si se llama desde un atajo de teclado y no hay nada sonando, intenta reproducir el primero
        if (!currentlyPlayingId && !idFromButton) {
            if (recordings.length > 0) playRecording(recordings[0].id);
            return;
        }
        
        const targetId = idFromButton || currentlyPlayingId;
        
        if (currentlyPlayingId === targetId && !audioPlayer.paused) {
            audioPlayer.pause();
        } else {
            playRecording(targetId);
        }
    }

    function handleStop() {
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
    }

    function handleRewind() {
        if (!currentlyPlayingId) return;
        audioPlayer.currentTime = Math.max(0, audioPlayer.currentTime - settings.rewindSeconds);
    }

    function handleNext() {
        if (recordings.length === 0) return;
        const currentIndex = recordings.findIndex(r => r.id === currentlyPlayingId);
        if (currentIndex === -1 || currentIndex < recordings.length - 1) {
            const nextIndex = (currentIndex === -1) ? 0 : currentIndex + 1;
            playRecording(recordings[nextIndex].id);
        }
    }

    function handlePrevious() {
        if (recordings.length === 0) return;
        const currentIndex = recordings.findIndex(r => r.id === currentlyPlayingId);
        if (currentIndex > 0) {
            playRecording(recordings[currentIndex - 1].id);
        }
    }

    // --- 4. RENDERIZADO Y GESTIÓN DE LA LISTA ---
    function renderRecordings() {
        // Aplicar ordenación
        const sortedRecordings = [...recordings].sort((a, b) => {
            return settings.sortDesc ? b.id - a.id : a.id - b.id;
        });

        recordingsList.innerHTML = '';
        sortedRecordings.forEach(rec => {
            const isPlaying = rec.id === currentlyPlayingId && !audioPlayer.paused;
            const li = document.createElement('li');
            li.dataset.id = rec.id;
            li.draggable = true; // Hacer todos los items arrastrables
            li.innerHTML = `
                <div class="rec-info"><strong>${rec.name}</strong></div>
                <div class="custom-player">
                    <div class="player-controls">
                        <button class="previous-btn" title="Anterior">⏪</button>
                        <button class="rewind-btn" title="Retroceder ${settings.rewindSeconds}s">⎌</button>
                        <button class="play-pause-btn">${isPlaying ? '❚❚' : '▶'}</button>
                        <button class="stop-btn" title="Detener">⏹️</button>
                        <button class="next-btn" title="Siguiente">⏩</button>
                    </div>
                </div>
                <!-- ... (resto del HTML de la lista, como transcripciones) ... -->
            `;
            recordingsList.appendChild(li);
        });
    }
    
    // Delegación de eventos para los nuevos botones del reproductor
    recordingsList.addEventListener('click', (e) => {
        const li = e.target.closest('li[data-id]');
        if (!li) return;
        const id = Number(li.dataset.id);

        if (e.target.matches('.play-pause-btn')) handlePlayPause(id);
        if (e.target.matches('.stop-btn')) handleStop();
        if (e.target.matches('.rewind-btn')) handleRewind();
        if (e.target.matches('.next-btn')) handleNext();
        if (e.target.matches('.previous-btn')) handlePrevious();
        // ... (Aquí van los handlers de transcribir y copiar)
    });

    // --- 5. LÓGICA DE REORDENAMIENTO (DRAG & DROP) ---
    recordingsList.addEventListener('dragstart', (e) => {
        const li = e.target.closest('li[data-id]');
        if (li) {
            draggedItemId = Number(li.dataset.id);
            e.target.classList.add('dragging');
        }
    });

    recordingsList.addEventListener('dragend', (e) => {
        e.target.classList.remove('dragging');
    });
    
    recordingsList.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(recordingsList, e.clientY);
        const dragging = document.querySelector('.dragging');
        if (dragging) {
            if (afterElement == null) {
                recordingsList.appendChild(dragging);
            } else {
                recordingsList.insertBefore(dragging, afterElement);
            }
        }
    });
    
    recordingsList.addEventListener('drop', () => {
        const newOrderIds = [...recordingsList.querySelectorAll('li[data-id]')].map(li => Number(li.dataset.id));
        recordings.sort((a, b) => newOrderIds.indexOf(a.id) - newOrderIds.indexOf(b.id));
        // Desactivar la ordenación automática si el usuario reordena manualmente
        sortToggle.checked = false;
        settings.sortDesc = false;
        saveSettings();
        renderRecordings();
    });

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('li:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    sortToggle.addEventListener('change', e => {
        settings.sortDesc = e.target.checked;
        saveSettings();
        renderRecordings();
    });

    // --- 6. ATRIBUTOS DE TECLADO ---
    function initShortcuts() {
        shortcutList.innerHTML = '';
        Object.entries(shortcutActions).forEach(([action, label]) => {
            const key = settings.shortcuts[action] || 'Sin asignar';
            shortcutList.innerHTML += `
                <div class="shortcut-item">
                    <div class="shortcut-label">${label}:</div>
                    <div class="shortcut-key">${key}</div>
                    <button class="shortcut-set-btn" data-action="${action}">Establecer</button>
                </div>
            `;
        });
    }
    
    shortcutList.addEventListener('click', (e) => {
        if (e.target.matches('.shortcut-set-btn')) {
            const action = e.target.dataset.action;
            if (listeningForShortcut === action) {
                listeningForShortcut = null;
                e.target.textContent = 'Establecer';
                e.target.classList.remove('listening');
            } else {
                document.querySelectorAll('.shortcut-set-btn.listening').forEach(btn => {
                    btn.classList.remove('listening');
                    btn.textContent = 'Establecer';
                });
                listeningForShortcut = action;
                e.target.textContent = 'Escuchando...';
                e.target.classList.add('listening');
            }
        }
    });

    window.addEventListener('keydown', (e) => {
        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT') {
            return; // No ejecutar atajos si se está escribiendo en un input
        }

        if (listeningForShortcut) {
            e.preventDefault();
            const key = e.code;
            Object.keys(settings.shortcuts).forEach(act => {
                if (settings.shortcuts[act] === key) delete settings.shortcuts[act];
            });
            settings.shortcuts[listeningForShortcut] = key;
            saveSettings();
            initShortcuts();
            listeningForShortcut = null;
        } else {
            const action = Object.keys(settings.shortcuts).find(act => settings.shortcuts[act] === e.code);
            if (action) {
                e.preventDefault();
                const actionFunctions = {
                    playPause: handlePlayPause, stop: handleStop,
                    rewind: handleRewind, next: handleNext, previous: handlePrevious
                };
                if (actionFunctions[action]) actionFunctions[action]();
            }
        }
    });

    // --- 7. LÓGICA DE CONFIGURACIÓN Y PERSISTENCIA ---
    function loadSettings() {
        const saved = localStorage.getItem('playerSettings');
        const defaults = {
            speed: 1.0, repeat: 'none', rewindSeconds: 5,
            shortcuts: {}, sortDesc: true
        };
        settings = saved ? { ...defaults, ...JSON.parse(saved) } : defaults;

        speedControl.value = settings.speed;
        speedValue.textContent = `${Number(settings.speed).toFixed(1)}x`;
        audioPlayer.playbackRate = settings.speed;
        repeatControl.value = settings.repeat;
        rewindControl.value = settings.rewindSeconds;
        sortToggle.checked = settings.sortDesc;
        audioPlayer.loop = (settings.repeat === 'one');
    }
    function saveSettings() {
        localStorage.setItem('playerSettings', JSON.stringify(settings));
    }

    speedControl.addEventListener('input', e => {
        settings.speed = parseFloat(e.target.value);
        audioPlayer.playbackRate = settings.speed;
        speedValue.textContent = `${settings.speed.toFixed(1)}x`;
        saveSettings();
    });
    repeatControl.addEventListener('change', e => {
        settings.repeat = e.target.value;
        audioPlayer.loop = (settings.repeat === 'one');
        saveSettings();
    });
    rewindControl.addEventListener('change', e => {
        settings.rewindSeconds = parseInt(e.target.value, 10) || 5;
        saveSettings();
    });
    resetShortcutsButton.addEventListener('click', () => {
        if (confirm('¿Resetear toda la configuración del reproductor?')) {
            localStorage.removeItem('playerSettings');
            loadSettings();
            initShortcuts();
        }
    });

    // --- 8. EVENTOS DEL MOTOR DE AUDIO ---
    audioPlayer.addEventListener('play', () => renderRecordings());
    audioPlayer.addEventListener('pause', () => {
        if (currentlyPlayingId) { // Solo renderizar si algo estaba sonando
            const wasPlayingId = currentlyPlayingId;
            currentlyPlayingId = null;
            renderRecordings();
            currentlyPlayingId = wasPlayingId; // Mantener referencia por si se reanuda
        }
    });
    audioPlayer.addEventListener('ended', () => {
        const currentIndex = recordings.findIndex(r => r.id === currentlyPlayingId);
        currentlyPlayingId = null;
        if (settings.repeat === 'all' && currentIndex < recordings.length - 1) {
            handleNext();
        } else if (settings.repeat === 'all' && currentIndex === recordings.length - 1) {
            playRecording(recordings[0].id); // Volver al principio
        } else {
            renderRecordings();
        }
    });

    // (Aquí irían el resto de funciones estables que ya teníamos, como las de grabación,
    // carga de archivos, limpieza, tema, transcripción, etc.)

    // --- 9. INICIALIZACIÓN ---
    loadSettings();
    initShortcuts();
    renderRecordings();
});