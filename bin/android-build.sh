rm -rf android/app/src/main/assets
mkdir -p android/app/src/main/assets
obfuscate_enable=true log_enable=true node local-build.js
cp -r dist/public/* android/app/src/main/assets/
rm android/app/src/main/assets/libs/ffmpeg-wasm/ffmpeg-mt-gpl.js
rm android/app/src/main/assets/libs/ffmpeg-wasm/ffmpeg-mt-gpl.wasm
rm -rf android/app/build
cd android
./gradlew assembleRelease