// Importamos el SDK de Deepgram
import { createClient } from "@deepgram/sdk";

// Vercel requiere que exportemos una función handler por defecto
export default async function handler(req, res) {
  // Solo permitimos solicitudes de tipo POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // Creamos el cliente de Deepgram usando la clave secreta
  // ¡MUY IMPORTANTE! Esta clave la configuraremos en Vercel, no aquí.
  const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

  try {
    // La magia sucede aquí. Le pasamos el cuerpo de la solicitud (que es el audio)
    // a Deepgram para que lo transcriba.
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      req.body, // El audio viene en el cuerpo de la solicitud (req.body)
      {
        model: 'nova-2',
        language: 'es-419', // Coincide con tu captura de pantalla
        punctuate: true,
      }
    );

    if (error) {
      throw error;
    }

    // Si todo va bien, devolvemos el resultado como JSON
    res.status(200).json(result);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Hubo un problema con la transcripción.' });
  }
}