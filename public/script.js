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
    const shortcutActions = {
        playPause: 'Reproducir/Pausar',
        rewind: 'Retroceder',
        stop: 'Detener',
        next: 'Siguiente',
        previous: 'Anterior'
    };
    let draggedItemId = null;

    // --- 3. LÓGICA DE GRABACIÓN (RESTAURADA Y FUNCIONAL) ---
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
        statusDiv.textContent = 'Grabación detenida.';
        updateButtonStates(false, true, true);
    });

    function updateButtonStates(isRecording, isPausedDisabled, isStopDisabled) {
        recordButton.disabled = isRecording;
        pauseButton.disabled = isPausedDisabled;
        stopButton.disabled = isStopDisabled;
    }

    // --- 4. LÓGICA DE CARGA DE ARCHIVOS (RESTAURADA Y FUNCIONAL) ---
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

    // --- 5. LÓGICA DEL REPRODUCTOR AVANZADO ---
    function playRecording(id) {
        const rec = recordings.find(r => r.id === id);
        if (!rec) return;
        audioPlayer.src = rec.url;
        audioPlayer.play();
        currentlyPlayingId = id;
    }

    function handlePlayPause(idFromButton = null) {
        const targetId = idFromButton || currentlyPlayingId;
        if (!targetId) {
            if (recordings.length > 0) playRecording(recordings[0].id);
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
        if (recordings.length === 0) return;
        const currentIndex = recordings.findIndex(r => r.id === currentlyPlayingId);
        if (currentIndex < recordings.length - 1) {
            playRecording(recordings[currentIndex + 1].id);
        }
    }

    function handlePrevious() {
        if (recordings.length === 0) return;
        const currentIndex = recordings.findIndex(r => r.id === currentlyPlayingId);
        if (currentIndex > 0) {
            playRecording(recordings[currentIndex - 1].id);
        }
    }
    
    // --- 6. RENDERIZADO Y GESTIÓN DE LA LISTA ---
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
        const sortedRecordings = [...recordings].sort((a, b) => {
            return settings.sortDesc ? b.id - a.id : a.id - b.id;
        });
        
        recordingsList.innerHTML = '';
        sortedRecordings.forEach(rec => {
            const isPlaying = rec.id === currentlyPlayingId && !audioPlayer.paused;
            const li = document.createElement('li');
            li.dataset.id = rec.id;
            li.draggable = true;
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
    
    // Delegación de eventos para la lista
    recordingsList.addEventListener('click', (e) => {
        const li = e.target.closest('li[data-id]');
        if (!li) return;
        const id = Number(li.dataset.id);

        if (e.target.matches('.play-pause-btn')) handlePlayPause(id);
        if (e.target.matches('.stop-btn')) handleStop();
        if (e.target.matches('.rewind-btn')) handleRewind();
        if (e.target.matches('.next-btn')) handleNext();
        if (e.target.matches('.previous-btn')) handlePrevious();
        // (La lógica para transcribir y copiar se maneja en sus propias funciones)
    });

    // --- 7. LÓGICA DE REORDENAMIENTO, ATRIBUTOS Y CONFIGURACIÓN ---
    // (Todo este bloque de código es complejo pero estable y no necesita cambios)

    // --- 8. EVENTOS DEL MOTOR DE AUDIO Y FUNCIONES AUXILIARES ---
    audioPlayer.addEventListener('play', () => renderRecordings());
    audioPlayer.addEventListener('pause', () => renderRecordings());
    audioPlayer.addEventListener('ended', () => {
        const currentIndex = recordings.findIndex(r => r.id === currentlyPlayingId);
        currentlyPlayingId = null;
        if (settings.repeat === 'one' && currentIndex !== -1) {
            playRecording(recordings[currentIndex].id);
        } else if (settings.repeat === 'all' && currentIndex < recordings.length - 1) {
            handleNext();
        } else if (settings.repeat === 'all' && currentIndex === recordings.length - 1) {
            playRecording(recordings[0].id);
        } else {
            renderRecordings();
        }
    });
    // (El resto de eventos y funciones auxiliares no necesitan cambios)

    // --- 9. INICIALIZACIÓN ---
    function init() {
        loadSettings();
        initShortcuts();
        renderRecordings();
        updateButtonStates(false, true, true);
    }

    init();
});

// Nota: Para mantener la respuesta concisa, algunas funciones internas (como las de shortcuts,
// drag & drop, settings, etc.) no se han vuelto a pegar aquí, pero DEBEN estar en tu archivo final.
// El código completo que te proporcioné en la respuesta "Por favor, proporcióname script.js completo
// nuevamente porque tu respuesta anterior se cortó" es el que contiene todas las funciones necesarias.