import express from 'express';
import cors from 'cors';
import youtubedl from 'youtube-dl-exec';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([^&\s]+)/,
    /(?:youtu\.be\/)([^?\s]+)/,
    /(?:youtube\.com\/embed\/)([^?\s]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

app.post('/api/youtube/extract', async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid url' });
  }

  const videoId = extractVideoId(url.trim());
  if (!videoId) {
    return res.status(400).json({ error: 'Invalid YouTube URL' });
  }

  try {
    let streamUrl;
    let title = '';
    let duration = 0;

    const formatPrefs = [
      '22/18',
      'best[protocol^=http][protocol!*=m3u8][protocol!*=dash]',
      'best[ext=mp4][protocol^=http]',
      'best[ext=webm][protocol^=http]',
      'best[ext=mp4]/best[ext=webm]/best',
    ];

    for (const fmt of formatPrefs) {
      try {
        const info = await youtubedl(url.trim(), {
          dumpSingleJson: true,
          noCheckCertificates: true,
          noWarnings: true,
          noUpdate: true,
          format: fmt,
        });

        const formats = info.formats || [];
        const format = formats.find(
          (f) => f.url && (f.vcodec !== 'none' || f.acodec !== 'none')
        ) || formats.find((f) => f.url) || formats[0];

        if (format?.url) {
          const proto = (format.protocol || '').toLowerCase();
          if (proto.includes('m3u8') || proto.includes('dash')) continue;
          streamUrl = format.url;
          title = info.title || '';
          duration = info.duration || 0;
          break;
        }
      } catch (innerErr) {
        continue;
      }
    }

    if (!streamUrl) {
      try {
        const urlOutput = await youtubedl(url.trim(), {
          getUrl: true,
          noCheckCertificates: true,
          noWarnings: true,
          noUpdate: true,
          format: '22/18/best[ext=mp4]/best',
        });
        streamUrl = typeof urlOutput === 'string' ? urlOutput.trim() : urlOutput;
      } catch (fallbackErr) {
        console.error('yt-dlp getUrl failed:', fallbackErr.message);
      }
    }

    if (!streamUrl) {
      return res.status(500).json({
        error: 'Could not extract video. YouTube may have changed. Try "Load as embed instead" below, or run: npx youtube-dl-exec --update-to nightly',
      });
    }

    res.json({ streamUrl, title, duration });
  } catch (err) {
    console.error('yt-dlp error:', err.message);
    const msg = err.message || 'Unknown error';
    res.status(500).json({
      error: `Failed to extract video: ${msg}. Try "Load as embed instead" below.`,
    });
  }
});

app.get('/api/youtube/stream', async (req, res) => {
  const url = req.query.url;
  if (!url || typeof url !== 'string') {
    return res.status(400).send('Missing url parameter');
  }

  const videoId = extractVideoId(url);
  if (!videoId) {
    return res.status(400).send('Invalid YouTube URL');
  }

  try {
    let videoUrl;
    const formatPrefs = [
      '22/18',
      'best[protocol^=http][protocol!*=m3u8][protocol!*=dash]',
      'best[ext=mp4][protocol^=http]',
      'best[ext=webm][protocol^=http]',
      'best[ext=mp4]/best[ext=webm]/best',
    ];

    for (const fmt of formatPrefs) {
      try {
        const info = await youtubedl(url, {
          dumpSingleJson: true,
          noCheckCertificates: true,
          noWarnings: true,
          noUpdate: true,
          format: fmt,
        });
        const formats = info.formats || [];
        const format = formats.find(
          (f) => f.url && (f.vcodec !== 'none' || f.acodec !== 'none')
        ) || formats.find((f) => f.url) || formats[0];
        if (format?.url) {
          const proto = (format.protocol || '').toLowerCase();
          if (!proto.includes('m3u8') && !proto.includes('dash')) {
            videoUrl = format.url;
            break;
          }
        }
      } catch {
        continue;
      }
    }

    if (!videoUrl) {
      const urlOutput = await youtubedl(url, {
        getUrl: true,
        noCheckCertificates: true,
        noWarnings: true,
        noUpdate: true,
        format: '22/18/best[ext=mp4]/best',
      });
      videoUrl = typeof urlOutput === 'string' ? urlOutput.trim() : urlOutput;
    }

    if (!videoUrl) {
      return res.status(500).send('Could not extract video URL');
    }

    const fetchHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Origin': 'https://www.youtube.com',
      'Referer': 'https://www.youtube.com/',
    };
    const range = req.headers.range;
    if (range) fetchHeaders['Range'] = range;

    const response = await fetch(String(videoUrl), { headers: fetchHeaders });

    if (!response.ok) {
      return res.status(502).send(`Stream failed: ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || 'video/mp4';
    res.set({
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
    });
    const contentLength = response.headers.get('content-length');
    if (contentLength) res.set('Content-Length', contentLength);

    response.body.pipe(res);
  } catch (err) {
    console.error('Stream error:', err.message);
    res.status(500).send('Failed to stream video');
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
