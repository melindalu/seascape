var Camera = function (canvasWidth, canvasHeight) {
  var canvasWidth = canvasWidth,
      canvasHeight = canvasHeight;
  var azimuth = τ / (10 + Math.random() * 8);
  var zenith = τ / (4 + Math.random() * 1.2);

  var faceDirection = vec3.cartesianFromSphericalValues(1.5, azimuth, zenith);
  sunPosition = vec3.cartesianFromSphericalValues(1000,
                                                  τ / (7.5 + Math.random() * 2),
                                                  τ / (5.5 + Math.random() * 2.3));
  eye = vec3.fromValues(0.0, 1.5, 0.0);
  center = vec3.fromValues(eye[0] + faceDirection[0],
                           eye[1] + faceDirection[1],
                           eye[2] + faceDirection[2]);

  perspectiveMatrix = mat4.create();
  mat4.perspective(perspectiveMatrix, fov * 2.0, canvasWidth / canvasHeight, 0.1, 150.0);

  viewMatrix = mat4.create();
  mat4.lookAt(viewMatrix, eye, center, up);

  model = mat4.create();
  mat4.identity(model);

  patchSizeMultiplier = 0.1;
  patchYOffset = vec3.fromValues(-0.001 * patchSizeMultiplier,
                                 -0.06 * patchSizeMultiplier,
                                 -patchSizeMultiplier);

  mat4.scale(model, model, [1.0 * patchSizeMultiplier, 10.0 * patchSizeMultiplier, 1.0 * patchSizeMultiplier]);

  var moveSpeedOnRequest = 0.4;
  var moveSpeedNormal = 0.1;
  var rotateSpeed = 0.002;

  this.moveOnRequest = function (moveDirection) {
    move(moveDirection, moveSpeedOnRequest);
  };

  this.moveNormally = function () {
    move(Directions.UP, moveSpeedNormal);
  };

  move = function (moveDirection, moveSpeed) {
    var baseDirection = vec3.fromValues(faceDirection[0] * moveSpeed,
                                        0.0,
                                        faceDirection[2] * moveSpeed);

    vec3.normalize(baseDirection, baseDirection);

    var rightDirection = vec3.fromValues(-moveSpeed * baseDirection[2],
                                         0.0,
                                         moveSpeed * baseDirection[0]);
    var forwardDirection = vec3.fromValues(moveSpeed * baseDirection[0],
                                           moveSpeed * baseDirection[1],
                                           moveSpeed * baseDirection[2]);

    switch (moveDirection) {
      case Directions.UP:
        vec3.add(eye, eye, forwardDirection);
        break;
      case Directions.DOWN:
        vec3.subtract(eye, eye, forwardDirection);
        break;
      case Directions.LEFT:
        vec3.subtract(eye, eye, rightDirection);
        break;
      case Directions.RIGHT:
        vec3.add(eye, eye, rightDirection);
        break;
    }

    updateViewMatrix();
  };

  this.rotate = function (deltaX, deltaY) {
    azimuth += rotateSpeed * deltaX;
    zenith -= rotateSpeed * deltaY;

    if (zenith < 0.001) zenith = 0.001;
    if (zenith > τ / 3) zenith = τ / 3;

    faceDirection = vec3.cartesianFromSphericalValues(1.0, azimuth, zenith);

    updateViewMatrix();
  };
  
  this.changeEyeLevel = function (wheelDelta) {
    var rotationDelta = [0.0, 0.1, 0.0];

    if (wheelDelta < 0.0) {
      vec3.subtract(eye, eye, rotationDelta);
    } else {
      vec3.add(eye, eye, rotationDelta);
    }

    if (eye[1] > 4.0) eye[1] = 4.0;
    if (eye[1] < 0.5) eye[1] = 0.5;

    updateViewMatrix();
  };

  var updateViewMatrix = function () {
    vec3.add(center, eye, faceDirection);
    mat4.lookAt(viewMatrix, eye, center, up);
  };

};

vec3.cartesianFromSphericalValues = function(r, azimuth, zenith) {
  var out = new GLMAT_ARRAY_TYPE(3);
  out[0] = r * Math.sin(zenith) * Math.sin(azimuth);
  out[1] = r * Math.cos(zenith);
  out[2] = r * Math.sin(zenith) * Math.cos(azimuth);
  return out;
};

if (!GLMAT_ARRAY_TYPE) {
  var GLMAT_ARRAY_TYPE = (typeof Float32Array !== 'undefined') ? Float32Array : Array;
}