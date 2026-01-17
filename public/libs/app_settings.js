async function getBlobUrl(url) {
    if (typeof blobUrlMap === 'undefined') {
        blobUrlMap = {};
    }
    if (blobUrlMap[url]) {
        return blobUrlMap[url];
    }

    
    const response = await fetch(url);
    const blob = await response.blob();

        console.log('Fetching blob from URL:', url,blob);


    blobUrlMap[url] = URL.createObjectURL(blob);
    return blobUrlMap[url];
}

function generateStringHash(input) {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
        hash = ((hash << 5) - hash) + input.charCodeAt(i);
        hash |= 0;
    }
    return hash.toString(36);
}

var isReadyLibUrls = false;
const USE_FILE_INPUT = false;
const ENC_SDK_URL = 'https://www.convertsdk.com/enc';
const DEC_SDK_URL = 'https://www.convertsdk.com/dec';
//const IS_SHARED_ARRAY_BUFFER_SUPPORTED = typeof SharedArrayBuffer === 'undefined' ? false : true;



const CMD_BEE_UPDATE_PROGRESS = 'cmd-bee-update-progress';
const CMD_BEE_ERROR = 'cmd-bee-error';
const CMD_BEE_ERROR_CONFIG_CODER = 'cmd-bee-error-config-coder';

const CMD_BEE_TRY_AGAIN = 'cmd-bee-try-again';
const CMD_BEE_COMPLETE = 'cmd-bee-complete';
const CMD_BEE_CALL_MAIN = 'cmd-bee-call-main';
const CMD_BEE_CANCEL_CONVERT = 'cmd-bee-cancel-convert';
const CMD_BEE_READY = 'cmd-bee-ready';
const CMD_BEE_CALL_MAIN_RESPONSE = 'cmd-bee-call-main-response';
const CMD_BEE_GET_INFO = 'cmd-bee-get-info';
const CMD_BEE_CONVERT = 'cmd-bee-convert';
const CMD_BEE_CHECKBITRATE = 'cmd-bee-checkbitrate';
const CMD_NEW_FRAME = 'new_frame';
const CMD_BEE_WRITE_FILE = 'cmd-bee-write-file';
const CMD_BEE_PULL_DATA = 'cmd-bee-pull-data';
const CMD_BEE_FLUSH = 'cmd-bee-flush';
const CMD_BEE_CLOSE_CODER = 'cmd-bee-close-coder';



const IS_SHARED_ARRAY_BUFFER_SUPPORTED = true;
const userAgent = navigator.userAgent.toLowerCase();
const IS_MOBILE_APP = /beeconvertapp/i.test(userAgent);


let COMMON_UTILS_URL, MAIN_THREAD_URL, CODEC_HELPER_URL, ENCODE_DECODE_WORKER_URL, WASM_BEE_LIB_URL, FFMPEG_BEE_LIB_URL, INDEXED_DB_API_URL;

async function initUrls() {
    COMMON_UTILS_URL = await getBlobUrl('/libs/common-utils.js?v=f44ab3b85ecb');
    MAIN_THREAD_URL = await getBlobUrl('/libs/main-thread.js?v=5dde85789fe2');
    CODEC_HELPER_URL = await getBlobUrl('/libs/coder-config-utils.js?v=05f529551c6e');
    ENCODE_DECODE_WORKER_URL = await getBlobUrl('/libs/coder-thread.js?v=fb53fd6aaf04');
    WASM_BEE_LIB_URL = await getBlobUrl(IS_SHARED_ARRAY_BUFFER_SUPPORTED ? '/libs/ffmpeg-wasm/ffmpeg-mt-gpl.wasm?v=065e82cf9065' : '/libs/ffmpeg-wasm/ffmpeg-st-gpl.wasm?v=5638df8961fc');
    FFMPEG_BEE_LIB_URL = await getBlobUrl(IS_SHARED_ARRAY_BUFFER_SUPPORTED ? '/libs/ffmpeg-wasm/ffmpeg-mt-gpl.js?v=efc86569f9e2' : '/libs/ffmpeg-wasm/ffmpeg-st-gpl.js?v=1dc851f2c68d');
    INDEXED_DB_API_URL = await getBlobUrl('/libs/indexed-db-file-storage.js?v=1dc851f2c68d');
    LIB_URLs = {
        COMMON_UTILS_URL,
        MAIN_THREAD_URL,
        CODEC_HELPER_URL,
        ENCODE_DECODE_WORKER_URL,
        WASM_BEE_LIB_URL,
        FFMPEG_BEE_LIB_URL,
        INDEXED_DB_API_URL
    };
}

