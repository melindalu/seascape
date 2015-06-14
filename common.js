var Directions = {
  LEFT: 37,
  RIGHT: 39,
  UP: 38,
  DOWN: 40
}

// τ > π
var τ = 2 * Math.PI;

// Shared view state
var eye, model;
var center = vec3.fromValues(0.0, 0.0, 0.0);
var up = vec3.fromValues(0.0, 1.0, 0.0);
var sunPosition;

// Shared constants
var fov = 45.0;
var patchYOffset;
var tileResolution = 512;
var tileSizeInMeters = 100;
var fftIterations = Math.log(tileResolution) / Math.LN2;