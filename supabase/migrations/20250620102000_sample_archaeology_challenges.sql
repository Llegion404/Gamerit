-- Sample archaeology challenge for testing
INSERT INTO archaeology_challenges (reddit_thread_id, subreddit, thread_title, is_active)
VALUES 
  ('asxqyy', 'r/AskReddit', 'What is the most ridiculous thing you believed as a child?', true),
  ('13relk5', 'r/explainlikeimfive', 'ELI5: Why do we get goosebumps when we hear music we like?', true)
ON CONFLICT DO NOTHING;
