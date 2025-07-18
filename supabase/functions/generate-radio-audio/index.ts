import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RadioContent {
  id: string;
  type: 'post' | 'comment';
  title?: string;
  text: string;
  author: string;
  subreddit: string;
  score: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405,
    });
  }

  try {
    const { content, voice_id, player_id } = await req.json();

    if (!content || !content.text) {
      return new Response(JSON.stringify({ error: "Invalid content provided" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    
    if (!ELEVENLABS_API_KEY) {
      console.error("ElevenLabs API key not found in environment");
      return new Response(JSON.stringify({ error: "ElevenLabs API key not configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    console.log(`Generating audio for content: ${content.id} (${content.type})`);

    // Prepare the text for TTS
    let ttsText = "";
    
    if (content.type === 'post') {
      ttsText = `From r/${content.subreddit}, posted by ${content.author}. ${content.text}`;
    } else {
      ttsText = `A comment from r/${content.subreddit} by ${content.author}: ${content.text}`;
    }

    // Clean up the text for better TTS
    ttsText = ttsText
      .replace(/\[.*?\]/g, '') // Remove markdown links
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold markdown
      .replace(/\*([^*]+)\*/g, '$1') // Remove italic markdown
      .replace(/https?:\/\/[^\s]+/g, 'link') // Replace URLs with "link"
      .replace(/\n+/g, '. ') // Replace newlines with periods
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    // Limit text length for TTS (ElevenLabs has limits)
    if (ttsText.length > 800) {
      ttsText = ttsText.substring(0, 797) + "...";
    }

    console.log(`TTS Text (${ttsText.length} chars): ${ttsText.substring(0, 100)}...`);

    // Use the provided voice ID or default to Rachel
    const voiceId = voice_id || "21m00Tcm4TlvDq8ikWAM"; // Default Rachel voice

    // Call ElevenLabs API
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text: ttsText,
        model_id: "eleven_monolingual_v1",
        voice_settings: {
          stability: 0.6,
          similarity_boost: 0.7,
          style: 0.2,
          use_speaker_boost: true,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs API error:", response.status, errorText);
      
      // Provide more specific error messages
      if (response.status === 401) {
        throw new Error("ElevenLabs API authentication failed - check API key");
      } else if (response.status === 429) {
        throw new Error("ElevenLabs API rate limit exceeded - please try again later");
      } else {
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }
    }

    // Get the audio data
    const audioBuffer = await response.arrayBuffer();
    
    if (audioBuffer.byteLength === 0) {
      throw new Error("Received empty audio response from ElevenLabs");
    }
    
    // Convert to base64 for data URL
    const uint8Array = new Uint8Array(audioBuffer);
    let binaryString = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binaryString += String.fromCharCode(uint8Array[i]);
    }
    const audioBase64 = btoa(binaryString);
    const audioUrl = `data:audio/mpeg;base64,${audioBase64}`;

    console.log(`Generated audio for content ${content.id}, size: ${audioBuffer.byteLength} bytes`);

    return new Response(
      JSON.stringify({
        success: true,
        audio_url: audioUrl,
        content_id: content.id,
        text_length: ttsText.length,
        audio_size: audioBuffer.byteLength,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error generating radio audio:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to generate audio",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});