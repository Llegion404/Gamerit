import { useState, useEffect, useRef, useCallback } from "react";
import { 
  Play, 
  Pause, 
  SkipForward, 
  Volume2, 
  VolumeX, 
  Settings, 
  Plus, 
  X, 
  Radio,
  Loader2,
  Clock,
  Users
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import toast from "react-hot-toast";

interface RadioStation {
  id: string;
  name: string;
  subreddits: string[];
  player_id: string;
  created_at: string;
}

interface RadioContent {
  id: string;
  type: 'post' | 'comment';
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

  const audioRef = useRef<HTMLAudioElement>(null);

  // Load user's radio stations
  const loadStations = useCallback(async () => {
    if (!player) return;

    try {
      const { data, error } = await supabase
        .from("radio_stations")
        .select("*")
        .eq("player_id", player.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setStations(data || []);
    } catch (error) {
      console.error("Error loading stations:", error);
      toast.error("Failed to load radio stations");
    }
  }, [player]);

  useEffect(() => {
    loadStations();
  }, [loadStations]);

  // Create new radio station
  const createStation = async () => {
    if (!player || !newStationName.trim() || newStationSubreddits.length === 0) {
      toast.error("Please provide a station name and at least one subreddit");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("radio_stations")
        .insert({
          name: newStationName.trim(),
          subreddits: newStationSubreddits,
          player_id: player.id,
        })
        .select()
        .single();

      if (error) throw error;

      setStations(prev => [data, ...prev]);
      setNewStationName("");
      setNewStationSubreddits([]);
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
      setNewStationSubreddits(prev => [...prev, subreddit]);
      setSubredditInput("");
    }
  };

  // Remove subreddit from new station
  const removeSubreddit = (subreddit: string) => {
    setNewStationSubreddits(prev => prev.filter(s => s !== subreddit));
  };

  // Start playing a station
  const startStation = async (station: RadioStation) => {
    setLoading(true);
    setActiveStation(station);

    try {
      // Fetch content from Reddit for this station
      const { data, error } = await supabase.functions.invoke("fetch-radio-content", {
        body: {
          subreddits: station.subreddits,
          player_id: player?.id,
        },
      });

      if (error) throw error;

      if (data?.content && data.content.length > 0) {
        setPlaybackState(prev => ({
          ...prev,
          queue: data.content,
          currentContent: data.content[0],
        }));

        // Generate audio for first content item
        await generateAudio(data.content[0]);
      } else {
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
    try {
      const { data, error } = await supabase.functions.invoke("generate-radio-audio", {
        body: {
          content: content,
          player_id: player?.id,
        },
      });

      if (error) throw error;

      if (data?.audio_url) {
        setPlaybackState(prev => ({
          ...prev,
          currentContent: { ...content, audio_url: data.audio_url },
        }));
        
        // Start playing the audio
        if (audioRef.current) {
          audioRef.current.src = data.audio_url;
          audioRef.current.play();
          setPlaybackState(prev => ({ ...prev, isPlaying: true }));
        }
      }
    } catch (error) {
      console.error("Error generating audio:", error);
      toast.error("Failed to generate audio");
    }
  };

  // Play/pause controls
  const togglePlayback = () => {
    if (!audioRef.current) return;

    if (playbackState.isPlaying) {
      audioRef.current.pause();
      setPlaybackState(prev => ({ ...prev, isPlaying: false }));
    } else {
      audioRef.current.play();
      setPlaybackState(prev => ({ ...prev, isPlaying: true }));
    }
  };

  // Skip to next content
  const skipToNext = async () => {
    const currentIndex = playbackState.queue.findIndex(
      item => item.id === playbackState.currentContent?.id
    );
    
    if (currentIndex < playbackState.queue.length - 1) {
      const nextContent = playbackState.queue[currentIndex + 1];
      setPlaybackState(prev => ({ ...prev, currentContent: nextContent }));
      await generateAudio(nextContent);
    } else {
      // End of queue - could fetch more content here
      toast.info("End of queue reached");
      setPlaybackState(prev => ({ ...prev, isPlaying: false }));
    }
  };

  // Volume controls
  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !playbackState.isMuted;
      setPlaybackState(prev => ({ ...prev, isMuted: !prev.isMuted }));
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const volume = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.volume = volume;
      setPlaybackState(prev => ({ ...prev, volume }));
    }
  };

  // Audio event handlers
  const handleAudioEnded = () => {
    skipToNext();
  };

  if (!player || !redditUser) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-card rounded-lg border p-8 text-center">
          <Radio className="w-16 h-16 mx-auto text-primary mb-4" />
          <h2 className="text-2xl font-bold mb-4">Reddit Radio</h2>
          <p className="text-muted-foreground">Please log in to create and listen to personalized radio stations.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-card rounded-lg border p-6">
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
        <div className="bg-card rounded-lg border p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">Now Playing: {activeStation.name}</h3>
              <p className="text-sm text-muted-foreground">
                {activeStation.subreddits.map(s => `r/${s}`).join(", ")}
              </p>
            </div>
            {loading && <Loader2 className="w-5 h-5 animate-spin text-primary" />}
          </div>

          {playbackState.currentContent && (
            <div className="bg-secondary/50 rounded-lg p-4 mb-4">
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
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {playbackState.currentContent.text}
                  </p>
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

            <div className="ml-auto text-sm text-muted-foreground">
              Queue: {playbackState.queue.length} items
            </div>
          </div>

          <audio
            ref={audioRef}
            onEnded={handleAudioEnded}
            onPlay={() => setPlaybackState(prev => ({ ...prev, isPlaying: true }))}
            onPause={() => setPlaybackState(prev => ({ ...prev, isPlaying: false }))}
            className="hidden"
          />
        </div>
      )}

      {/* Stations List */}
      <div className="bg-card rounded-lg border p-6">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold">{station.name}</h3>
                  {activeStation?.id === station.id && (
                    <div className="flex items-center gap-1 text-primary text-xs">
                      <Radio className="w-3 h-3" />
                      LIVE
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  {station.subreddits.slice(0, 3).map((subreddit) => (
                    <div key={subreddit} className="text-sm text-muted-foreground">
                      r/{subreddit}
                    </div>
                  ))}
                  {station.subreddits.length > 3 && (
                    <div className="text-xs text-muted-foreground">
                      +{station.subreddits.length - 3} more
                    </div>
                  )}
                </div>
                <div className="mt-3 text-xs text-muted-foreground flex items-center gap-1">
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
                <label className="text-sm font-medium block mb-2">Subreddits</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={subredditInput}
                    onChange={(e) => setSubredditInput(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && addSubreddit()}
                    placeholder="todayilearned"
                    className="flex-1 px-3 py-2 border border-input rounded-md bg-background"
                  />
                  <button
                    onClick={addSubreddit}
                    className="bg-primary text-primary-foreground px-3 py-2 rounded-md hover:bg-primary/90 transition-colors"
                  >
                    Add
                  </button>
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

export default RedditRadio