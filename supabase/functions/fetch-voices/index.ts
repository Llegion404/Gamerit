import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  description?: string;
  category: string;
  labels?: {
    gender?: string;
    age?: string;
  };
  preview_url?: string;
}

interface FormattedVoice {
  id: string;
  name: string;
  description: string;
  category: string;
  labels?: {
    gender?: string;
    age?: string;
  };
  preview_url?: string;
}

serve(async (req: Request) => {
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

    console.log("ElevenLabs API key exists:", !!ELEVENLABS_API_KEY);

    if (!ELEVENLABS_API_KEY) {
      console.error("ElevenLabs API key not found in environment");
      return new Response(JSON.stringify({ error: "ElevenLabs API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch available voices from ElevenLabs
    console.log("Attempting to fetch voices from ElevenLabs API");
    const response = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
    });

    console.log("ElevenLabs API response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs API error:", response.status, errorText);
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Extract and format voice information
    const voices: FormattedVoice[] =
      data.voices?.map((voice: ElevenLabsVoice) => ({
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
    const sortedVoices = voices.sort((a: FormattedVoice, b: FormattedVoice) => {
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
