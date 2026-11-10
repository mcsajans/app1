const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Windows MAX_PATH düzeltmesi.
 *
 * React Native'in yeni mimarisi her native kütüphane için C++ codegen üretir ve
 * CMake nesne dosyası yolunu kaynağın mutlak yolundan türetir. Örnek:
 *
 *   <abi>/safeareacontext_autolinked_build/CMakeFiles/
 *   react_codegen_safeareacontext.dir/C_/bebektakip/node_modules/
 *   react-native-safe-area-context/android/build/generated/source/codegen/jni/
 *   react/renderer/components/safeareacontext/ComponentDescriptors.cpp.o
 *
 * Bu yol 300 karakteri aşıyor. Android SDK ile gelen ninja uzun yol desteğini
 * kullanmadığı için Windows'un sınırlarına takılıyor:
 *   - dosya oluşturma: 260 karakter
 *   - dizin oluşturma: 248 karakter  ("mkdir: No such file or directory")
 *
 * AGP, CMake'e varsayılan olarak -DCMAKE_OBJECT_PATH_MAX=1024 geçer; bu değer
 * yüksek olduğu için CMake kısaltma yapmaz. Değer düşürüldüğünde CMake sınırı
 * aşan nesne yollarını hash tabanlı kısa adlarla değiştirir.
 *
 * AGP'nin argümanı önce, bizimki sonra geçtiği için son değer kazanır.
 * Ayrıntı: ../TEKNIK_DOKUMAN.md §13.1
 */
const MARKER = 'CMAKE_OBJECT_PATH_MAX';

const SNIPPET = `
        externalNativeBuild {
            cmake {
                // Windows MAX_PATH — bkz. plugins/withCmakeObjectPathMax.js
                arguments "-DCMAKE_OBJECT_PATH_MAX=240"
            }
        }`;

module.exports = function withCmakeObjectPathMax(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') return cfg;
    if (cfg.modResults.contents.includes(MARKER)) return cfg;

    const next = cfg.modResults.contents.replace(
      /defaultConfig\s*\{/,
      (match) => match + SNIPPET,
    );

    if (next === cfg.modResults.contents) {
      throw new Error(
        'withCmakeObjectPathMax: app/build.gradle içinde defaultConfig bloğu bulunamadı.',
      );
    }

    cfg.modResults.contents = next;
    return cfg;
  });
};
