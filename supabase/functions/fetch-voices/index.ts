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

    console.log("Fetching voices - ElevenLabs API key exists:", !!ELEVENLABS_API_KEY);

    if (!ELEVENLABS_API_KEY) {
      console.error("ElevenLabs API key not found in environment");
      
      // Return default voices if API key is not available
      const defaultVoices = [
        { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", description: "Calm, friendly female voice", category: "premade" },
        { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi", description: "Strong, confident female voice", category: "premade" },
        { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", description: "Sweet, young female voice", category: "premade" },
        { id: "ErXwobaYiN019PkySvjV", name: "Antoni", description: "Well-rounded male voice", category: "premade" },
        { id: "VR6AewLTigWG4xSOukaG", name: "Arnold", description: "Crisp, authoritative male voice", category: "premade" },
        { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", description: "Deep, mature male voice", category: "premade" },
        { id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam", description: "Casual, friendly male voice", category: "premade" },
      ];
      
      return new Response(JSON.stringify({ voices: defaultVoices }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch available voices from ElevenLabs
    console.log("Fetching voices from ElevenLabs API");
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
      
      // Fall back to default voices if API fails
      const defaultVoices = [
        { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", description: "Calm, friendly female voice", category: "premade" },
        { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi", description: "Strong, confident female voice", category: "premade" },
        { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", description: "Sweet, young female voice", category: "premade" },
        { id: "ErXwobaYiN019PkySvjV", name: "Antoni", description: "Well-rounded male voice", category: "premade" },
        { id: "VR6AewLTigWG4xSOukaG", name: "Arnold", description: "Crisp, authoritative male voice", category: "premade" },
        { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", description: "Deep, mature male voice", category: "premade" },
        { id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam", description: "Casual, friendly male voice", category: "premade" },
      ];
      
      console.log("Using default voices due to API error");
      return new Response(JSON.stringify({ voices: defaultVoices }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    console.log(`Successfully fetched ${sortedVoices.length} voices`);
    return new Response(JSON.stringify({ voices: sortedVoices }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching voices:", error);
    
    // Return default voices as fallback
    const defaultVoices = [
      { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", description: "Calm, friendly female voice", category: "premade" },
      { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi", description: "Strong, confident female voice", category: "premade" },
      { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", description: "Sweet, young female voice", category: "premade" },
      { id: "ErXwobaYiN019PkySvjV", name: "Antoni", description: "Well-rounded male voice", category: "premade" },
      { id: "VR6AewLTigWG4xSOukaG", name: "Arnold", description: "Crisp, authoritative male voice", category: "premade" },
      { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", description: "Deep, mature male voice", category: "premade" },
      { id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam", description: "Casual, friendly male voice", category: "premade" },
    ];
    
    return new Response(
      JSON.stringify({
        voices: defaultVoices,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
