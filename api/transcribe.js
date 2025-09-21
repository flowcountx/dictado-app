import { createClient } from "@deepgram/sdk";

// --- NUEVO: CONFIGURACIÓN PARA VERCEL ---
// Esta línea es crucial. Le dice a Vercel que no procese el cuerpo (body)
// de la solicitud por nosotros. Queremos recibir el stream de datos crudo.
export const config = {
  api: {
    bodyParser: false,
  },
};

// --- NUEVO: FUNCIÓN AUXILIAR PARA OBTENER EL BUFFER ---
// Esta función toma la solicitud (req) y convierte el stream de audio
// en un objeto Buffer, que es el formato que Deepgram necesita.
async function getBuffer(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// El handler principal, ahora modificado
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

  try {
    // 1. Obtenemos el buffer de audio usando nuestra nueva función
    const audioBuffer = await getBuffer(req);

    // 2. Pasamos el buffer al SDK de Deepgram en lugar de req.body
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      audioBuffer, // ¡Aquí está el cambio principal!
      {
        model: 'nova-2',
        language: 'es-419',
        punctuate: true,
      }
    );

    if (error) {
      throw error;
    }

    res.status(200).json(result);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Hubo un problema con la transcripción.' });
  }
}