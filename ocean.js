var Ocean = function () {
  var normalVariate = new NormalVariate();
  var gravitationalConstant = 9.81;
  var windSpeed = 35.0;
  var windDirection = τ / 5;
  var waveScaleFactor = 1.2e-7;

  this.rgbColor = [36 / 255.0, 68 / 255.0, 99 / 255.0];

  // Builds a random ocean wave height field using Phillips spectrum values
  // transformed into fourier space.
  this.waveHeightSpectrum = function () {
    var spectrum = new Float32Array(tileResolution * tileResolution * 4);
    var k = 0;

    for (var j = 0; j < tileResolution; ++j) {
      for (var i = 0; i < tileResolution; ++i)  {
        var height = new fourierAmplitudeForTileAt(i, j);
        spectrum[k++] = height.real;
        spectrum[k++] = height.imag;
        spectrum[k++] = 0.0;
        spectrum[k++] = 0.0;
      }
    }

    return spectrum;
  };

  var fourierAmplitudeForTileAt = function (gridX, gridY) {
    var gridMultiplier = τ / tileSizeInMeters;
    var actualX = (gridX - tileResolution / 2.0) * gridMultiplier;
    var actualY = (gridY - tileResolution / 2.0) * gridMultiplier;
    var phillipsValue = Math.sqrt(phillipsValueAtLocation(actualX, actualY));

    return { real: normalVariate.random() * phillipsValue * Math.SQRT1_2,
             imag: normalVariate.random() * phillipsValue * Math.SQRT1_2 };
  };

  var phillipsValueAtLocation = function (kx, ky) {
    var kSquared = kx * kx + ky * ky;

    if (kSquared == 0.0) return 0.0;

    var largestWave = windSpeed * windSpeed / gravitationalConstant;
    var normalizedKx = kx / Math.sqrt(kSquared);
    var normalizedKy = ky / Math.sqrt(kSquared);
    var cosineFactorRoot = normalizedKx * Math.cos(windDirection) + normalizedKy * Math.sin(windDirection);

    var result = waveScaleFactor * (Math.exp(-1.0 / (kSquared * Math.pow(largestWave, 2))) / Math.pow(kSquared, 2)) * Math.pow(cosineFactorRoot, 2);

    var tiniestWave = largestWave / 10000;
    result *= Math.exp(-kSquared * Math.pow(tiniestWave, 2));

    return result;
  };

  // Returns butterfly indices/weights to be fed to the FFT shaders.
  this.butterflyArrayForIteration = function (n) {
    var butterflyArray = new Float32Array(tileResolution * tileResolution * 4);
    var stepSize = 1.0 / tileResolution;
    var k = 0, k0 = 0;
    var exp = Math.pow(2, fftIterations - n - 1);
    var next = Math.pow(2, n + 1);
    var curr = 0.5 * next;

    // Set up indices
    for (var m = 0; m < curr; ++m) {
      k = m * 4;
      for (var l = m; l < tileResolution; l += next, k += next * 4) {
        var source1Value = stepSize;
        var source2Value = stepSize;
        if (n != 0) {
          source1Value *= l + 0.5;
          source2Value *= l + curr + 0.5;
        } else {
          source1Value *= bitReverse(l, fftIterations) + 0.5;
          source2Value *= bitReverse(l + curr, fftIterations) + 0.5;
        }
        butterflyArray[k] = source1Value;
        butterflyArray[k + 1] = source2Value;
        butterflyArray[k + curr * 4]= source1Value;
        butterflyArray[k + curr * 4 + 1] = source2Value;
      }
    }
    
    // Set up weights
    k = 2;
    for (var i = 0; i < tileResolution; ++i, k += 2) {
      var r = (i * exp) % tileResolution;   
      butterflyArray[k++] = Math.cos(τ * r / tileResolution);
      butterflyArray[k++] = Math.sin(τ * r / tileResolution);
    }

    k = 4 * tileResolution;
    for (var j = 1; j < tileResolution; ++j) {
      k0 = 0;
      for (var i = 0; i < tileResolution; ++i) {
        butterflyArray[k++] = butterflyArray[k0++];
        butterflyArray[k++] = butterflyArray[k0++];
        butterflyArray[k++] = butterflyArray[k0++];
        butterflyArray[k++] = butterflyArray[k0++];
      }
    }

    return butterflyArray;
  };

  var bitReverse = function (x, fftIterations) {
    x = (((x & 0xaaaaaaaa) >> 1) | ((x & 0x55555555) << 1));
    x = (((x & 0xcccccccc) >> 2) | ((x & 0x33333333) << 2));
    x = (((x & 0xf0f0f0f0) >> 4) | ((x & 0x0f0f0f0f) << 4));
    x = (((x & 0xff00ff00) >> 8) | ((x & 0x00ff00ff) << 8));
    x = ((x >> 16) | (x << 16));
    x >>>= 32 - fftIterations;
    return x;
  };
};