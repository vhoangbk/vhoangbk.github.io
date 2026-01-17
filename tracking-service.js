const express = require('express');
const router = express.Router();
const { kv } = require('@vercel/kv');
const UAParser = require('ua-parser-js');
const crypto = require('crypto');

const isKVConfigured = () => {
  return process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;
};

global.localTotalClicks = 0;
global.localDetailedLogs = [];
global.localCounters = {};

const pad = (n) => n < 10 ? '0' + n : n;

const getVNTime = (ts = Date.now()) => {
  return new Date(ts + 7 * 60 * 60 * 1000);
};

const getHourKey = (ts) => {
  const date = getVNTime(ts);
  const y = date.getUTCFullYear();
  const m = pad(date.getUTCMonth() + 1);
  const d = pad(date.getUTCDate());
  const h = pad(date.getUTCHours());
  return `stats:h:${y}${m}${d}${h}`;
};

const getDayKey = (ts) => {
  const date = getVNTime(ts);
  const y = date.getUTCFullYear();
  const m = pad(date.getUTCMonth() + 1);
  const d = pad(date.getUTCDate());
  return `stats:d:${y}${m}${d}`;
};

const getWeekKey = (ts) => {
  const date = getVNTime(ts);
  const day = date.getUTCDay();
  const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1);

  const monday = new Date(date);
  monday.setUTCDate(diff);

  const y = monday.getUTCFullYear();
  const m = pad(monday.getUTCMonth() + 1);
  const d = pad(monday.getUTCDate());
  return `stats:w:${y}${m}${d}`;
};

router.get('/total-clicks', async (req, res) => {
  try {
    if (!isKVConfigured()) {
      return res.json({ total: global.localTotalClicks || 0 });
    }
    const total = await kv.get('convert:total_clicks');
    res.json({ total: Number(total) || 0 });
  } catch (error) {
    if (isKVConfigured()) console.error('KV Error (Total):', error.message);
    res.json({ total: 0 });
  }
});

