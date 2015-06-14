// We want to generate realistic-ish atmospheric scattering in real time.
// Rayleigh scattering: by small particles, scatters shorter wavelengths more.
// Mie scattering: by large particles, scatters wavelengths equally.
// To optimize GPU rendering, we precompute constants on the CPU here in JS.
var Sky = function () {
  var density = 0.99;
  var clarity = 0.9;
  var pollution = 0.008;
  var planetScale = 1.0;
  var atmosphereScale = 1.0;
  var sunDiskRadius = 0.1;
  var brightness = 11;
  var sunDiskIntensity = 0.3;

  var skyLambda = vec3.fromValues(680e-9, 550e-9, 450e-9);
  var skyK = vec3.fromValues(0.686, 0.678, 0.666);
  var earthRadius = 6.371e6;
  var earthAtmosphericThickness = 0.1e6;
  var cl = 1 + clarity;

  var skyParams1 = vec4.create();
  var skyParams2 = vec4.create();
  var skyParams3 = vec4.create();
  var skyParams4 = vec4.create();
  var skyParams5 = vec4.create();
  var skyParams6 = vec4.create();

  this.getSkyParams = function () {
    return [skyParams1,
            skyParams2,
            skyParams3,
            skyParams4,
            skyParams5,
            skyParams6];
  };

  // Compute Rayleigh beta
  var densityFactor = 1.86e-31 / (cl * Math.max(density, 0.001));

  vec4.set(skyParams2,
           densityFactor / Math.pow(skyLambda[0], 4),
           densityFactor / Math.pow(skyLambda[1], 4),
           densityFactor / Math.pow(skyLambda[2], 4),
           0);

  // Compute Mie beta
  var pollutionFactor = 1.36e-19 * Math.max(pollution, 0.001);
  vec4.set(skyParams3,
           pollutionFactor * skyK[0] * Math.pow(τ / skyLambda[0], 2),
           pollutionFactor * skyK[1] * Math.pow(τ / skyLambda[1], 2),
           pollutionFactor * skyK[2] * Math.pow(τ / skyLambda[2], 2),
           0);

  vec4.add(skyParams1, skyParams2, skyParams3);
  vec4.add(skyParams6, skyParams2, skyParams3);
  vec4.scale(skyParams6, skyParams6, -1.0);
  vec4.divide(skyParams2, skyParams2, skyParams1);
  vec4.divide(skyParams3, skyParams3, skyParams1);

  // Mie scattering phase constants
  var scatteringFactor = (1 - pollution) * 0.2 + 0.75;
  vec4.set(skyParams1,
           skyParams1[0],
           skyParams1[1],
           skyParams1[2],
           Math.pow(1 - scatteringFactor, 2) / (2 * τ));
  vec4.set(skyParams2,
           skyParams2[0],
           skyParams2[1],
           skyParams2[2],
           -2 * scatteringFactor);
  vec4.set(skyParams3,
           skyParams3[0],
           skyParams3[1],
           skyParams3[2],
           1 + Math.pow(scatteringFactor, 2));

  var planetaryRadius = earthRadius * planetScale;
  var atmosphericRadius = planetaryRadius + earthAtmosphericThickness * atmosphereScale;
  vec4.set(skyParams4,
           planetaryRadius,
           atmosphericRadius * atmosphericRadius,
           0.15 + 0.75 * 0.5,
           atmosphericRadius * atmosphericRadius - planetaryRadius * planetaryRadius);

  // Sun disk cutoff
  var sunDiskCutoffFactor = -(1 - 0.015 * sunDiskRadius);
  vec4.set(skyParams1,
           1 / (1 + sunDiskCutoffFactor),
           sunDiskCutoffFactor / (1 + sunDiskCutoffFactor),
           skyParams1[2],
           skyParams1[3]);

  vec4.set(skyParams5, brightness, brightness, brightness, sunDiskIntensity);

  vec4.set(skyParams6,
           skyParams6[0],
           skyParams6[1],
           skyParams6[2],
           cl * 3 / (8 * τ));
};