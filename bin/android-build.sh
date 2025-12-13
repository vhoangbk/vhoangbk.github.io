rm -rf android/app/src/main/assets
mkdir -p android/app/src/main/assets
cp -r public/* android/app/src/main/assets/
rm android/app/src/main/assets/libs/ffmpeg-wasm/ffmpeg-mt-gpl.js
rm android/app/src/main/assets/libs/ffmpeg-wasm/ffmpeg-mt-gpl.wasm
rm -rf android/app/build
cd android
./gradlew assembleRelease