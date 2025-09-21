import { createClient } from "@deepgram/sdk";

export const config = {
  api: {
    bodyParser: false,
  },
};

async function getBuffer(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

  try {
    const audioBuffer = await getBuffer(req);

    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      audioBuffer,
      {
        model: 'nova-3',
        punctuate: true,
        // Al no especificar el parámetro "language", Deepgram
        // activará automáticamente la detección de idioma.
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