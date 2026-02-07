const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const { pipeline } = require('stream/promises');
const ytdl = require('@distube/ytdl-core');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36';
const sanitize = (v, fb = 'media') => (v || fb).replace(/[<>:"/\\|?*]/g, '_').slice(0, 80) || fb;

const ytRequestOptions = () => {
  const cookieHeader = process.env.YT_COOKIE || process.env.YT_COOKIES || '';
  const headers = {
    'User-Agent': process.env.YT_USER_AGENT || UA,
  };
  if (cookieHeader) {
    // Format @distube/ytdl-core: array of objects
    try {
      const cookies = cookieHeader.split('; ').map(cookie => {
        const [name, value] = cookie.split('=');
        return { name: name.trim(), value: value || '' };
      });
      headers.cookie = cookies;
    } catch (e) {
      // Fallback: string format
      headers.Cookie = cookieHeader;
    }
  }
  return { headers };
};

class MultiPlatformDownloader {
  constructor({
    downloadDir = 'downloads',
    verbose = false,
    qualityMode = 'smooth',
    maxHeight = null,
    signal = null,
    onProgress = null,
    onTarget = null
  } = {}) {
    this.downloadDir = downloadDir;
    this.verbose = verbose;
    this.qualityMode = qualityMode;
    this.maxHeight = typeof maxHeight === 'number' && maxHeight > 0 ? maxHeight : null;
    this.signal = signal;
    this.onProgress = onProgress;
    this.onTarget = onTarget;
    fs.mkdirSync(downloadDir, { recursive: true });
  }

  async downloadMedia(url, filename = null, mediaType = 'video') {
    const resolved = await this.resolve(url);
    if (/youtu(\.be|be\.com)/.test(resolved)) return this.youtube(resolved, filename, mediaType);
    if (resolved.includes('facebook.com')) return this.facebook(resolved, filename, mediaType);
    if (resolved.includes('instagram.com')) return this.instagram(resolved, filename, mediaType);
    if (resolved.includes('pinterest.com') || resolved.includes('pin.it')) return this.pinterest(resolved, filename, mediaType);
    if (resolved.includes('tiktok.com')) return this.tiktok(resolved, filename);
    return { success: false, message: 'Plateforme non supportee' };
  }

  async resolve(url) {
    try {
      const r = await axios.head(url, {
        maxRedirects: 5,
        timeout: 10000,
        validateStatus: s => s < 400,
        signal: this.signal || undefined
      });
      return r.request?.res?.responseUrl || r.headers.location || url;
    } catch {
      return url;
    }
  }

  async fetch(url) {
    const r = await axios.get(url, {
      headers: { 'User-Agent': UA },
      timeout: 15000,
      signal: this.signal || undefined
    });
    return r.data;
  }

  reportProgress(loaded, total) {
    if (!this.onProgress || !total || total <= 0) return;
    const pct = Math.max(0, Math.min(100, Math.floor((loaded / total) * 100)));
    this.onProgress(pct);
  }

  async save(fileUrl, filename, ext) {
    const safe = sanitize(filename);
    const target = path.join(this.downloadDir, safe + ext);
    if (this.onTarget) this.onTarget(target);
    const res = await axios.get(fileUrl.startsWith('http') ? fileUrl : `https:${fileUrl}` , {
      responseType: 'stream',
      headers: { 'User-Agent': UA },
      timeout: 30000,
      signal: this.signal || undefined
    });
    const total = parseInt(res.headers['content-length'] || '0', 10);
    let downloaded = 0;
    res.data.on('data', (chunk) => {
      downloaded += chunk.length || 0;
      this.reportProgress(downloaded, total);
    });
    if (this.signal) {
      if (this.signal.aborted) throw new Error('Aborted');
      this.signal.addEventListener(
        'abort',
        () => {
          try { res.data.destroy(new Error('Aborted')); } catch {}
        },
        { once: true }
      );
    }
    await pipeline(res.data, fs.createWriteStream(target));
    const stat = await fsp.stat(target);
    return { success: true, message: `Telecharge: ${target}`, path: target, size: stat.size };
  }

  ytFormat(mediaType) {
    if (mediaType === 'audio' || this.qualityMode === 'audio') {
      return 'bestaudio[ext=m4a]/bestaudio';
    }
    const height = this.maxHeight && this.maxHeight > 0 ? this.maxHeight : 1080;
    if (this.qualityMode === 'max') {
      return 'bestvideo+bestaudio/best';
    }
    return `bestvideo[ext=mp4][vcodec~='^avc1'][height<=${height}]+bestaudio[ext=m4a]/best[ext=mp4][height<=${height}]/best`;
  }

  async youtube(url, filename, mediaType) {
    if (mediaType === 'image') return this.youtubeThumb(url, filename);
    const base = sanitize(filename || (await this.youtubeTitle(url)));
    const cleanUrl = this.cleanYoutubeUrl(url);

    try {
      const info = await ytdl.getInfo(cleanUrl, { requestOptions: ytRequestOptions() });
      const maxHeight = this.maxHeight && this.maxHeight > 0 ? this.maxHeight : null;
      const filter = mediaType === 'audio'
        ? f => f.hasAudio && !f.hasVideo
        : f => f.hasAudio && f.hasVideo && f.container === 'mp4' && (!maxHeight || (f.height && f.height <= maxHeight));
      const format = ytdl.chooseFormat(info.formats.filter(filter), { quality: 'highest' });
      const ext = mediaType === 'audio' ? 'm4a' : 'mp4';
      const target = path.join(this.downloadDir, `${base}.${ext}`);
      if (this.onTarget) this.onTarget(target);
      const stream = ytdl.downloadFromInfo(info, { format, requestOptions: ytRequestOptions() });
      stream.on('progress', (_chunkLength, downloaded, total) => {
        this.reportProgress(downloaded, total);
      });
      if (this.signal) {
        if (this.signal.aborted) throw new Error('Aborted');
        this.signal.addEventListener(
          'abort',
          () => {
            try { stream.destroy(new Error('Aborted')); } catch {}
          },
          { once: true }
        );
      }
      await pipeline(stream, fs.createWriteStream(target));
      return { success: true, message: `Telecharge: ${target}`, path: target, size: (await fsp.stat(target)).size };
    } catch (e) {
      return { success: false, message: `Erreur YouTube: ${e.message}` };
    }
  }

  async youtubeTitle(url) {
    try {
      const info = await ytdl.getBasicInfo(this.cleanYoutubeUrl(url), { requestOptions: ytRequestOptions() });
      return info.videoDetails?.title || 'youtube_video';
    } catch {
      return 'youtube_video';
    }
  }

  cleanYoutubeUrl(url) {
    try {
      const id = ytdl.getURLVideoID(url);
      return `https://www.youtube.com/watch?v=${id}`;
    } catch {
      return url;
    }
  }

  async youtubeThumb(url, filename) {
    try {
      const html = await this.fetch(url);
      const $ = cheerio.load(html);
      const title = $('meta[name="title"]').attr('content') || $('meta[property="og:title"]').attr('content') || 'youtube_video';
      const thumb = $('meta[property="og:image"]').attr('content');
      if (!thumb) return { success: false, message: 'Miniature non trouvee' };
      return this.save(thumb, (filename || title) + '_thumb', '.jpg');
    } catch (e) {
      return { success: false, message: `Erreur miniature YouTube: ${e.message}` };
    }
  }

  async facebook(url, filename, mediaType) {
    try {
      const html = await this.fetch(url);
      const $ = cheerio.load(html);
      const video = $('meta[property="og:video"], meta[property="og:video:secure_url"]').attr('content');
      const image = $('meta[property="og:image"]').attr('content');
      const kind = mediaType || (video ? 'video' : 'image');
      if (kind === 'video' && video) return this.save(video, filename || 'facebook_video', '.mp4');
      if (kind === 'image' && image) return this.save(image, filename || 'facebook_image', '.jpg');
      return { success: false, message: 'Aucun media Facebook trouve' };
    } catch (e) {
      return { success: false, message: `Erreur Facebook: ${e.message}` };
    }
  }

  async instagram(url, filename, mediaType) {
    try {
      const html = await this.fetch(url);
      const $ = cheerio.load(html);
      const scripts = $('script[type="text/javascript"]').toArray().map(s => $(s).html() || '');
      let videoUrl;
      let imageUrl;
      for (const txt of scripts) {
        if (!videoUrl) {
          const m = txt.match(/"video_url"\s*:\s*"([^"]+)"/);
          if (m) videoUrl = m[1].replace(/\\u0026/g, '&');
        }
        if (!imageUrl) {
          const m = txt.match(/"display_url"\s*:\s*"([^"]+)"/);
          if (m) imageUrl = m[1].replace(/\\u0026/g, '&');
        }
      }
      const kind = mediaType || (videoUrl ? 'video' : 'image');
      if (kind === 'video' && videoUrl) return this.save(videoUrl, filename || 'instagram_video', '.mp4');
      if (kind === 'image' && imageUrl) return this.save(imageUrl, filename || 'instagram_image', '.jpg');
      return { success: false, message: 'Media Instagram non trouve' };
    } catch (e) {
      return { success: false, message: `Erreur Instagram: ${e.message}` };
    }
  }

  async pinterest(url, filename, mediaType) {
    try {
      const html = await this.fetch(url);
      const $ = cheerio.load(html);
      const video = $('meta[property="og:video"]').attr('content');
      const image = $('meta[property="og:image"]').attr('content');
      const kind = mediaType || (video ? 'video' : 'image');
      if (kind === 'video' && video) return this.save(video, filename || 'pinterest_video', '.mp4');
      if (kind === 'image' && image) return this.save(image, filename || 'pinterest_image', '.jpg');
      return { success: false, message: 'Media Pinterest non trouve' };
    } catch (e) {
      return { success: false, message: `Erreur Pinterest: ${e.message}` };
    }
  }

  async tiktok(url, filename) {
    try {
      const html = await this.fetch(url);
      const $ = cheerio.load(html);
      const videoTag = $('video').attr('src');
      if (videoTag) return this.save(videoTag, filename || 'tiktok_video', '.mp4');
      const scripts = $('script').toArray().map(s => $(s).html() || '');
      for (const txt of scripts) {
        const m = txt.match(/"playAddr":"([^"]*)"/);
        if (m) return this.save(m[1].replace(/\\u0026/g, '&'), filename || 'tiktok_video', '.mp4');
      }
      return { success: false, message: 'Video TikTok non trouvee' };
    } catch (e) {
      return { success: false, message: `Erreur TikTok: ${e.message}` };
    }
  }
}

module.exports = MultiPlatformDownloader;
