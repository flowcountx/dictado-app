// Seleccionamos los elementos del HTML con los que vamos a interactuar
const recordButton = document.getElementById('recordButton');
const pauseButton = document.getElementById('pauseButton');
const stopButton = document.getElementById('stopButton');
const statusDiv = document.getElementById('status');
const audioPlayer = document.getElementById('audioPlayer');
const recordingsList = document.getElementById('recordingsList');

// Variables para manejar el estado de la grabación
let mediaRecorder;
let audioChunks = [];
let recordings = []; // Un array para guardar todas nuestras grabaciones

// --- Lógica de Grabación ---

// Al hacer clic en "Grabar"
recordButton.addEventListener('click', async () => {
    // Pedimos permiso para usar el micrófono
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);

    // Cuando el grabador tenga datos, los guardamos
    mediaRecorder.ondataavailable = event => {
        audioChunks.push(event.data);
    };

    // Cuando la grabación se detiene, procesamos el audio
    mediaRecorder.onstop = () => {
        // Creamos un "Blob", que es como un archivo en memoria
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(audioBlob);

        // Guardamos la grabación en nuestro array
        const recording = {
            id: new Date().getTime(),
            url: audioUrl,
            blob: audioBlob,
            transcript: null,
        };
        recordings.push(recording);
        renderRecordings();

        // Limpiamos los "trozos" para la próxima grabación
        audioChunks = [];
    };

    // Empezamos a grabar y actualizamos la UI
    mediaRecorder.start();
    statusDiv.textContent = 'Grabando...';
    updateButtonStates(true, false, false);
});

// Al hacer clic en "Pausar"
pauseButton.addEventListener('click', () => {
    if (mediaRecorder.state === 'recording') {
        mediaRecorder.pause();
        statusDiv.textContent = 'Pausado';
        pauseButton.textContent = 'Reanudar';
    } else if (mediaRecorder.state === 'paused') {
        mediaRecorder.resume();
        statusDiv.textContent = 'Grabando...';
        pauseButton.textContent = 'Pausar';
    }
});

// Al hacer clic en "Detener"
stopButton.addEventListener('click', () => {
    mediaRecorder.stop();
    statusDiv.textContent = 'Grabación detenida. Presiona "Grabar" para empezar una nueva.';
    updateButtonStates(false, true, true);
    pauseButton.textContent = 'Pausar';
});


// --- Lógica de la Interfaz ---

// Función para actualizar el estado de los botones (habilitado/deshabilitado)
function updateButtonStates(isRecording, isPaused, isStopped) {
    recordButton.disabled = isRecording;
    pauseButton.disabled = isPaused;
    stopButton.disabled = isStopped;
}

// Función para dibujar la lista de grabaciones en la pantalla
function renderRecordings() {
    recordingsList.innerHTML = ''; // Limpiamos la lista actual
    recordings.forEach((rec, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>Grabación #${index + 1}</span>
            <div class="actions">
                <button class="playBtn" data-id="${rec.id}">Reproducir</button>
                <button class="transcribeBtn" data-id="${rec.id}">Transcribir</button>
                <a href="${rec.url}" download="grabacion-${rec.id}.wav" class="downloadLink">Descargar</a>
            </div>
            ${rec.transcript ? `<p class="transcription">${rec.transcript}</p>` : '<p class="transcription-status" data-id="' + rec.id + '"></p>'}
        `;
        recordingsList.appendChild(li);
    });
}

// --- Lógica de Transcripción y Reproducción ---

// Agregamos un listener a la lista entera para manejar clics en los botones de "Reproducir" y "Transcribir"
recordingsList.addEventListener('click', async (event) => {
    const target = event.target;
    const id = Number(target.getAttribute('data-id'));

    // Si se hizo clic en "Reproducir"
    if (target.classList.contains('playBtn')) {
        const recording = recordings.find(r => r.id === id);
        audioPlayer.src = recording.url;
        audioPlayer.play();
    }

    // Si se hizo clic en "Transcribir"
    if (target.classList.contains('transcribeBtn')) {
        const recording = recordings.find(r => r.id === id);
        
        // Deshabilitamos el botón para no enviarlo múltiples veces
        target.disabled = true;
        const statusP = document.querySelector(`.transcription-status[data-id="${id}"]`);
        if (statusP) statusP.textContent = 'Transcribiendo, por favor espera...';

        try {
            // Enviamos el audio al backend
            const response = await fetch('/api/transcribe', {
                method: 'POST',
                headers: { 'Content-Type': 'audio/wav' },
                body: recording.blob
            });

            if (!response.ok) {
                throw new Error('El servidor respondió con un error.');
            }

            const data = await response.json();
            // Extraemos el texto de la respuesta de Deepgram
            const transcriptText = data.results.channels[0].alternatives[0].transcript;
            
            // Actualizamos nuestra grabación y volvemos a dibujar la lista
            recording.transcript = transcriptText;
            renderRecordings();

        } catch (error) {
            console.error('Error al transcribir:', error);
            if (statusP) statusP.textContent = 'Error al transcribir. Inténtalo de nuevo.';
            target.disabled = false; // Habilitamos el botón de nuevo si hay un error
        }
    }
});