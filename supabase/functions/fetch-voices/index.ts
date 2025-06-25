const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get ElevenLabs API key from environment
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");

    if (!ELEVENLABS_API_KEY) {
      return new Response(JSON.stringify({ error: "ElevenLabs API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch available voices from ElevenLabs
    const response = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status}`);
    }

    const data = await response.json();

    // Extract and format voice information
    const voices =
      data.voices?.map((voice: any) => ({
        id: voice.voice_id,
        name: voice.name,
        description:
          voice.description ||
          `${voice.labels?.gender || "Unknown"} voice${voice.labels?.age ? `, ${voice.labels.age}` : ""}`,
        category: voice.category,
        labels: voice.labels,
        preview_url: voice.preview_url,
      })) || [];

    // Sort voices by category and name
    const sortedVoices = voices.sort((a: any, b: any) => {
      if (a.category !== b.category) {
        return a.category === "premade" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return new Response(JSON.stringify({ voices: sortedVoices }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching voices:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch voices",
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