if (typeof window !== 'undefined') {
    // Khi app khởi động:
    initUrls().then(async () => {


        fileStorageDB = new IndexedDBFileStorage();
        await fileStorageDB.init();
        isReadyLibUrls = true;

        const idUserAgent = generateStringHash(navigator.userAgent) + '-browser-settings-v4';
        const storedSetting = localStorage.getItem(idUserAgent);

        // var storedSetting = `{"h264":{"codecName":"h264","width":640,"height":360,"framerate":30,"hardwareAcceleration":"prefer-hardware","bitrateMode":"variable","latencyMode":"quality","codec":"avc1.640034","bitrate":6912,"max_bpp":0.5205442708333333,"min_bpp":0.01939351851851852,"bpp":0.26996889467592594,"supported_resolution":{"landscape":[[320,240],[640,480],[960,540],[1280,720],[1920,1080],[2560,1440],[3840,2160]],"portrait":[[240,320],[480,640],[540,960],[720,1280],[1080,1920],[1440,2560],[2160,3840]]}},"h265":{"codecName":"h265","width":640,"height":360,"framerate":30,"hardwareAcceleration":"prefer-hardware","bitrateMode":"variable","latencyMode":"quality","codec":"hev1.1.6.L186.B0","bitrate":6912,"max_bpp":0.4712766203703704,"min_bpp":0.005785011574074074,"bpp":0.3316291377314815,"supported_resolution":{"landscape":[[320,240],[640,480],[960,540],[1280,720],[1920,1080]],"portrait":[[240,320],[480,640],[540,960],[720,1280],[1080,1920]]}},"av1":{"codecName":"av1","width":640,"height":360,"framerate":30,"hardwareAcceleration":"prefer-software","bitrateMode":"constant","latencyMode":"quality","codec":"av01.0.13M.08","bitrate":6912,"max_bpp":0.08586747685185185,"min_bpp":0.013464988425925925,"bpp":0.04966623263888889,"supported_resolution":{"landscape":[[320,240],[640,480],[960,540],[1280,720],[1920,1080],[2560,1440],[3840,2160]],"portrait":[[240,320],[480,640],[540,960],[720,1280],[1080,1920],[1440,2560],[2160,3840]]}},"vp9":{"codecName":"vp9","width":640,"height":360,"framerate":30,"hardwareAcceleration":"prefer-software","bitrateMode":"constant","latencyMode":"quality","codec":"vp09.00.51.08","bitrate":6912,"max_bpp":0.3842936921296296,"min_bpp":0.017996238425925924,"bpp":0.20114496527777775,"supported_resolution":{"landscape":[[320,240],[640,480],[960,540],[1280,720],[1920,1080],[2560,1440],[3840,2160]],"portrait":[[240,320],[480,640],[540,960],[720,1280],[1080,1920],[1440,2560],[2160,3840]]}}}`;
        if (storedSetting) {
            window.browser_settings = JSON.parse(storedSetting);
            return;
        }

        var worker = new Worker('libs/init-browser.js?v=c2d56ef52622');
        worker.onmessage = function (e) {
            if (e.data.cmd === 'init-browser-ready') {

                for (const key in localStorage) {
                    if (key.includes('browser-settings')) {
                        localStorage.removeItem(key);
                    }
                }
                localStorage.setItem(idUserAgent, JSON.stringify(e.data.settings));
                window.browser_settings = e.data.settings;
            }
        }

    });
}
