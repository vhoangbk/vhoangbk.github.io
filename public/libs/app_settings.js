const USE_FILE_INPUT = false;
const ENC_SDK_URL = 'https://www.convertsdk.com/enc';
const DEC_SDK_URL = 'https://www.convertsdk.com/dec';
//const IS_SHARED_ARRAY_BUFFER_SUPPORTED = typeof SharedArrayBuffer === 'undefined' ? false : true;
const IS_SHARED_ARRAY_BUFFER_SUPPORTED = false;
const WASM_BEE_LIB_URL = IS_SHARED_ARRAY_BUFFER_SUPPORTED ? '/libs/ffmpeg-wasm/ffmpeg-mt-gpl.wasm?v=065e82cf9065' : '/libs/ffmpeg-wasm/ffmpeg-st-gpl.wasm?v=5638df8961fc';
const FFMPEG_BEE_LIB_URL = IS_SHARED_ARRAY_BUFFER_SUPPORTED ? '/libs/ffmpeg-wasm/ffmpeg-mt-gpl.js?v=efc86569f9e2' : '/libs/ffmpeg-wasm/ffmpeg-st-gpl.js?v=1dc851f2c68d';
const userAgent = navigator.userAgent.toLowerCase();
const IS_MOBILE_APP = /beeconvertapp/i.test(userAgent);
const MAIN_THREAD_URL = '/libs/main-thread.js?v=5dde85789fe2';
const CODEC_HELPER_URL = '/libs/coder-config-utils.js?v=05f529551c6e';
const ENCODE_DECODE_WORKER_URL = '/libs/coder-thread.js?v=fb53fd6aaf04';
const COMMON_UTILS_URL = '/libs/common-utils.js?v=f44ab3b85ecb';


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
const CMD_BEE_GET_DATA = 'cmd-bee-get-data'; 
const CMD_BEE_GET_DATA_RESPONSE = 'cmd-bee-get-data-response';