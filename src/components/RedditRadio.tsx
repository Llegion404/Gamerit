import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, SkipForward, Volume2, VolumeX, Plus, X, Radio, Loader2, Clock, Users } from "lucide-react";
import { supabase } from "../lib/supabase";
import { searchSubreddits as searchRedditAPI, type SubredditSuggestion } from "../lib/reddit-api";
import { useAuth } from "../hooks/useAuth";
import toast from "react-hot-toast";

interface RadioStation {
  id: string;
  name: string;
  subreddits: string[];
  voice_id?: string;
  player_id: string;
  created_at: string;
}

interface RadioContent {
  id: string;
  type: "post" | "comment";
  title?: string;
  text: string;
  author: string;
  subreddit: string;
  score: number;
  audio_url?: string;
}

interface PlaybackState {
  isPlaying: boolean;
  currentContent: RadioContent | null;
  queue: RadioContent[];
  volume: number;
  isMuted: boolean;
}

interface Voice {
  id: string;
  name: string;
  description: string;
  category: string;
  labels?: {
    gender?: string;
    age?: string;
    accent?: string;
    [key: string]: string | undefined;
  };
  preview_url?: string;
}

export function RedditRadio() {
  const { player, redditUser } = useAuth();
  const [stations, setStations] = useState<RadioStation[]>([]);
  const [activeStation, setActiveStation] = useState<RadioStation | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    currentContent: null,
    queue: [],
    volume: 0.7,
    isMuted: false,
  });
  const [loading, setLoading] = useState(false);
  const [showStationEditor, setShowStationEditor] = useState(false);
  const [newStationName, setNewStationName] = useState("");
  const [newStationSubreddits, setNewStationSubreddits] = useState<string[]>([]);
  const [subredditInput, setSubredditInput] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("21m00Tcm4TlvDq8ikWAM"); // Default Rachel voice
  const [subredditSuggestions, setSubredditSuggestions] = useState<SubredditSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<Voice[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  const audioRef = useRef<HTMLAudioElement>(null);

  // Load user's radio stations
  const loadStations = useCallback(async () => {
    if (!player) {
      console.log("No player found, skipping station load");
      return;
    }

    try {
      console.log("Loading stations for player:", player.id);
      const { data, error } = await supabase
        .from("radio_stations")
        .select("*")
        .eq("player_id", player.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading stations:", error);
        throw error;
      }
      
      console.log("Loaded stations:", data);
      setStations(data || []);
    } catch (error) {
      console.error("Error loading stations:", error);
      toast.error("Failed to load radio stations");
    }
  }, [player]);

  // Load available voices from ElevenLabs
  const loadVoices = useCallback(async () => {
    if (loadingVoices || availableVoices.length > 0) return;

    setLoadingVoices(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-voices");

      if (error) throw error;

      if (data?.voices) {
        setAvailableVoices(data.voices);
      }
    } catch (error) {
      console.error("Error loading voices:", error);
      // Fallback to default voices if API fails
      setAvailableVoices([
        { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", description: "Calm, friendly female voice", category: "premade" },
        {
          id: "AZnzlk1XvdvUeBnXmlld",
          name: "Domi",
          description: "Strong, confident female voice",
          category: "premade",
        },
        { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", description: "Sweet, young female voice", category: "premade" },
        { id: "ErXwobaYiN019PkySvjV", name: "Antoni", description: "Well-rounded male voice", category: "premade" },
        {
          id: "VR6AewLTigWG4xSOukaG",
          name: "Arnold",
          description: "Crisp, authoritative male voice",
          category: "premade",
        },
        { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", description: "Deep, mature male voice", category: "premade" },
        { id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam", description: "Casual, friendly male voice", category: "premade" },
      ]);
    } finally {
      setLoadingVoices(false);
    }
  }, [loadingVoices, availableVoices.length]);

  // Search subreddits from Reddit API
  const searchSubreddits = useCallback(
    async (query: string) => {
      if (!query.trim() || query.trim().length < 2) {
        setSubredditSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      setLoadingSuggestions(true);
      try {
        const subreddits: SubredditSuggestion[] = await searchRedditAPI(query.trim(), 8);

        // Filter out already added subreddits
        const filtered = subreddits.filter((sub) => !newStationSubreddits.includes(sub.name.toLowerCase()));
        setSubredditSuggestions(filtered);
        setShowSuggestions(filtered.length > 0);
      } catch (error) {
        console.error("Error searching subreddits:", error);
        setSubredditSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setLoadingSuggestions(false);
      }
    },
    [newStationSubreddits]
  );

  // Debounce search to avoid too many API calls
  const debouncedSearchSubreddits = (query: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      searchSubreddits(query);
    }, 300);
  };

  useEffect(() => {
    loadStations();
    loadVoices();
  }, [loadStations, loadVoices]);

  // Create new radio station
  const createStation = async () => {
    if (!player || !newStationName.trim() || newStationSubreddits.length === 0) {
      toast.error("Please provide a station name and at least one subreddit");
      return;
    }

    console.log("Creating station with data:", {
      name: newStationName.trim(),
      subreddits: newStationSubreddits,
      voice_id: selectedVoice,
      player_id: player.id,
    });

    try {
      const { data, error } = await supabase
        .from("radio_stations")
        .insert({
          name: newStationName.trim(),
          subreddits: newStationSubreddits,
          voice_id: selectedVoice,
          player_id: player.id,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating station:", error);
        throw error;
      }

      console.log("Station created successfully:", data);
      setStations((prev) => [data, ...prev]);
      setNewStationName("");
      setNewStationSubreddits([]);
      setSelectedVoice("21m00Tcm4TlvDq8ikWAM");
      setShowStationEditor(false);
      toast.success("Radio station created!");
    } catch (error) {
      console.error("Error creating station:", error);
      toast.error("Failed to create station");
    }
  };

  // Add subreddit to new station
  const addSubreddit = () => {
    const subreddit = subredditInput.trim().toLowerCase().replace(/^r\//, "");
    if (subreddit && !newStationSubreddits.includes(subreddit)) {
      setNewStationSubreddits((prev) => [...prev, subreddit]);
      setSubredditInput("");
      setShowSuggestions(false);
    }
  };

  // Remove subreddit from new station
  const removeSubreddit = (subreddit: string) => {
    setNewStationSubreddits((prev) => prev.filter((s) => s !== subreddit));
  };

  // Handle subreddit input change with autocomplete
  const handleSubredditInputChange = (value: string) => {
    setSubredditInput(value);
    debouncedSearchSubreddits(value);
  };

  // Select suggestion
  const selectSuggestion = (subreddit: SubredditSuggestion) => {
    setSubredditInput(subreddit.name);
    setShowSuggestions(false);
    // Auto-add the subreddit
    if (!newStationSubreddits.includes(subreddit.name.toLowerCase())) {
      setNewStationSubreddits((prev) => [...prev, subreddit.name.toLowerCase()]);
      setSubredditInput("");
    }
  };

  // Start playing a station
  const startStation = async (station: RadioStation) => {
    console.log("Starting station:", station);
    setLoading(true);
    setActiveStation(station);

    try {
      // Fetch content from Reddit for this station
      console.log("Fetching content for subreddits:", station.subreddits);
      const { data, error } = await supabase.functions.invoke("fetch-radio-content", {
        body: {
          subreddits: station.subreddits,
          player_id: player?.id,
        },
      });

      console.log("Fetch content response:", { data, error });

      if (error) throw error;

      if (data?.content && data.content.length > 0) {
        console.log(`Received ${data.content.length} content items`);
        setPlaybackState((prev) => ({
          ...prev,
          queue: data.content,
          currentContent: data.content[0],
        }));

        // Generate audio for first content item
        await generateAudio(data.content[0]);
      } else {
        console.log("No content found in response:", data);
        toast.error("No content found for this station");
      }
    } catch (error) {
      console.error("Error starting station:", error);
      toast.error("Failed to start radio station");
    } finally {
      setLoading(false);
    }
  };

  // Generate audio using ElevenLabs
  const generateAudio = async (content: RadioContent) => {
    console.log("Generating audio for content:", content.id);
    try {
      const { data, error } = await supabase.functions.invoke("generate-radio-audio", {
        body: {
          content: content,
          voice_id: activeStation?.voice_id || "21m00Tcm4TlvDq8ikWAM",
          player_id: player?.id,
        },
      });

      if (error) throw error;

      if (data?.audio_url) {
        console.log("Audio generated successfully");
        setPlaybackState((prev) => ({
          ...prev,
          currentContent: { ...content, audio_url: data.audio_url },
        }));

        // Start playing the audio
        if (audioRef.current) {
          audioRef.current.src = data.audio_url;
          audioRef.current.play();
          setPlaybackState((prev) => ({ ...prev, isPlaying: true }));
        }
      } else {
        console.log("No audio URL in response:", data);
        toast.error("Failed to generate audio");
      }
    } catch (error) {
      console.error("Error generating audio:", error);
      toast.error("Failed to generate audio");
    }
  };

  // Play/pause controls
  const togglePlayback = () => {
    console.log("Toggling playback, current state:", playbackState.isPlaying);
    if (!audioRef.current) return;

    if (playbackState.isPlaying) {
      audioRef.current.pause();
      setPlaybackState((prev) => ({ ...prev, isPlaying: false }));
    } else {
      audioRef.current.play();
      setPlaybackState((prev) => ({ ...prev, isPlaying: true }));
    }
  };

  // Skip to next content
  const skipToNext = async () => {
    console.log("Skipping to next content");
    const currentIndex = playbackState.queue.findIndex((item) => item.id === playbackState.currentContent?.id);

    if (currentIndex < playbackState.queue.length - 1) {
      const nextContent = playbackState.queue[currentIndex + 1];
      setPlaybackState((prev) => ({ ...prev, currentContent: nextContent }));
      await generateAudio(nextContent);
    } else {
      // End of queue - could fetch more content here
      console.log("End of queue reached");
      toast("End of queue reached");
      setPlaybackState((prev) => ({ ...prev, isPlaying: false }));
    }
  };

  // Volume controls
  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !playbackState.isMuted;
      setPlaybackState((prev) => ({ ...prev, isMuted: !prev.isMuted }));
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const volume = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.volume = volume;
      setPlaybackState((prev) => ({ ...prev, volume }));
    }
  };

  // Audio event handlers
  const handleAudioEnded = () => {
    console.log("Audio ended, skipping to next");
    skipToNext();
  };

  if (!player || !redditUser) {
    return (
      <div className="max-w-4xl mx-auto p-3 sm:p-6">
        <div className="bg-card rounded-lg border p-8 text-center">
          <Radio className="w-16 h-16 mx-auto text-primary mb-4" />
          <h2 className="text-2xl font-bold mb-4">Reddit Radio</h2>
          <p className="text-muted-foreground">Please log in to create and listen to personalized radio stations.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="bg-card rounded-lg border p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Radio className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Reddit Radio</h1>
              <p className="text-muted-foreground">AI-powered radio stations from your favorite subreddits</p>
            </div>
          </div>
          <button
            onClick={() => setShowStationEditor(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Station
          </button>
        </div>
      </div>

      {/* Current Playing */}
      {activeStation && (
        <div className="bg-card rounded-lg border p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">Now Playing: {activeStation.name}</h3>
              <p className="text-sm text-muted-foreground">
                {activeStation.subreddits.map((s) => `r/${s}`).join(", ")}
              </p>
            </div>
            {loading && <Loader2 className="w-5 h-5 animate-spin text-primary" />}
          </div>

          {playbackState.currentContent && (
            <div className="bg-secondary/50 rounded-lg p-3 sm:p-4 mb-4">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-primary">r/{playbackState.currentContent.subreddit}</span>
                    <span className="text-xs text-muted-foreground">by u/{playbackState.currentContent.author}</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {playbackState.currentContent.score}
                    </span>
                  </div>
                  {playbackState.currentContent.title && (
                    <h4 className="font-medium mb-2">{playbackState.currentContent.title}</h4>
                  )}
                  <p className="text-sm text-muted-foreground line-clamp-3">{playbackState.currentContent.text}</p>
                </div>
              </div>
            </div>
          )}

          {/* Audio Controls */}
          <div className="flex items-center gap-4">
            <button
              onClick={togglePlayback}
              disabled={!playbackState.currentContent?.audio_url}
              className="flex items-center justify-center w-12 h-12 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {playbackState.isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>

            <button
              onClick={skipToNext}
              disabled={!playbackState.queue.length}
              className="flex items-center justify-center w-10 h-10 bg-secondary text-secondary-foreground rounded-full hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 ml-4">
              <button onClick={toggleMute} className="text-muted-foreground hover:text-foreground">
                {playbackState.isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={playbackState.volume}
                onChange={handleVolumeChange}
                className="w-20"
              />
            </div>

            <div className="ml-auto text-sm text-muted-foreground">Queue: {playbackState.queue.length} items</div>
          </div>

          <audio
            ref={audioRef}
            onEnded={handleAudioEnded}
            onPlay={() => setPlaybackState((prev) => ({ ...prev, isPlaying: true }))}
            onPause={() => setPlaybackState((prev) => ({ ...prev, isPlaying: false }))}
            className="hidden"
          />
        </div>
      )}

      {/* Stations List */}
      <div className="bg-card rounded-lg border p-4 sm:p-6">
        <h2 className="text-xl font-semibold mb-4">Your Radio Stations</h2>
        
        {stations.length === 0 ? (
          <div className="text-center py-8">
            <Radio className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Stations Yet</h3>
            <p className="text-muted-foreground mb-4">Create your first radio station to get started</p>
            <button
              onClick={() => setShowStationEditor(true)}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
            >
              Create Your First Station
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {stations.map((station) => (
              <div
                key={station.id}
                className={`border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${
                  activeStation?.id === station.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
                onClick={() => startStation(station)}
              >
                <div className="flex items-start justify-between mb-2 sm:mb-3">
                  <h3 className="font-semibold">{station.name}</h3>
                  {activeStation?.id === station.id && (
                    <div className="flex items-center gap-1 text-primary text-xs">
                      <Radio className="w-3 h-3" />
                      LIVE
                    </div>
                  )}
                </div>
                <div className="space-y-0.5 sm:space-y-1">
                  {station.subreddits.slice(0, 3).map((subreddit) => (
                    <div key={subreddit} className="text-sm text-muted-foreground truncate">
                      r/{subreddit}
                    </div>
                  ))}
                  {station.subreddits.length > 3 && (
                    <div className="text-xs text-muted-foreground">+{station.subreddits.length - 3} more</div>
                  )}
                </div>
                <div className="mt-2 sm:mt-3 text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Created {new Date(station.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Station Editor Modal */}
      {showStationEditor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-lg border max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Create Radio Station</h3>
              <button
                onClick={() => setShowStationEditor(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-2">Station Name</label>
                <input
                  type="text"
                  value={newStationName}
                  onChange={(e) => setNewStationName(e.target.value)}
                  placeholder="My Awesome Station"
                  className="w-full px-3 py-2 border border-input rounded-md bg-background"
                />
              </div>

              <div>
                <label className="text-sm font-medium block mb-2">Voice</label>
                <select
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  disabled={loadingVoices}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background disabled:opacity-50"
                >
                  {loadingVoices ? (
                    <option>Loading voices...</option>
                  ) : (
                    availableVoices.map((voice) => (
                      <option key={voice.id} value={voice.id}>
                        {voice.name} - {voice.description}
                      </option>
                    ))
                  )}
                </select>
                {loadingVoices && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Loading available voices...
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium block mb-2">Subreddits</label>
                <div className="relative">
                  <div className="flex gap-2 mb-2">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={subredditInput}
                        onChange={(e) => handleSubredditInputChange(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addSubreddit();
                          }
                        }}
                        onFocus={() => {
                          if (subredditInput.trim().length > 0) {
                            setShowSuggestions(true);
                          }
                        }}
                        onBlur={() => {
                          // Delay hiding suggestions to allow clicking
                          setTimeout(() => setShowSuggestions(false), 200);
                        }}
                        placeholder="todayilearned"
                        className="w-full px-3 py-2 border border-input rounded-md bg-background"
                      />

                      {/* Autocomplete suggestions */}
                      {showSuggestions && subredditSuggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 z-10 bg-card border border-border rounded-md shadow-lg mt-1 max-h-40 overflow-y-auto">
                          {subredditSuggestions.map((suggestion) => (
                            <button
                              key={suggestion.name}
                              onClick={() => selectSuggestion(suggestion)}
                              className="w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground text-sm border-b border-border last:border-b-0"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-medium">r/{suggestion.name}</div>
                                  {suggestion.title && (
                                    <div className="text-xs text-muted-foreground truncate">{suggestion.title}</div>
                                  )}
                                </div>
                                {suggestion.subscribers > 0 && (
                                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Users className="w-3 h-3" />
                                    {suggestion.subscribers.toLocaleString()}
                                  </div>
                                )}
                              </div>
                            </button>
                          ))}
                          {loadingSuggestions && (
                            <div className="px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Searching...
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={addSubreddit}
                      className="bg-primary text-primary-foreground px-3 py-2 rounded-md hover:bg-primary/90 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {newStationSubreddits.length > 0 && (
                  <div className="space-y-1">
                    {newStationSubreddits.map((subreddit) => (
                      <div
                        key={subreddit}
                        className="flex items-center justify-between bg-secondary/50 px-3 py-2 rounded-md"
                      >
                        <span className="text-sm">r/{subreddit}</span>
                        <button
                          onClick={() => removeSubreddit(subreddit)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowStationEditor(false)}
                className="flex-1 px-4 py-2 border border-input rounded-md hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createStation}
                disabled={!newStationName.trim() || newStationSubreddits.length === 0}
                className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Create Station
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RedditRadio;
