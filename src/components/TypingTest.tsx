import { Keyboard } from "lucide-react";

export default function TypingTest() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-card rounded-lg border p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Keyboard className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Dad Types</h1>
              <p className="text-muted-foreground">
                Test your typing speed with Reddit dad jokes
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Under Reconstruction Message */}
      <div className="bg-card rounded-lg border p-8">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
            <div className="text-3xl">🚧</div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              Under Reconstruction
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              We're working hard to improve the typing test experience. This
              feature will be back soon with better performance and accuracy!
            </p>
          </div>

          <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <h3 className="font-semibold mb-2">Coming Soon:</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Improved completion detection</li>
              <li>• Real-time WPM calculation</li>
              <li>• Better error tracking</li>
              <li>• Enhanced results display</li>
            </ul>
          </div>
        </div>
      </div>

      {/* How It Works (Preview) */}
      <div className="bg-card rounded-lg border p-6 opacity-60">
        <h3 className="text-lg font-semibold mb-4">How It Will Work</h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            • Type the dad joke exactly as shown, including punctuation and
            capitalization
          </p>
          <p>• Your typing speed will be measured in Words Per Minute (WPM)</p>
          <p>
            • Accuracy will be calculated based on the number of errors made
          </p>
          <p>• Set a new personal best to earn 10 XP</p>
          <p>• Complete any typing test to earn 2 XP</p>
          <p>
            • All jokes will be sourced from Reddit's r/dadjokes or chosen from
            a list of subreddits
          </p>
        </div>
      </div>
    </div>
  );
}