router.post('/track-convert', async (req, res) => {
  console.log('call api track-convert');
  try {
    const data = req.body;
    const userAgent = req.headers['user-agent'] || '';

    let country = req.headers['x-vercel-ip-country'];
    if (!country && !isKVConfigured()) {
      country = 'Vietnam (Local)';
    }
    country = country || 'Unknown';

    const parser = new UAParser(userAgent);
    const uaResult = parser.getResult();
    const now = Date.now();

    const trackingData = {
      id: crypto.randomUUID(),
      timestamp: now,
      video: {
        filename: data.video?.filename ? (data.video.filename.length > 50 ? data.video.filename.substring(0, 50) + '...' : data.video.filename) : 'unknown',
        extension: data.video?.extension,
        codec: data.video?.codec,
        resolution: data.video?.resolution,
        duration: data.video?.duration,
        size: data.video?.size,
        targetSize: data.video?.targetSize,
        fps: data.video?.fps
      },
      convert: {
        format: data.convert?.format,
        codec: data.convert?.codec,
        resolution: data.convert?.resolution,
        size: data.convert?.size,
        success: data.convert?.success,
        errorCode: data.convert?.errorCode,
        duration: data.convert?.duration
      },
      user: {
        country: country,
        ua: userAgent,
        browser: uaResult.browser,
        os: uaResult.os,
        device: {
          ...uaResult.device,
          model: data.user?.device?.model || uaResult.device.model,
          platform: data.user?.device?.platform || undefined,
          brands: data.user?.device?.brands
        },
        cpu: uaResult.cpu,
        deviceType: uaResult.device.type || (['Android', 'iOS'].includes(uaResult.os.name) ? 'mobile' : 'desktop'),
        isMobile: data.user?.isMobile
      }
    };

    // --- ENHANCED BROWSER DETECTION (Cốc Cốc, etc.) ---
    // 0. Explicit check from client
    if (data.user?.device?.isCocCoc) {
      trackingData.user.browser.name = 'Cốc Cốc';
      // Prioritize extracting version from UA string for Cốc Cốc
      const match = userAgent.match(/(?:coc_coc_browser|ccbrowser|CocCoc)\/([\d\.]+)/i);
      if (match && match[1]) {
        trackingData.user.browser.version = match[1];
      } else if (!trackingData.user.browser.version || trackingData.user.browser.version.startsWith('143')) {
        // Fallback if parser gave Chrome version
      }
    } else {
      // 1. Check Client Hints 'brands'
      const brands = trackingData.user.device.brands;
      if (Array.isArray(brands)) {
        const coccoc = brands.find(b => b.brand.includes('CocCoc') || b.brand.includes('Cốc Cốc'));
        if (coccoc) {
          trackingData.user.browser.name = 'Cốc Cốc';
          trackingData.user.browser.version = coccoc.version;
        }
      }
    }

    // 2. Fallback Regex on User-Agent if still identified as Chrome or Undefined
    if (trackingData.user.browser.name !== 'Cốc Cốc') {
      // Extended regex to catch 'CocCoc/26.2' style (often on iOS)
      if (/coc_coc_browser|ccbrowser|CocCoc/i.test(userAgent)) {
        trackingData.user.browser.name = 'Cốc Cốc';
        const match = userAgent.match(/(?:coc_coc_browser|ccbrowser|CocCoc)\/([\d\.]+)/i);
        if (match && match[1]) trackingData.user.browser.version = match[1];
      }
    }

    const hourKey = getHourKey(now);
    const dayKey = getDayKey(now);
    const weekKey = getWeekKey(now);
    const resultField = trackingData.convert.success ? 'success' : 'fail';

    if (isKVConfigured()) {
      await kv.incr('convert:total_clicks');
      await kv.set(`convert:detail:${trackingData.id}`, JSON.stringify(trackingData), { ex: 86400 });

      const multi = kv.pipeline();
      multi.hincrby(hourKey, 'total', 1);
      multi.hincrby(hourKey, resultField, 1);
      multi.expire(hourKey, 172800);
      multi.hincrby(dayKey, 'total', 1);
      multi.hincrby(dayKey, resultField, 1);
      multi.expire(dayKey, 604800);
      multi.hincrby(weekKey, 'total', 1);
      multi.hincrby(weekKey, resultField, 1);
      multi.expire(weekKey, 2419200);

      await multi.exec();

    } else {
      console.log('[Local Mode] Tracking:', trackingData.video.filename);
      global.localTotalClicks = (global.localTotalClicks || 0) + 1;
      global.localDetailedLogs.push(trackingData);
      if (global.localDetailedLogs.length > 1000) global.localDetailedLogs.shift();

      const incrementLocal = (k) => {
        if (!global.localCounters[k]) global.localCounters[k] = { total: 0, success: 0, fail: 0 };
        global.localCounters[k].total++;
        global.localCounters[k][resultField]++;
      };
      incrementLocal(hourKey);
      incrementLocal(dayKey);
      incrementLocal(weekKey);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Tracking Error:', error);
    res.json({ success: false, error: error.message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const now = Date.now();
    const hourKey = getHourKey(now);
    const dayKey = getDayKey(now);
    const weekKey = getWeekKey(now);

    const metrics = {
      p1h: { total: 0, success: 0, fail: 0 },
      p24h: { total: 0, success: 0, fail: 0 },
      p7d: { total: 0, success: 0, fail: 0 }
    };
    let totalClicks = 0;
    let logs = [];

    if (isKVConfigured()) {
      totalClicks = await kv.get('convert:total_clicks') || 0;

      const [hData, dData, wData] = await Promise.all([
        kv.hgetall(hourKey),
        kv.hgetall(dayKey),
        kv.hgetall(weekKey)
      ]);

      if (hData) metrics.p1h = { total: Number(hData.total) || 0, success: Number(hData.success) || 0, fail: Number(hData.fail) || 0 };
      if (dData) metrics.p24h = { total: Number(dData.total) || 0, success: Number(dData.success) || 0, fail: Number(dData.fail) || 0 };
      if (wData) metrics.p7d = { total: Number(wData.total) || 0, success: Number(wData.success) || 0, fail: Number(wData.fail) || 0 };

      const keys = await kv.keys('convert:detail:*');
      if (keys.length > 0) {
        const details = await kv.mget(keys);
        logs = details.map(item => typeof item === 'string' ? JSON.parse(item) : item).filter(Boolean);
      }

    } else {
      totalClicks = global.localTotalClicks || 0;
      logs = global.localDetailedLogs || [];

      const hData = global.localCounters[hourKey];
      const dData = global.localCounters[dayKey];
      const wData = global.localCounters[weekKey];

      if (hData) metrics.p1h = hData;
      if (dData) metrics.p24h = dData;
      if (wData) metrics.p7d = wData;
    }

    logs.sort((a, b) => b.timestamp - a.timestamp);

    const _vnNow = getVNTime(now);
    _vnNow.setUTCHours(0, 0, 0, 0);
    const startOfToday = _vnNow.getTime() - (7 * 3600000);
    logs = logs.filter(l => l.timestamp >= startOfToday);

    const { field, val, min, max } = req.query;
    if (field) {
      const searchVal = (val || '').toLowerCase();
      logs = logs.filter(log => {
        try {
          if (field === 'filename') return (log.video?.filename || '').toLowerCase().includes(searchVal);
          if (field === 'format') return (log.convert?.format || '').toLowerCase().includes(searchVal);
          if (field === 'country') return (log.user?.country || '').toLowerCase().includes(searchVal);
          if (field === 'ua') {
            const parts = [
              log.user?.browser?.name, log.user?.browser?.version,
              log.user?.os?.name, log.user?.os?.version,
              log.user?.device?.vendor, log.user?.device?.model, log.user?.ua
            ];
            return parts.filter(Boolean).join(' ').toLowerCase().includes(searchVal);
          }
          if (field === 'size') {
            const s = log.video?.size || 0;
            return (!min || s >= Number(min)) && (!max || s <= Number(max));
          }
          if (field === 'time') {
            const t = log.timestamp;
            return (!min || t >= Number(min)) && (!max || t <= Number(max));
          }
        } catch (e) { return false; }
        return true;
      });
    }

    res.json({
      allTime: { totalClicks: Number(totalClicks) || 0 },
      metrics,
      logs: logs.slice(0, 200)
    });

  } catch (error) {
    if (isKVConfigured()) console.error('Stats Error:', error);
    res.json({
      allTime: { totalClicks: 0 },
      metrics: { p1h: {}, p24h: {}, p7d: {} },
      logs: []
    });
  }
});

module.exports = router;
