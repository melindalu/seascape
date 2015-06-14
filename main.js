var main = function (canvas) {
  var canvas = canvas;
  var canvasWidth = window.innerWidth,
      canvasHeight = window.innerHeight,
      widthToHeightRatio = canvasWidth / canvasHeight;
  if (widthToHeightRatio > 2) {
    canvasWidth = canvasHeight * 2;
  } else if (widthToHeightRatio < 0.75) {
    canvasWidth = canvasHeight * 0.75;
  }

  var simulator = new Simulator(canvas, canvasWidth, canvasHeight);
  var camera = new Camera(canvas.width, canvas.height);

  var leftMousing = false,
      rightMousing = false,
      lastMouseX = 0,
      lastMouseY = 0;

  var start = function () {
    simulator.prepareToRender();

    canvas.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousewheel', onMouseWheel);

    tick();
  };

  var onKeyDown = function () {
    switch (event.keyCode) {
      case Directions.UP:
      case Directions.DOWN:
      case Directions.LEFT:
      case Directions.RIGHT:
        camera.moveOnRequest(event.keyCode);
        break;
    }
  };

  var onMouseDown = function (event) {
    event.preventDefault();

    if (event.button == 2) {
      leftMousing = false;
      rightMousing = true;
    } else {
      leftMousing = true;
      rightMousing = false;
    }

    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
  };

  var onMouseUp = function (event) {
    event.preventDefault();
    leftMousing = false;
    rightMousing = false;
  };

  var onMouseMove = function (event) {
    event.preventDefault();
    if (!leftMousing) return;

    var newX = event.clientX;
    var newY = event.clientY;
    var deltaX = newX - lastMouseX;
    var deltaY = newY - lastMouseY;

    camera.rotate(deltaX, deltaY);

    lastMouseX = newX;
    lastMouseY = newY;
  };

  var onMouseWheel = function (event) {
    event.preventDefault();
    camera.changeEyeLevel(event.wheelDelta);
  };

  var tick = function () {
    requestAnimationFrame(tick);
    simulator.willAnimate();
    simulator.animate();
    camera.moveNormally();
  };

  start();

};

var environmentIsCapable = function (canvas) {
  var ctx;
  try {
    ctx = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  } catch (e) { return false; }

  if (!ctx) return false;
  if (!ctx.getExtension('OES_texture_float')) return false;
  if (!ctx.getExtension('OES_element_index_uint')) return false;
  if (ctx.getParameter(ctx.MAX_VERTEX_TEXTURE_IMAGE_UNITS) <= 0) return false;

  return true;
};

var canvas = document.getElementById("simulation");
if (environmentIsCapable(canvas)) {
  main(canvas);
} else {
  var error = document.getElementById('error');
  error.innerHTML = 'No luck.';
  error.style.display = 'block';
}