import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

const App = () => {
  const [channelUrl, setChannelUrl] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const YOUTUBE_API_KEY = process.env.REACT_APP_YOUTUBE_API_KEY;
  const OPENAI_API_KEY = process.env.REACT_APP_OPENAI_API_KEY;  

  const extractChannelInfo = (url) => {
    try {
      const u = new URL(url);
      const path = u.pathname.split('/').filter(Boolean);
      if (path[0] === 'channel') return { type: 'id', value: path[1] };
      if (path[0].startsWith('@')) return { type: 'handle', value: path[0] };
      if (path[0] === 'user' || path[0] === 'c') return { type: 'username', value: path[1] };
      return null;
    } catch {
      return null;
    }
  };

  const resolveChannelId = async (info) => {
    if (!info) throw new Error('Invalid YouTube URL');
    if (info.type === 'id') return info.value;

    if (info.type === 'handle') {
      const res = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
          part: 'snippet',
          q: info.value,
          type: 'channel',
          maxResults: 1,
          key: YOUTUBE_API_KEY,
        },
      });
      return res.data.items[0]?.snippet?.channelId;
    }

    if (info.type === 'username') {
      const res = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
        params: {
          part: 'id',
          forUsername: info.value,
          key: YOUTUBE_API_KEY,
        },
      });
      return res.data.items[0]?.id;
    }
  };

  const fetchVideos = async (channelId) => {
    const searchRes = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        channelId,
        maxResults: 5,
        order: 'date',
        type: 'video',
        key: YOUTUBE_API_KEY,
      },
    });
  
    const videoItems = searchRes.data.items;
    const videoIds = videoItems.map((item) => item.id.videoId).join(',');
  
    const videoDetailsRes = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: {
        part: 'snippet,contentDetails,statistics',
        id: videoIds,
        key: YOUTUBE_API_KEY,
      },
    });
  
    const combined = videoDetailsRes.data.items.map((video) => {
      const title = video.snippet.title;
      const description = video.snippet.description;
      const duration = video.contentDetails.duration; // ISO 8601 format like 'PT15M33S'
      const views = video.statistics.viewCount;
      return `Title: ${title}
  Description: ${description}
  Views: ${views}
  Duration: ${duration}`;
    });
  
    return combined;
  };
  

  const analyzeVideos = async (videoTexts) => {
    const prompt = `
Analyze the following YouTube videos and respond with:
1. What type of channel is this?
2. Is the content useful or a waste of time? Why?
3. Summarize the common theme.
4. How can the channel improve?
5. How many videos are there in total?
6. What is the average length?
7. What is the average number of views?
Videos:
${videoTexts.join('\n')}
`;

    const res = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
    }, {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    return res.data.choices[0].message.content;
  };

  const handleAnalyze = async () => {
    setLoading(true);
    setError('');
    setResult('');
    try {
      const info = extractChannelInfo(channelUrl);
      const channelId = await resolveChannelId(info);
      const videos = await fetchVideos(channelId);
      const analysis = await analyzeVideos(videos);
      setResult(analysis);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const renderCards = () => {
    const questions = [
      "1. What type of channel is this?",
      "2. Is the content useful or a waste of time? Why?",
      "3. Summarize the common theme.",
      "4. How can the channel improve?",
      "5. How many videos are there in total?",
      "6. What is the average length?",
      "7. What is the average number of views?"
    ];

    const answers = result.split(/\d\.\s/).filter(Boolean);

    return questions.map((q, i) => (
      <div key={i} className="card">
        <h3>{q}</h3>
        <p>{answers[i]?.trim()}</p>
      </div>
    ));
  };

  return (
    <div className="container">
      <header className="header">
        <h1>YouTube Channel Analyzer</h1>
        <nav className="menu">
          <span>MVP</span>
        </nav>
      </header>

      <div className="input-section">
        <input
          value={channelUrl}
          onChange={(e) => setChannelUrl(e.target.value)}
          placeholder="Paste YouTube channel URL"
        />
        <button onClick={handleAnalyze} disabled={loading}>
          {loading ? 'Analyzing...' : 'Analyze'}
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      <div className="results">
        {result && renderCards()}
      </div>
    </div>
  );
};

export default App;
